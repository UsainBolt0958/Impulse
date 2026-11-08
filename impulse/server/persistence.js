import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STORAGE_BUCKET = 'admin-uploads';
const PERSISTED_DOCUMENTS = new Set([
  'admin-state.json',
  'engine-questions.json',
  'series.json',
  'tests.json',
]);
const PERSISTED_DOCUMENT_CACHE_TTL_MS = 15_000;
const PERSISTED_DOCUMENT_CACHE_MAX_BYTES = 5 * 1024 * 1024;
const PERSISTED_COLLECTION_INDEX_MAX_ITEMS = 10_000;
const persistentDocumentCache = new Map();
const persistentDocumentRequests = new Map();
const persistentDocumentVersions = new Map();
const persistentCollectionIndexCache = new Map();
const persistentCollectionIndexRequests = new Map();

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function requireSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    const error = new Error('Persistent admin storage is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API host.');
    error.statusCode = 503;
    throw error;
  }
}

export function normalizedQuestionStorageEnabled() {
  return process.env.SUPABASE_NORMALIZED_QUESTIONS === 'true';
}

function compactTestQuestionSolutions(tests) {
  if (!Array.isArray(tests)) return tests;
  return mapTestQuestionCollections(tests, (question) => (
    mapQuestionTree(question, compactQuestionTree)
  ));
}

function restoreTestQuestionSolutions(tests) {
  if (!Array.isArray(tests)) return tests;
  return mapTestQuestionCollections(tests, (question) => (
    mapQuestionTree(question, restoreQuestionTree)
  ));
}

function mapTestQuestionCollections(value, mapQuestion) {
  if (Array.isArray(value)) return value.map((item) => mapTestQuestionCollections(item, mapQuestion));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === 'questions' && Array.isArray(item)
      ? item.map(mapQuestion)
      : mapTestQuestionCollections(item, mapQuestion),
  ]));
}

function mapQuestionTree(value, mapQuestionObject) {
  if (Array.isArray(value)) return value.map((item) => mapQuestionTree(item, mapQuestionObject));
  if (!value || typeof value !== 'object') return value;

  const mapped = Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    mapQuestionTree(item, mapQuestionObject),
  ]));
  return mapQuestionObject(mapped);
}

function compactQuestionTree(question) {
  if (
    !question
    || typeof question !== 'object'
    || typeof question.solution !== 'string'
    || question.explanation !== question.solution
  ) return question;

  const { explanation, ...compactQuestion } = question;
  return compactQuestion;
}

function restoreQuestionTree(question) {
  return question
    && typeof question === 'object'
    && typeof question.solution === 'string'
    && question.explanation === undefined
    ? { ...question, explanation: question.solution }
    : question;
}

function restorePersistedDocument(key, content) {
  return key === 'tests.json' ? restoreTestQuestionSolutions(content) : content;
}

function getHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function getInFilter(values) {
  const escapedValues = values.map((value) => (
    `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  ));
  return `in.(${escapedValues.join(',')})`;
}

function addNormalizedQuestionFilters(query, filters = {}) {
  for (const field of ['exam', 'subject', 'chapter', 'difficulty', 'year']) {
    const values = [...new Set((filters[field] || []).map((value) => String(value).trim()).filter(Boolean))];
    if (values.length === 1) query.set(field, `eq.${values[0]}`);
    else if (values.length > 1) query.set(field, getInFilter(values));
  }
}

async function fetchNormalizedQuestionRows(query, { start = 0, end = 999 } = {}) {
  requireSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/question_versions?${query}`, {
    headers: getHeaders({ Range: `${start}-${end}`, 'Range-Unit': 'items' }),
  });
  if (!response.ok) throw await getResponseError(response);
  return response.json();
}

export async function readNormalizedQuestions() {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const query = new URLSearchParams({
      select: 'content',
      is_current: 'eq.true',
      order: 'position.asc',
    });
    const batch = await fetchNormalizedQuestionRows(query, {
      start,
      end: start + 999,
    });
    rows.push(...batch.map((row) => row.content));
    if (batch.length < 1000) return rows;
  }
}

