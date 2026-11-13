export const MAX_QUESTIONS_PER_SUBJECT = 75;

export const CUSTOM_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', mix: { easy: 0.8, medium: 0.18, hard: 0.02 } },
  { id: 'moderate-easy', label: 'Moderate-easy', mix: { easy: 0.55, medium: 0.38, hard: 0.07 } },
  { id: 'moderate-hard', label: 'Moderate-hard', mix: { easy: 0.13, medium: 0.67, hard: 0.2 } },
  { id: 'hard', label: 'Hard', mix: { easy: 0.05, medium: 0.3, hard: 0.65 } },
  { id: 'very-hard', label: 'Very hard', mix: { easy: 0, medium: 0.2, hard: 0.8 } },
];

export class InsufficientCustomTestQuestionsError extends Error {
  constructor(shortages) {
    const details = shortages
      .map(({ subject, requested, available }) => `${subject}: requested ${requested}, found ${available}`)
      .join('; ');
    super(`Not enough questions in the selected chapters (${details}). Select more chapters or reduce the question count.`);
    this.name = 'InsufficientCustomTestQuestionsError';
    this.shortages = shortages;
  }
}

export function getQuestionType(question) {
  const rawType = String(question?.type || question?.question_type || '').trim().toUpperCase();
  if (rawType.startsWith('NUM')) return 'NUM';
  if (rawType === 'MCQ') return 'MCQ';

  const answer = String(question?.correct_answer ?? question?.answer ?? '').trim();
  const hasOptions = Object.values(question?.options || {}).some((value) => String(value).trim() !== '');
  return /^[-+]?(?:\d+|\d*\.\d+)$/.test(answer) && !hasOptions ? 'NUM' : 'MCQ';
}

function difficultyBucket(question) {
  const difficulty = String(question?.difficulty || '').toLowerCase();
  if (difficulty.includes('hard') || difficulty.includes('difficult')) return 'hard';
  if (difficulty.includes('medium') || difficulty.includes('moderate')) return 'medium';
  if (difficulty.includes('easy')) return 'easy';
  return null;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getMixTargets(count, mix) {
  const buckets = ['easy', 'medium', 'hard'];
  const raw = buckets.map((bucket) => count * mix[bucket]);
  const targets = raw.map(Math.floor);
  const remainder = count - targets.reduce((sum, value) => sum + value, 0);
  const fractionalOrder = raw
    .map((value, index) => ({ index, fraction: value - targets[index] }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < remainder; index += 1) {
    targets[fractionalOrder[index].index] += 1;
  }

  return Object.fromEntries(buckets.map((bucket, index) => [bucket, targets[index]]));
}

function takeFromPool(pool, count, random, selected) {
  if (count <= 0) return 0;
  const candidates = pool.filter((question) => !selected.has(question.id));
  const chosen = shuffle(candidates, random).slice(0, count);
  chosen.forEach((question) => selected.add(question.id));
  return chosen.length;
}

export function selectCustomTestQuestions({
  questions,
  exam,
  subject,
  chapters,
  years,
  count,
  difficulty,
  random = Math.random,
}) {
  const selectedChapters = new Set(chapters);
  const selectedYears = new Set(years.map(String));
  const selectedChapterPoolById = new Map();
  for (const question of questions) {
    if (
      question.exam !== exam
      || String(question.subject || 'Unspecified') !== subject
      || !selectedYears.has(String(question.year))
      || !selectedChapters.has(question.chapter || 'Unspecified')
    ) {
      continue;
    }

    if (!selectedChapterPoolById.has(question.id)) {
      selectedChapterPoolById.set(question.id, question);
    }
  }
  const requestedCount = Math.floor(Number(count) || 0);
  const targetCount = Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.max(0, requestedCount));
  const selectedChapterPool = [...selectedChapterPoolById.values()];
  if (selectedChapterPool.length < targetCount) {
    throw new InsufficientCustomTestQuestionsError([{
      subject: subject || 'Unspecified',
      requested: targetCount,
      available: selectedChapterPool.length,
    }]);
  }

  const difficultyOption = CUSTOM_DIFFICULTIES.find((item) => item.id === difficulty);
  const targets = getMixTargets(targetCount, difficultyOption?.mix || CUSTOM_DIFFICULTIES[2].mix);
  const selectedIds = new Set();
  const selectedChapterPoolsByDifficulty = { easy: [], medium: [], hard: [] };
  selectedChapterPool.forEach((question) => {
    const bucket = difficultyBucket(question);
    if (bucket) selectedChapterPoolsByDifficulty[bucket].push(question);
  });

  for (const bucket of ['easy', 'medium', 'hard']) {
    takeFromPool(selectedChapterPoolsByDifficulty[bucket], targets[bucket], random, selectedIds);
  }

  if (selectedIds.size < targetCount) {
    const remaining = selectedChapterPool
      .filter((question) => !selectedIds.has(question.id));
    shuffle(remaining, random)
      .slice(0, targetCount - selectedIds.size)
      .forEach((question) => selectedIds.add(question.id));
  }

  return shuffle([...selectedIds].map((id) => selectedChapterPoolById.get(id)).filter(Boolean), random);
}

export function selectCustomTestQuestionsBySubject({
  questions,
  exam,
  subjects,
  years,
  difficulty,
  random = Math.random,
}) {
  const requestedSubjects = new Map(
    subjects.map((subject) => [subject.name.trim(), subject]),
  );
  const selectedYears = new Set(years.map(String));
  const questionsBySubject = new Map(
    [...requestedSubjects.keys()].map((subject) => [subject, []]),
  );

  for (const question of questions) {
    if (question.exam !== exam || !selectedYears.has(String(question.year))) continue;
    const subjectName = String(question.subject || 'Unspecified');
    const subjectQuestions = questionsBySubject.get(subjectName);
    if (subjectQuestions) subjectQuestions.push(question);
  }

  const selectedQuestions = [];
  const shortages = [];
  subjects.forEach((subject) => {
    try {
      selectedQuestions.push(...selectCustomTestQuestions({
        questions: questionsBySubject.get(subject.name.trim()),
        exam,
        subject: subject.name.trim(),
        chapters: subject.chapters,
        years,
        count: subject.count,
        difficulty,
        random,
      }));
    } catch (error) {
      if (!(error instanceof InsufficientCustomTestQuestionsError)) throw error;
      shortages.push(...error.shortages);
    }
  });

  if (shortages.length) throw new InsufficientCustomTestQuestionsError(shortages);
  return selectedQuestions;
}
