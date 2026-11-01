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