export async function readNormalizedQuestionPage(filters, page, limit) {
  const query = new URLSearchParams({
    select: 'content',
    is_current: 'eq.true',
    order: 'position.asc',
  });
  addNormalizedQuestionFilters(query, filters);
  const start = (page - 1) * limit;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/question_versions?${query}`,
    {
      headers: getHeaders({
        Prefer: 'count=exact',
        Range: `${start}-${start + limit - 1}`,
        'Range-Unit': 'items',
      }),
    },
  );
  if (!response.ok) throw await getResponseError(response);
  const questions = (await response.json()).map((row) => row.content);
  const contentRange = response.headers.get('content-range') || '';
  const total = Number(contentRange.match(/\/(\d+)$/)?.[1]);
  if (!Number.isInteger(total)) {
    const error = new Error('Supabase did not return an exact question count.');
    error.statusCode = 503;
    throw error;
  }
  return {
    questions,
    total,
    page,
    limit,
    hasMore: start + questions.length < total,
  };
}

export async function readNormalizedQuestionMetadata() {
  const query = new URLSearchParams({
    select: 'question_id,position,exam,subject,chapter,difficulty',
    is_current: 'eq.true',
    order: 'position.asc',
  });
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const batch = await fetchNormalizedQuestionRows(query, {
      start,
      end: start + 999,
    });
    rows.push(...batch.map(({ question_id, exam, subject, chapter, difficulty }) => ({
      id: question_id,
      exam,
      subject,
      chapter,
      difficulty,
    })));
    if (batch.length < 1000) return rows;
  }
}

export async function readNormalizedQuestionCatalog(exam, subject) {
  const query = new URLSearchParams({
    select: 'exam,subject,chapter,year',
    is_current: 'eq.true',
    exam: `eq.${exam}`,
    subject: `eq.${subject}`,
    order: 'position.asc',
  });
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const batch = await fetchNormalizedQuestionRows(query, {
      start,
      end: start + 999,
    });
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function readNormalizedCustomTestCatalogQuestions() {
  const query = new URLSearchParams({
    select: 'exam,subject,chapter,year,question_type,correct_answer,options',
    is_current: 'eq.true',
    order: 'position.asc',
  });
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const batch = await fetchNormalizedQuestionRows(query, {
      start,
      end: start + 999,
    });
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function readNormalizedQuestionsForSelection({
  exam,
  subjects,
  chapters,
  years,
  difficulty,
}) {
  const query = new URLSearchParams({
    select: 'content,version',
    is_current: 'eq.true',
    exam: `eq.${exam}`,
    year: getInFilter(years),
    subject: getInFilter(subjects),
    chapter: getInFilter(chapters),
    difficulty: `eq.${difficulty}`,
    order: 'position.asc',
  });
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const batch = await fetchNormalizedQuestionRows(query, {
      start,
      end: start + 999,
    });
    rows.push(...batch.map((row) => ({
      ...row.content,
      question_version: row.version,
    })));
    if (batch.length < 1000) return rows;
  }
}

export async function readCurrentNormalizedQuestionVersions(questionIds) {
  const ids = [...new Set(questionIds.map((id) => String(id).trim()).filter(Boolean))];
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const query = new URLSearchParams({
      select: 'question_id,version,content',
      is_current: 'eq.true',
      question_id: getInFilter(ids.slice(offset, offset + 100)),
    });
    rows.push(...await fetchNormalizedQuestionRows(query, {
      start: 0,
      end: 99,
    }));
  }
  return rows;
}

export async function readNormalizedQuestionVersions(references) {
  const versionsByNumber = new Map();
  references.forEach((reference) => {
    const version = Number(reference.version);
    if (!Number.isInteger(version) || version < 1) return;
    const ids = versionsByNumber.get(version) || new Set();
    ids.add(String(reference.questionId));
    versionsByNumber.set(version, ids);
  });

  const rows = [];
  for (const [version, ids] of versionsByNumber) {
    const values = [...ids];
    for (let offset = 0; offset < values.length; offset += 100) {
      const query = new URLSearchParams({
        select: 'question_id,version,content',
        version: `eq.${version}`,
        question_id: getInFilter(values.slice(offset, offset + 100)),
      });
      rows.push(...await fetchNormalizedQuestionRows(query, {
        start: 0,
        end: 99,
      }));
    }
  }
  return rows;
}

async function writeNormalizedAdminState(data) {
  requireSupabaseConfig();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/save_admin_state_and_question_versions`,
    {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_content: data }),
    },
  );
  if (!response.ok) throw await getResponseError(response);
}

