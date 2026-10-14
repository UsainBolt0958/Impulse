export const CUSTOM_TEST_SESSION_KEY = 'impulse_custom_test_session';
export const CUSTOM_TEST_RESULTS_KEY = 'impulse_custom_test_results';
export const MAX_QUESTIONS_PER_SUBJECT = 120;

export const CUSTOM_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', mix: { easy: 0.8, medium: 0.18, hard: 0.02 } },
  { id: 'moderate-easy', label: 'Moderate-easy', mix: { easy: 0.55, medium: 0.38, hard: 0.07 } },
  { id: 'moderate-hard', label: 'Moderate-hard', mix: { easy: 0.13, medium: 0.67, hard: 0.2 } },
  { id: 'hard', label: 'Hard', mix: { easy: 0.05, medium: 0.3, hard: 0.65 } },
  { id: 'very-hard', label: 'Very hard', mix: { easy: 0, medium: 0.2, hard: 0.8 } },
];

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
  let remainder = count - targets.reduce((sum, value) => sum + value, 0);
  const fractionalOrder = raw
    .map((value, index) => ({ index, fraction: value - targets[index] }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < remainder; index += 1) {
    targets[fractionalOrder[index].index] += 1;
  }

  return Object.fromEntries(buckets.map((bucket, index) => [bucket, targets[index]]));
}

function takeFromPool(pool, bucket, count, random, selected) {
  if (count <= 0) return 0;
  const candidates = pool.filter((question) => (
    !selected.has(question.id) && difficultyBucket(question) === bucket
  ));
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
  const eligible = questions.filter((question) => (
    question.exam === exam
    && question.subject === subject
    && selectedYears.has(String(question.year))
  ));
  const selectedChapterPool = eligible.filter((question) => selectedChapters.has(question.chapter || 'Unspecified'));
  const otherChapterPool = eligible.filter((question) => !selectedChapters.has(question.chapter || 'Unspecified'));
  const requestedCount = Math.floor(Number(count) || 0);
  const targetCount = Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.max(0, requestedCount), eligible.length);
  const difficultyOption = CUSTOM_DIFFICULTIES.find((item) => item.id === difficulty);
  const targets = getMixTargets(targetCount, difficultyOption?.mix || CUSTOM_DIFFICULTIES[2].mix);
  const selectedIds = new Set();

  for (const bucket of ['easy', 'medium', 'hard']) {
    takeFromPool(selectedChapterPool, bucket, targets[bucket], random, selectedIds);
  }

  for (const bucket of ['easy', 'medium', 'hard']) {
    const alreadySelected = [...selectedIds].filter((id) => {
      const question = selectedChapterPool.find((item) => item.id === id);
      return difficultyBucket(question) === bucket;
    }).length;
    const shortage = Math.max(0, targets[bucket] - alreadySelected);
    takeFromPool(otherChapterPool, bucket, shortage, random, selectedIds);
  }

  if (selectedIds.size < targetCount) {
    const remaining = [...selectedChapterPool, ...otherChapterPool]
      .filter((question) => !selectedIds.has(question.id));
    shuffle(remaining, random)
      .slice(0, targetCount - selectedIds.size)
      .forEach((question) => selectedIds.add(question.id));
  }

  const questionsById = new Map(eligible.map((question) => [question.id, question]));
  return shuffle([...selectedIds].map((id) => questionsById.get(id)).filter(Boolean), random);
}

export function normalizeCustomAnswer(value) {
  const normalized = String(value ?? '').trim();
  if (/^[-+]?(?:\d+|\d*\.\d+)$/.test(normalized)) return Number(normalized);
  return normalized.replace(/^\+/, '');
}

export function calculateCustomTestResults(session, submittedAt = Date.now()) {
  const answers = session.answers || {};
  const timeSpent = session.timeSpent || {};
  const marks = session.marks || {};
  let positiveMarks = 0;
  let negativeMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let attemptedCount = 0;
  let totalTimeSpent = 0;

  const questionResults = session.questions.map((question, index) => {
    const answer = answers[question.id] ?? '';
    const hasAnswer = String(answer).trim() !== '';
    const questionType = getQuestionType(question);
    const correctAnswer = question.correct_answer ?? question.answer ?? '';
    const isCorrect = hasAnswer
      && normalizeCustomAnswer(answer) === normalizeCustomAnswer(correctAnswer);
    const time = Math.max(0, Number(timeSpent[question.id]) || 0);
    const points = hasAnswer
      ? (isCorrect ? Number(marks[questionType]?.correct ?? 4) : Number(marks[questionType]?.wrong ?? (questionType === 'NUM' ? 0 : -1)))
      : 0;

    if (hasAnswer) {
      attemptedCount += 1;
      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongCount += 1;
      }
      if (points >= 0) positiveMarks += points;
      else negativeMarks += Math.abs(points);
    }
    totalTimeSpent += time;

    return {
      index: index + 1,
      questionId: question.id,
      subject: question.subject || 'Unspecified',
      chapter: question.chapter || 'Unspecified',
      difficulty: question.difficulty || 'Unspecified',
      questionType,
      question,
      answer,
      correctAnswer,
      hasAnswer,
      isCorrect,
      marks: points,
      timeSpent: time,
    };
  });

  const totalQuestions = session.questions.length;
  const maxScore = questionResults.reduce(
    (total, result) => total + Number(marks[result.questionType]?.correct ?? 4),
    0,
  );
  const score = positiveMarks - negativeMarks;
  const elapsedSeconds = Math.max(0, Math.floor((submittedAt - session.startedAt) / 1000));

  return {
    id: session.id,
    exam: session.exam,
    difficulty: session.difficulty,
    startedAt: session.startedAt,
    submittedAt,
    durationSeconds: session.durationSeconds,
    elapsedSeconds,
    totalQuestions,
    attemptedCount,
    correctCount,
    wrongCount,
    unattemptedCount: totalQuestions - attemptedCount,
    positiveMarks,
    negativeMarks,
    score,
    maxScore,
    accuracy: attemptedCount ? Number(((correctCount / attemptedCount) * 100).toFixed(1)) : 0,
    efficiency: maxScore ? Number(((score / maxScore) * 100).toFixed(1)) : 0,
    totalTimeSpent,
    averageTimePerQuestion: totalQuestions ? Number((totalTimeSpent / totalQuestions).toFixed(1)) : 0,
    questionResults,
    subjects: session.subjects,
    marks: session.marks,
  };
}
