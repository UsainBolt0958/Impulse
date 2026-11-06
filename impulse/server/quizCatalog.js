import { randomUUID } from 'node:crypto';

const QUIZ_CATALOG_CACHE_TTL_MS = 15_000;

let cachedQuizCatalog = null;
let quizCatalogExpiresAt = 0;
let cachedQuizQuestionsByChapter = null;
let quizQuestionsExpiresAt = 0;
let quizCatalogVersion = 0;
let pendingQuizIndexRequest = null;

function buildPlayableQuestionIndex(questions) {
  const index = new Map();
  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const playableQuestion = getQuizQuestion(question);
    if (!playableQuestion) return;
    const subject = String(question.subject || '').trim();
    const chapter = String(question.chapter || '').trim();
    if (!subject || !chapter) return;
    const key = JSON.stringify([subject, chapter]);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(playableQuestion);
  });
  return index;
}

function buildQuizCatalogFromIndex(index) {
  const subjects = new Map();
  index.forEach((questions, key) => {
    const [subject, chapter] = JSON.parse(key);
    if (!subjects.has(subject)) subjects.set(subject, new Map());
    const chapters = subjects.get(subject);
    chapters.set(chapter, questions.length);
  });

  return [...subjects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, chapters]) => ({
      name,
      chapters: [...chapters.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([chapter, questionCount]) => ({ name: chapter, questionCount })),
    }));
}

export function buildQuizCatalog(questions) {
  return buildQuizCatalogFromIndex(buildPlayableQuestionIndex(questions));
}

export function getQuizQuestion(question) {
  if (!question || typeof question !== 'object') return null;
  const options = question.options || {};
  const normalizedOptions = {};
  for (const key of ['A', 'B', 'C', 'D']) {
    const option = options[key] ?? question[`option${key}`];
    const text = typeof option === 'string' ? option : option?.text;
    if (typeof text !== 'string' || !text.trim()) return null;
    normalizedOptions[key] = {
      text: text.trim(),
      image: typeof option === 'object' && typeof option.image === 'string'
        ? option.image
        : String(question.option_images?.[key] || question[`option${key}Image`] || ''),
    };
  }

  const questionText = question.question_text || question.question || '';
  const correctAnswer = String(question.correct_answer || question.correctAnswer || '').toUpperCase();
  if (
    typeof questionText !== 'string'
    || !questionText.trim()
    || !['A', 'B', 'C', 'D'].includes(correctAnswer)
  ) {
    return null;
  }

  return {
    id: String(question.id || randomUUID()),
    question: questionText.trim(),
    image: typeof question.image === 'string' ? question.image : '',
    options: normalizedOptions,
    correctAnswer,
    explanation: String(question.explanation || question.solution || ''),
  };
}

export function getQuizCatalogCacheVersion() {
  return quizCatalogVersion;
}

export function getCachedQuizCatalogIfFresh(requestVersion = quizCatalogVersion) {
  if (
    requestVersion !== quizCatalogVersion
    || !cachedQuizCatalog
    || Date.now() >= quizCatalogExpiresAt
  ) {
    return null;
  }
  return structuredClone(cachedQuizCatalog);
}

export function getCachedQuizCatalog(questions, requestVersion = quizCatalogVersion) {
  const cached = getCachedQuizCatalogIfFresh(requestVersion);
  if (cached) return cached;

  const index = getPlayableQuestionIndex(questions, requestVersion);
  return cacheAndCloneQuizCatalog(index, requestVersion);
}

export async function getOrLoadQuizCatalog(loadQuestions, requestVersion = quizCatalogVersion) {
  const cached = getCachedQuizCatalogIfFresh(requestVersion);
  if (cached) return cached;
  const index = await getOrLoadPlayableQuestionIndex(loadQuestions, requestVersion);
  return cacheAndCloneQuizCatalog(index, requestVersion);
}

export function getCachedQuizQuestionsIfFresh(
  subject,
  chapter,
  requestVersion = quizCatalogVersion,
) {
  if (
    requestVersion !== quizCatalogVersion
    || !cachedQuizQuestionsByChapter
    || Date.now() >= quizQuestionsExpiresAt
  ) {
    return null;
  }
  const key = JSON.stringify([
    String(subject || '').trim(),
    String(chapter || '').trim(),
  ]);
  return structuredClone(cachedQuizQuestionsByChapter.get(key) || []);
}

export function getCachedQuizQuestions(
  questions,
  subject,
  chapter,
  requestVersion = quizCatalogVersion,
) {
  const cached = getCachedQuizQuestionsIfFresh(subject, chapter, requestVersion);
  if (cached) return cached;
  const index = getPlayableQuestionIndex(questions, requestVersion);
  const key = JSON.stringify([String(subject || '').trim(), String(chapter || '').trim()]);
  return structuredClone(index.get(key) || []);
}

export async function getOrLoadQuizQuestions(
  loadQuestions,
  subject,
  chapter,
  requestVersion = quizCatalogVersion,
) {
  const cached = getCachedQuizQuestionsIfFresh(subject, chapter, requestVersion);
  if (cached) return cached;
  const index = await getOrLoadPlayableQuestionIndex(loadQuestions, requestVersion);
  const key = JSON.stringify([String(subject || '').trim(), String(chapter || '').trim()]);
  return structuredClone(index.get(key) || []);
}

function cacheAndCloneQuizCatalog(index, requestVersion) {
  const catalog = buildQuizCatalogFromIndex(index);
  if (requestVersion === quizCatalogVersion) {
    cachedQuizCatalog = catalog;
    quizCatalogExpiresAt = Date.now() + QUIZ_CATALOG_CACHE_TTL_MS;
  }
  return structuredClone(catalog);
}

async function getOrLoadPlayableQuestionIndex(loadQuestions, requestVersion) {
  if (
    requestVersion === quizCatalogVersion
    && cachedQuizQuestionsByChapter
    && Date.now() < quizQuestionsExpiresAt
  ) {
    return cachedQuizQuestionsByChapter;
  }
  if (pendingQuizIndexRequest?.version === requestVersion) {
    return pendingQuizIndexRequest.promise;
  }

  const request = Promise.resolve()
    .then(loadQuestions)
    .then((questions) => {
      const index = buildPlayableQuestionIndex(questions);
      if (requestVersion === quizCatalogVersion) {
        cachedQuizQuestionsByChapter = index;
        quizQuestionsExpiresAt = Date.now() + QUIZ_CATALOG_CACHE_TTL_MS;
      }
      return index;
    })
    .finally(() => {
      if (pendingQuizIndexRequest?.promise === request) {
        pendingQuizIndexRequest = null;
      }
    });
  pendingQuizIndexRequest = { version: requestVersion, promise: request };
  return request;
}

function getPlayableQuestionIndex(questions, requestVersion) {
  if (
    requestVersion === quizCatalogVersion
    && cachedQuizQuestionsByChapter
    && Date.now() < quizQuestionsExpiresAt
  ) {
    return cachedQuizQuestionsByChapter;
  }

  const index = buildPlayableQuestionIndex(questions);
  if (requestVersion === quizCatalogVersion) {
    cachedQuizQuestionsByChapter = index;
    quizQuestionsExpiresAt = Date.now() + QUIZ_CATALOG_CACHE_TTL_MS;
  }
  return index;
}

export function invalidateQuizCatalogCache() {
  quizCatalogVersion += 1;
  cachedQuizCatalog = null;
  quizCatalogExpiresAt = 0;
  cachedQuizQuestionsByChapter = null;
  quizQuestionsExpiresAt = 0;
  pendingQuizIndexRequest = null;
}