function cachePersistentDocument(key, content) {
  const contentBytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
  if (contentBytes > PERSISTED_DOCUMENT_CACHE_MAX_BYTES) return;

  persistentDocumentCache.set(key, {
    content: structuredClone(content),
    expiresAt: Date.now() + PERSISTED_DOCUMENT_CACHE_TTL_MS,
  });
}

async function getResponseError(response) {
  const body = await response.text();
  const error = new Error(`Supabase storage request failed (${response.status}): ${body.slice(0, 300) || response.statusText}`);
  error.statusCode = 503;
  return error;
}

export async function readPersistentJson(filePath, fallback, readLocal) {
  const key = basename(filePath);
  if (!PERSISTED_DOCUMENTS.has(key)) return readLocal();
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') requireSupabaseConfig();
    return readLocal();
  }

  const cached = persistentDocumentCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.content);
  }

  const existingRequest = persistentDocumentRequests.get(key);
  if (existingRequest) return structuredClone(await existingRequest);

  const version = persistentDocumentVersions.get(key) || 0;
  const query = new URLSearchParams({ key: `eq.${key}`, select: 'content', limit: '1' });
  const request = (async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?${query}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw await getResponseError(response);

    const rows = await response.json();
    const storedContent = rows.length ? rows[0].content : fallback;
    const content = restorePersistedDocument(key, storedContent);
    if ((persistentDocumentVersions.get(key) || 0) === version) {
      cachePersistentDocument(key, content);
    }
    return content;
  })();
  persistentDocumentRequests.set(key, request);

  try {
    return structuredClone(await request);
  } finally {
    if (persistentDocumentRequests.get(key) === request) {
      persistentDocumentRequests.delete(key);
    }
  }
}

export async function readPersistentJsonItem(filePath, itemId, fallback, readLocal, idField = 'id') {
  const key = basename(filePath);
  if (!PERSISTED_DOCUMENTS.has(key)) {
    const collection = await readLocal();
    return collection.find((item) => item?.[idField] === itemId) ?? null;
  }
  if (!isSupabaseConfigured() && process.env.NODE_ENV === 'production') requireSupabaseConfig();

  const indexKey = `${key}:${idField}`;
  const cached = persistentCollectionIndexCache.get(indexKey);
  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.items.get(itemId) ?? null);
  }
  if (cached) persistentCollectionIndexCache.delete(indexKey);

  let request = persistentCollectionIndexRequests.get(indexKey);
  if (!request) {
    const version = persistentDocumentVersions.get(key) || 0;
    request = readPersistentJson(filePath, fallback, readLocal)
      .then((collection) => {
        if (!Array.isArray(collection)) {
          throw new TypeError(`Persistent JSON document "${key}" is not an array.`);
        }
        if (collection.length > PERSISTED_COLLECTION_INDEX_MAX_ITEMS) {
          return { collection, items: null };
        }
        const items = new Map();
        collection.forEach((item) => {
          if (item && !items.has(item[idField])) items.set(item[idField], item);
        });

        if ((persistentDocumentVersions.get(key) || 0) === version) {
          persistentCollectionIndexCache.set(indexKey, {
            items,
            expiresAt: Date.now() + PERSISTED_DOCUMENT_CACHE_TTL_MS,
          });
        }
        return { collection: null, items };
      })
      .finally(() => {
        if (persistentCollectionIndexRequests.get(indexKey) === request) {
          persistentCollectionIndexRequests.delete(indexKey);
        }
      });
    persistentCollectionIndexRequests.set(indexKey, request);
  }

  const { collection, items } = await request;
  const item = items
    ? items.get(itemId)
    : collection.find((entry) => entry?.[idField] === itemId);
  return structuredClone(item ?? null);
}

