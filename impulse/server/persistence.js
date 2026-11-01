import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STORAGE_BUCKET = 'admin-uploads';
const PERSISTED_DOCUMENTS = new Set([
  'admin-state.json',
  'engine-questions.json',
  'quiz-challenges.json',
  'series.json',
  'tests.json',
]);

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

function getHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
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

  const query = new URLSearchParams({ key: `eq.${key}`, select: 'content', limit: '1' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?${query}`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw await getResponseError(response);

  const rows = await response.json();
  return rows.length ? rows[0].content : fallback;
}

export async function writePersistentJson(filePath, data, writeLocal) {
  const key = basename(filePath);
  if (!PERSISTED_DOCUMENTS.has(key)) return writeLocal();
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') requireSupabaseConfig();
    return writeLocal();
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?on_conflict=key`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({ key, content: data, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw await getResponseError(response);
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
