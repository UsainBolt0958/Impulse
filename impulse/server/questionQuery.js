import { getQuestionType } from '../shared/customTestSelection.js';

const QUESTION_METADATA_CACHE_TTL_MS = 15_000;
const QUESTION_CATALOG_CACHE_TTL_MS = 15_000;
const QUESTION_CATALOG_CACHE_MAX_ENTRIES = 100;
const CUSTOM_TEST_CATALOG_CACHE_TTL_MS = 15_000;
const QUESTION_PAGE_CACHE_TTL_MS = 15_000;
const QUESTION_PAGE_CACHE_MAX_ENTRIES = 50;
const QUESTION_PAGE_CACHE_MAX_BYTES = 5 * 1024 * 1024;
let questionMetadataIndexRequest = null;
const questionCatalogRequests = new Map();
let cachedCustomTestCatalog = null;
let customTestCatalogExpiresAt = 0;
let customTestCatalogRequest = null;
const questionPageRequests = new Map();

let cachedQuestionMetadata = null;
let questionMetadataExpiresAt = 0;
let questionMetadataVersion = 0;
const questionCatalogCache = new Map();
const questionPageCache = new Map();
let questionPageCacheBytes = 0;

function normalizeValues(values) {
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function getQuestionPageCacheKey(filters, page, limit) {
  const values = ['exam', 'subject', 'chapter', 'difficulty', 'year']
    .map((key) => [...new Set(normalizeValues(filters[key] || []))].sort());
  return JSON.stringify([values, page, limit]);
}

function removeQuestionPageCacheEntry(key) {
  const cached = questionPageCache.get(key);
  if (!cached) return;
  questionPageCacheBytes -= cached.bytes;
  questionPageCache.delete(key);
}

function pruneQuestionPageCache(now) {
  for (const [key, cached] of questionPageCache) {
    if (now >= cached.expiresAt) removeQuestionPageCacheEntry(key);
  }
}

export function filterQuestions(questions, filters = {}) {
  const matchesQuestion = createQuestionFilter(filters);
  return questions.filter(matchesQuestion);
}

function createQuestionFilter(filters = {}) {
  const exams = new Set(normalizeValues(filters.exam || []));
  const subjects = new Set(normalizeValues(filters.subject || []));
  const chapters = new Set(normalizeValues(filters.chapter || []));
  const difficulties = new Set(normalizeValues(filters.difficulty || []));
  const years = new Set(normalizeValues(filters.year || []));

  return (question) => (
    (!exams.size || exams.has(String(question.exam || '').trim()))
    && (!subjects.size || subjects.has(String(question.subject || '').trim()))
    && (!chapters.size || chapters.has(String(question.chapter || '').trim()))
    && (!difficulties.size || difficulties.has(String(question.difficulty || '').trim()))
    && (!years.size || years.has(String(question.year || '').trim()))
  );
}

export function filterAndPaginateQuestions(questions, filters, page, limit) {
  const matchesQuestion = createQuestionFilter(filters);
  const start = (page - 1) * limit;
  const end = start + limit;
  const results = [];
  let total = 0;

  for (const question of questions) {
    if (!matchesQuestion(question)) continue;
    if (total >= start && total < end) results.push(question);
    total += 1;
  }

  return {
    questions: results,
    total,
    page,
    limit,
    hasMore: start + results.length < total,
  };
}

export function buildQuestionCatalog(questions, exam, subject) {
  const scopedQuestions = filterQuestions(questions, { exam: [exam], subject: [subject] });
  const chapters = new Map();

  for (const question of scopedQuestions) {
    const chapter = String(question.chapter || '').trim() || 'Unspecified';
    const entry = chapters.get(chapter) || { chapter, count: 0, years: new Set() };
    entry.count += 1;
    const year = String(question.year || '').trim();
    if (/^\d{4}$/.test(year)) entry.years.add(year);
    chapters.set(chapter, entry);
  }

  return [...chapters.values()]
    .map(({ chapter, count, years }) => ({
      chapter,
      count,
      years: [...years].sort((left, right) => Number(right) - Number(left)),
    }))
    .sort((left, right) => left.chapter.localeCompare(right.chapter));
}

export function getCachedQuestionCatalog(
  questions,
  exam,
  subject,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedQuestionCatalogIfFresh(exam, subject, requestVersion);
  if (cached) return cached;

  const cacheKey = JSON.stringify([exam, subject]);
  const chapters = buildQuestionCatalog(questions, exam, subject);
  if (requestVersion === questionMetadataVersion) {
    if (questionCatalogCache.size >= QUESTION_CATALOG_CACHE_MAX_ENTRIES) {
      const oldestKey = questionCatalogCache.keys().next().value;
      if (oldestKey !== undefined) questionCatalogCache.delete(oldestKey);
    }
    questionCatalogCache.set(cacheKey, {
      chapters,
      expiresAt: Date.now() + QUESTION_CATALOG_CACHE_TTL_MS,
    });
  }
  return chapters.map((chapter) => ({ ...chapter, years: [...chapter.years] }));
}

export function getCachedQuestionCatalogIfFresh(
  exam,
  subject,
  requestVersion = questionMetadataVersion,
) {
  const cacheKey = JSON.stringify([exam, subject]);
  const cached = questionCatalogCache.get(cacheKey);
  if (
    requestVersion === questionMetadataVersion
    && cached
    && Date.now() < cached.expiresAt
  ) {
    return cached.chapters.map((chapter) => ({ ...chapter, years: [...chapter.years] }));
  }
  return null;
}

export function buildCustomTestCatalog(questions) {
  const exams = new Map();

  for (const question of questions) {
    const exam = String(question.exam || '').trim();
    if (!exam) continue;

    const year = question.year === null || question.year === undefined
      ? ''
      : String(question.year);
    const subjectName = String(question.subject || 'Unspecified').trim() || 'Unspecified';
    const chapterName = String(question.chapter || 'Unspecified').trim() || 'Unspecified';
    const examEntry = exams.get(exam) || { name: exam, count: 0, years: new Set(), subjects: new Map() };
    examEntry.count += 1;
    if (year) examEntry.years.add(year);

    const subjectEntry = examEntry.subjects.get(subjectName) || {
      name: subjectName,
      questionCountByYear: new Map(),
      chapters: new Map(),
      typesByYear: new Map(),
    };
    if (year) {
      subjectEntry.questionCountByYear.set(
        year,
        (subjectEntry.questionCountByYear.get(year) || 0) + 1,
      );
      const types = subjectEntry.typesByYear.get(year) || new Set();
      types.add(getQuestionType(question));
      subjectEntry.typesByYear.set(year, types);
    }

    const chapterEntry = subjectEntry.chapters.get(chapterName) || {
      name: chapterName,
      questionCountByYear: new Map(),
    };
    if (year) {
      chapterEntry.questionCountByYear.set(
        year,
        (chapterEntry.questionCountByYear.get(year) || 0) + 1,
      );
    }

    subjectEntry.chapters.set(chapterName, chapterEntry);
    examEntry.subjects.set(subjectName, subjectEntry);
    exams.set(exam, examEntry);
  }

  const sortYears = (years) => [...years].sort((left, right) => Number(right) - Number(left));
  const toCounts = (counts) => Object.fromEntries(counts);
  return [...exams.values()]
    .map((exam) => ({
      name: exam.name,
      count: exam.count,
      years: sortYears(exam.years),
      subjects: [...exam.subjects.values()]
        .map((subject) => {
          const questionCountByYear = toCounts(subject.questionCountByYear);
          const questionCount = Object.values(questionCountByYear)
            .reduce((total, count) => total + count, 0);
          return {
            name: subject.name,
            questionCount,
            questionCountByYear,
            typesByYear: [...subject.typesByYear.entries()]
              .map(([year, types]) => ({ year, types: [...types] })),
            chapters: [...subject.chapters.values()]
              .map((chapter) => ({
                name: chapter.name,
                questionCountByYear: toCounts(chapter.questionCountByYear),
              }))
              .sort((left, right) => left.name.localeCompare(right.name)),
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getCachedCustomTestCatalogIfFresh(requestVersion = questionMetadataVersion) {
  if (
    requestVersion !== questionMetadataVersion
    || !cachedCustomTestCatalog
    || Date.now() >= customTestCatalogExpiresAt
  ) {
    return null;
  }
  return structuredClone(cachedCustomTestCatalog);
}

export async function getOrLoadCustomTestCatalog(
  loadQuestions,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedCustomTestCatalogIfFresh(requestVersion);
  if (cached) return cached;

  if (customTestCatalogRequest?.version === requestVersion) {
    return structuredClone(await customTestCatalogRequest.promise);
  }

  const request = Promise.resolve()
    .then(loadQuestions)
    .then((questions) => {
      const catalog = buildCustomTestCatalog(questions || []);
      if (requestVersion === questionMetadataVersion) {
        cachedCustomTestCatalog = catalog;
        customTestCatalogExpiresAt = Date.now() + CUSTOM_TEST_CATALOG_CACHE_TTL_MS;
      }
      return catalog;
    })
    .finally(() => {
      if (customTestCatalogRequest?.promise === request) {
        customTestCatalogRequest = null;
      }
    });
  customTestCatalogRequest = { version: requestVersion, promise: request };
  return structuredClone(await request);
}

function buildQuestionMetadataIndex(questions) {
  const index = new Map();
  (Array.isArray(questions) ? questions : []).forEach((question, position) => {
    const id = String(question?.id);
    if (!index.has(id)) index.set(id, []);
    index.get(id).push({
      position,
      metadata: {
        id: question.id,
        exam: question.exam,
        subject: question.subject,
        chapter: question.chapter,
        difficulty: question.difficulty,
      },
    });
  });
  return index;
}

export function getQuestionMetadataCacheVersion() {
  return questionMetadataVersion;
}

export function invalidateQuestionMetadataCache() {
  questionMetadataVersion += 1;
  cachedQuestionMetadata = null;
  questionMetadataExpiresAt = 0;
  cachedCustomTestCatalog = null;
  customTestCatalogExpiresAt = 0;
  customTestCatalogRequest = null;
  questionCatalogCache.clear();
  questionPageCache.clear();
  questionPageCacheBytes = 0;
  questionMetadataIndexRequest = null;
  questionCatalogRequests.clear();
  questionPageRequests.clear();
}

export function getQuestionMetadata(questions, ids, requestVersion = questionMetadataVersion) {
  const requestedIds = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
  const cached = getCachedQuestionMetadataIfFresh(ids, requestVersion);
  if (cached) return cached;

  const index = buildQuestionMetadataIndex(questions);
  if (requestVersion === questionMetadataVersion) {
    cachedQuestionMetadata = index;
    questionMetadataExpiresAt = Date.now() + QUESTION_METADATA_CACHE_TTL_MS;
  }
  return getRequestedMetadata(index, requestedIds);
}

export function getCachedQuestionMetadataIfFresh(
  ids,
  requestVersion = questionMetadataVersion,
) {
  const requestedIds = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
  if (
    requestVersion === questionMetadataVersion
    && cachedQuestionMetadata
    && Date.now() < questionMetadataExpiresAt
  ) {
    return getRequestedMetadata(cachedQuestionMetadata, requestedIds);
  }
  return null;
}

export async function getOrLoadQuestionMetadata(
  ids,
  loadQuestions,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedQuestionMetadataIfFresh(ids, requestVersion);
  if (cached) return cached;

  let indexRequest = questionMetadataIndexRequest;
  if (!indexRequest || indexRequest.version !== requestVersion) {
    const request = Promise.resolve()
      .then(loadQuestions)
      .then((questions) => {
        const index = buildQuestionMetadataIndex(questions);
        if (requestVersion === questionMetadataVersion) {
          cachedQuestionMetadata = index;
          questionMetadataExpiresAt = Date.now() + QUESTION_METADATA_CACHE_TTL_MS;
        }
        return index;
      })
      .finally(() => {
        if (questionMetadataIndexRequest?.promise === request) {
          questionMetadataIndexRequest = null;
        }
      });
    indexRequest = { version: requestVersion, promise: request };
    questionMetadataIndexRequest = indexRequest;
  }

  const index = await indexRequest.promise;
  const requestedIds = new Set(ids.map((id) => String(id).trim()).filter(Boolean));
  return getRequestedMetadata(index, requestedIds);
}

export async function getOrLoadQuestionCatalog(
  exam,
  subject,
  loadQuestions,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedQuestionCatalogIfFresh(exam, subject, requestVersion);
  if (cached) return cached;

  const cacheKey = JSON.stringify([exam, subject]);
  const pendingRequest = questionCatalogRequests.get(cacheKey);
  if (pendingRequest) return structuredClone(await pendingRequest);

  const request = Promise.resolve()
    .then(loadQuestions)
    .then((questions) => getCachedQuestionCatalog(questions, exam, subject, requestVersion))
    .finally(() => {
      if (questionCatalogRequests.get(cacheKey) === request) {
        questionCatalogRequests.delete(cacheKey);
      }
    });
  questionCatalogRequests.set(cacheKey, request);
  return structuredClone(await request);
}

function getRequestedMetadata(index, requestedIds) {
  return [...requestedIds]
    .flatMap((id) => index.get(id) || [])
    .sort((left, right) => left.position - right.position)
    .map(({ metadata }) => ({ ...metadata }));
}

export function paginateQuestions(questions, page, limit) {
  const total = questions.length;
  const start = (page - 1) * limit;
  const results = questions.slice(start, start + limit);

  return {
    questions: results,
    total,
    page,
    limit,
    hasMore: start + results.length < total,
  };
}

export function getCachedQuestionPage(filters, page, limit, requestVersion = questionMetadataVersion) {
  if (requestVersion !== questionMetadataVersion) return null;

  const cacheKey = getQuestionPageCacheKey(filters, page, limit);
  const cached = questionPageCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    removeQuestionPageCacheEntry(cacheKey);
    return null;
  }
  return structuredClone(cached.result);
}

export async function getOrLoadQuestionPage(
  filters,
  page,
  limit,
  loadQuestions,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedQuestionPage(filters, page, limit, requestVersion);
  if (cached) return cached;

  const cacheKey = getQuestionPageCacheKey(filters, page, limit);
  const pendingRequest = questionPageRequests.get(cacheKey);
  if (pendingRequest) return structuredClone(await pendingRequest);

  const request = Promise.resolve()
    .then(loadQuestions)
    .then((questions) => filterAndCacheQuestionPage(
      questions,
      filters,
      page,
      limit,
      requestVersion,
    ))
    .finally(() => {
      if (questionPageRequests.get(cacheKey) === request) {
        questionPageRequests.delete(cacheKey);
      }
    });
  questionPageRequests.set(cacheKey, request);
  return structuredClone(await request);
}

export async function getOrLoadPrecomputedQuestionPage(
  filters,
  page,
  limit,
  loadPage,
  requestVersion = questionMetadataVersion,
) {
  const cached = getCachedQuestionPage(filters, page, limit, requestVersion);
  if (cached) return cached;

  const cacheKey = getQuestionPageCacheKey(filters, page, limit);
  const pendingRequest = questionPageRequests.get(cacheKey);
  if (pendingRequest) return structuredClone(await pendingRequest);

  const request = Promise.resolve()
    .then(loadPage)
    .then((result) => cacheQuestionPageResult(
      result,
      filters,
      page,
      limit,
      requestVersion,
    ))
    .finally(() => {
      if (questionPageRequests.get(cacheKey) === request) {
        questionPageRequests.delete(cacheKey);
      }
    });
  questionPageRequests.set(cacheKey, request);
  return structuredClone(await request);
}

export function filterAndCacheQuestionPage(
  questions,
  filters,
  page,
  limit,
  requestVersion = questionMetadataVersion,
) {
  const result = filterAndPaginateQuestions(questions, filters, page, limit);
  return cacheQuestionPageResult(result, filters, page, limit, requestVersion);
}

function cacheQuestionPageResult(result, filters, page, limit, requestVersion) {
  if (requestVersion !== questionMetadataVersion) return structuredClone(result);

  const serializedResult = JSON.stringify(result);
  const bytes = Buffer.byteLength(serializedResult, 'utf8');
  if (bytes > QUESTION_PAGE_CACHE_MAX_BYTES) return structuredClone(result);

  const cacheKey = getQuestionPageCacheKey(filters, page, limit);
  const now = Date.now();
  pruneQuestionPageCache(now);
  removeQuestionPageCacheEntry(cacheKey);
  while (
    questionPageCache.size >= QUESTION_PAGE_CACHE_MAX_ENTRIES
    || questionPageCacheBytes + bytes > QUESTION_PAGE_CACHE_MAX_BYTES
  ) {
    const oldestKey = questionPageCache.keys().next().value;
    if (oldestKey === undefined) break;
    removeQuestionPageCacheEntry(oldestKey);
  }
  questionPageCache.set(cacheKey, {
    result: structuredClone(result),
    bytes,
    expiresAt: now + QUESTION_PAGE_CACHE_TTL_MS,
  });
  questionPageCacheBytes += bytes;
  return structuredClone(result);
}