export async function readPersistentJsonItemsByField(
  filePath,
  fieldValue,
  fallback,
  readLocal,
  fieldName = 'seriesId',
) {
  const key = basename(filePath);
  if (!PERSISTED_DOCUMENTS.has(key)) {
    const collection = await readLocal();
    return collection.filter((item) => item?.[fieldName] === fieldValue);
  }
  if (!isSupabaseConfigured() && process.env.NODE_ENV === 'production') requireSupabaseConfig();

  const indexKey = `${key}:${fieldName}`;
  const cached = persistentCollectionIndexCache.get(indexKey);
  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.items.get(fieldValue) || []);
  }
  if (cached) persistentCollectionIndexCache.delete(indexKey);

  let request = persistentCollectionIndexRequests.get(indexKey);
  if (!request) {
    const version = persistentDocumentVersions.get(key) || 0;
    request = readPersistentJson(filePath, fallback, readLocal)
      .then((collection) => {
        if (!Array.isArray(collection)) {
          throw new TypeError(`Persistent JSON document "${key}" is not an array.`);
        }
        if (collection.length > PERSISTED_COLLECTION_INDEX_MAX_ITEMS) {
          return { collection, items: null };
        }
        const items = new Map();
        collection.forEach((item) => {
          if (!item || !Object.hasOwn(item, fieldName)) return;
          const matchingItems = items.get(item[fieldName]) || [];
          matchingItems.push(item);
          items.set(item[fieldName], matchingItems);
        });

        if ((persistentDocumentVersions.get(key) || 0) === version) {
          persistentCollectionIndexCache.set(indexKey, {
            items,
            expiresAt: Date.now() + PERSISTED_DOCUMENT_CACHE_TTL_MS,
          });
        }
        return { collection: null, items };
      })
      .finally(() => {
        if (persistentCollectionIndexRequests.get(indexKey) === request) {
          persistentCollectionIndexRequests.delete(indexKey);
        }
      });
    persistentCollectionIndexRequests.set(indexKey, request);
  }

  const { collection, items } = await request;
  const matchingItems = items
    ? items.get(fieldValue) || []
    : collection.filter((item) => item?.[fieldName] === fieldValue);
  return structuredClone(matchingItems);
}

function invalidatePersistentCollectionIndexes(key) {
  const indexKeyPrefix = `${key}:`;
  for (const indexKey of persistentCollectionIndexCache.keys()) {
    if (indexKey.startsWith(indexKeyPrefix)) persistentCollectionIndexCache.delete(indexKey);
  }
  for (const indexKey of persistentCollectionIndexRequests.keys()) {
    if (indexKey.startsWith(indexKeyPrefix)) persistentCollectionIndexRequests.delete(indexKey);
  }
}

export async function writePersistentJson(filePath, data, writeLocal) {
  const key = basename(filePath);
  if (!PERSISTED_DOCUMENTS.has(key)) return writeLocal();
  invalidatePersistentCollectionIndexes(key);
  if (key === 'admin-state.json' && normalizedQuestionStorageEnabled()) {
    requireSupabaseConfig();
    persistentDocumentVersions.set(key, (persistentDocumentVersions.get(key) || 0) + 1);
    persistentDocumentCache.delete(key);
    await writeNormalizedAdminState(data);
    persistentDocumentVersions.set(key, (persistentDocumentVersions.get(key) || 0) + 1);
    cachePersistentDocument(key, data);
    invalidatePersistentCollectionIndexes(key);
    return;
  }

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') requireSupabaseConfig();
    await writeLocal();
    invalidatePersistentCollectionIndexes(key);
    return;
  }

  persistentDocumentVersions.set(key, (persistentDocumentVersions.get(key) || 0) + 1);
  persistentDocumentCache.delete(key);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?on_conflict=key`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({
      key,
      content: key === 'tests.json' ? compactTestQuestionSolutions(data) : data,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw await getResponseError(response);

  persistentDocumentVersions.set(key, (persistentDocumentVersions.get(key) || 0) + 1);
  cachePersistentDocument(key, restorePersistedDocument(key, data));
  invalidatePersistentCollectionIndexes(key);
}

export async function storeUploadedImage(filename, contentType, buffer, writeLocal) {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') requireSupabaseConfig();
    return writeLocal();
  }

  const objectName = `${Date.now()}-${randomUUID()}-${filename}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(objectName)}`,
    {
      method: 'POST',
      headers: getHeaders({
        'Content-Type': contentType,
        'x-upsert': 'false',
      }),
      body: buffer,
    }
  );
  if (!response.ok) throw await getResponseError(response);

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${encodeURIComponent(objectName)}`;
}

export async function getPersistentStorageUsage() {
  requireSupabaseConfig();

  const contentQuery = new URLSearchParams({ select: 'key,content' });
  const contentResponse = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?${contentQuery}`, {
    headers: getHeaders(),
  });
  if (!contentResponse.ok) throw await getResponseError(contentResponse);
  const documents = await contentResponse.json();
  const adminContentBytes = documents.reduce(
    (total, document) => total + Buffer.byteLength(JSON.stringify(document.content), 'utf8'),
    0
  );

  const pageSize = 1000;
  let offset = 0;
  let uploadCount = 0;
  let uploadBytes = 0;
  while (true) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${STORAGE_BUCKET}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        prefix: '',
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!response.ok) throw await getResponseError(response);

    const objects = await response.json();
    if (!Array.isArray(objects)) {
      const error = new Error('Supabase Storage returned an invalid object listing.');
      error.statusCode = 503;
      throw error;
    }

    uploadCount += objects.length;
    uploadBytes += objects.reduce((total, object) => total + Number(object.metadata?.size || 0), 0);
    if (objects.length < pageSize) break;
    offset += objects.length;
  }

  return {
    bucket: STORAGE_BUCKET,
    uploadCount,
    uploadBytes,
    adminDocumentCount: documents.length,
    adminContentBytes,
    trackedBytes: uploadBytes + adminContentBytes,
    measuredAt: new Date().toISOString(),
  };
}

export async function getSupabaseConnectionStatus() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      database: { status: 'not_configured' },
      storage: { status: 'not_configured' },
      checkedAt: new Date().toISOString(),
    };
  }

  const checkService = async (label, url) => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        headers: getHeaders(),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error(`Supabase ${label} health check returned HTTP ${response.status}.`);
        return { status: 'error', statusCode: response.status, latencyMs: Date.now() - startedAt };
      }
      return { status: 'healthy', latencyMs: Date.now() - startedAt };
    } catch (error) {
      console.error(`Supabase ${label} health check failed.`, error);
      return {
        status: 'error',
        message: error?.name === 'AbortError' ? 'Health check timed out.' : 'Connection failed.',
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  };

  const [database, storage] = await Promise.all([
    checkService('database API', `${SUPABASE_URL}/rest/v1/admin_content?select=key&limit=1`),
    checkService('storage API', `${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`),
  ]);
  return {
    configured: true,
    database,
    storage,
    checkedAt: new Date().toISOString(),
  };
}
