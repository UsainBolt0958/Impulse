import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = Number(process.env.PORT || 4001);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_SESSION_COOKIE = 'impulse_admin_session';
const DATA_DIR = resolve(__dirname, 'data');
const STATE_FILE = resolve(DATA_DIR, 'admin-state.json');
const SERIES_FILE = resolve(DATA_DIR, 'series.json');
const TESTS_FILE = resolve(DATA_DIR, 'tests.json');
const QUESTIONS_FILE = resolve(DATA_DIR, 'engine-questions.json');
const UPLOADS_DIR = resolve(DATA_DIR, 'uploads');

const DEFAULT_STATE = {
  questions: [],
  exams: [],
  profile: {},
  activity: [],
};

async function ensureStateFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STATE_FILE, 'utf8');
  } catch {
    await writeFile(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }

  // Ensure engine files exist
  try {
    await readFile(SERIES_FILE, 'utf8');
  } catch {
    await writeFile(SERIES_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  try {
    await readFile(TESTS_FILE, 'utf8');
  } catch {
    await writeFile(TESTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  try {
    await readFile(QUESTIONS_FILE, 'utf8');
  } catch {
    await writeFile(QUESTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
}

async function readState() {
  await ensureStateFile();
  const raw = await readFile(STATE_FILE, 'utf8');

  try {
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state) {
  await ensureStateFile();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function sendFile(response, filePath, contentType = 'application/octet-stream') {
  readFile(filePath).then((buf) => {
    response.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      ...(contentType === 'image/svg+xml'
        ? {
            'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox",
          }
        : {}),
    });
    response.end(buf);
  }).catch(() => {
    sendJson(response, 404, { error: 'Not found' });
  });
}

function getImageContentType(filename) {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }[extension] || null;
}

function isSafeSvg(buffer) {
  const svg = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!/^\s*(?:<\?xml[^?]*\?>\s*)?<svg\b/i.test(svg)) return false;

  return !(
    /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(svg)
    || /\bon[a-z]+\s*=/i.test(svg)
    || /\b(?:href|xlink:href)\s*=\s*(["'])(?!#)[\s\S]*?\1/i.test(svg)
    || /\bsrc\s*=/i.test(svg)
    || /url\(\s*(?!#)/i.test(svg)
    || /@import|javascript\s*:/i.test(svg)
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((accumulator, pair) => {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey) return accumulator;
    accumulator[rawKey] = decodeURIComponent(rest.join('='));
    return accumulator;
  }, {});
}

function isAdminRequest(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  return cookies[ADMIN_SESSION_COOKIE] === ADMIN_PASSWORD;
}

function setAdminCookie(response, value) {
  response.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`);
}

function clearAdminCookie(response) {
  response.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/admin-session' && request.method === 'GET') {
    sendJson(response, 200, { authenticated: isAdminRequest(request) });
    return;
  }

  if (url.pathname === '/api/admin-login' && request.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody ? JSON.parse(rawBody) : {};

      if (body.password !== ADMIN_PASSWORD) {
        sendJson(response, 401, { authenticated: false, error: 'Invalid password' });
        return;
      }

      setAdminCookie(response, ADMIN_PASSWORD);
      sendJson(response, 200, { authenticated: true });
    } catch {
      sendJson(response, 400, { authenticated: false, error: 'Invalid JSON body' });
    }

    return;
  }

  if (url.pathname === '/api/admin-logout' && request.method === 'POST') {
    clearAdminCookie(response);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (url.pathname === '/api/questions' && request.method === 'GET') {
    const state = await readState();
    sendJson(response, 200, { questions: state.questions || [] });
    return;
  }

  // Serve uploaded files
  if (url.pathname.startsWith('/uploads/')) {
    let rel;
    try {
      rel = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    } catch {
      sendJson(response, 400, { error: 'Invalid upload path' });
      return;
    }
    if (!rel || rel !== rel.split(/[\\/]/).pop() || rel.includes('..')) {
      sendJson(response, 400, { error: 'Invalid upload path' });
      return;
    }
    const contentType = getImageContentType(rel);
    if (!contentType) {
      sendJson(response, 415, { error: 'Unsupported uploaded file type' });
      return;
    }
    return sendFile(response, resolve(UPLOADS_DIR, rel), contentType);
  }

  // Engine: list public series
  if (url.pathname === '/api/series' && request.method === 'GET') {
    const series = await readJsonFile(SERIES_FILE, []);
    const tests = await readJsonFile(TESTS_FILE, []);
    const enriched = series.map((item) => ({
      ...item,
      testCount: tests.filter((t) => t.seriesId === item.id).length,
    }));
    const includeAll = url.searchParams.get('all') === 'true';
    sendJson(response, 200, { series: includeAll ? enriched : enriched.filter((item) => item.published) });
    return;
  }

  // NEW: Get single series by ID
  if (url.pathname.startsWith('/api/series/') && !url.pathname.includes('/tests') && request.method === 'GET') {
    const seriesId = url.pathname.replace('/api/series/', '').split('?')[0];
    if (!seriesId || seriesId.includes('/')) {
      sendJson(response, 400, { error: 'Invalid series id' });
      return;
    }
    const series = await readJsonFile(SERIES_FILE, []);
    const tests = await readJsonFile(TESTS_FILE, []);
    const item = series.find(s => s.id === seriesId);
    if (!item) { sendJson(response, 404, { error: 'Series not found' }); return; }
    
    const enriched = {
      ...item,
      testCount: tests.filter((t) => t.seriesId === item.id).length,
    };
    sendJson(response, 200, enriched);
    return;
  }

  // Engine: create a series (admin)
  if (url.pathname === '/api/series' && request.method === 'POST') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const series = await readJsonFile(SERIES_FILE, []);
      const id = `series-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const next = {
        id,
        title: body.title || 'Untitled',
        description: body.description || '',
        published: Boolean(body.published),
        publish_at: body.publish_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      series.unshift(next);
      await writeJsonFile(SERIES_FILE, series);
      sendJson(response, 200, next);
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }

    return;
  }

  // Engine: update or delete a series (admin)
  if (url.pathname.startsWith('/api/series/') && (request.method === 'PUT' || request.method === 'DELETE')) {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }

    const seriesId = url.pathname.replace('/api/series/', '');
    if (!seriesId) { sendJson(response, 400, { error: 'Series id is required' }); return; }

    const series = await readJsonFile(SERIES_FILE, []);
    const index = series.findIndex((item) => item.id === seriesId);

    if (index === -1) {
      sendJson(response, 404, { error: 'Series not found' });
      return;
    }

    if (request.method === 'DELETE') {
      const removed = series[index];
      series.splice(index, 1);
      await writeJsonFile(SERIES_FILE, series);
      sendJson(response, 200, { success: true, removed });
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const next = {
        ...series[index],
        ...body,
        title: String(body.title ?? series[index].title ?? 'Untitled').trim() || 'Untitled',
        description: String(body.description ?? series[index].description ?? '').trim(),
        published: typeof body.published === 'boolean' ? body.published : series[index].published || false,
        publish_at: body.publish_at ?? series[index].publish_at ?? null,
        updated_at: new Date().toISOString(),
      };

      series[index] = next;
      await writeJsonFile(SERIES_FILE, series);
      sendJson(response, 200, next);
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }

    return;
  }

  // Engine: create or update tests
  if (url.pathname === '/api/tests' && request.method === 'POST') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const tests = await readJsonFile(TESTS_FILE, []);
      if (body.id) {
        const idx = tests.findIndex(t => t.id === body.id);
        if (idx !== -1) {
          const updated = { ...tests[idx], ...body, updated_at: new Date().toISOString() };
          // if published and editing, create a new version id
          if (tests[idx].published) {
            const newId = `test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            updated.id = newId;
            updated.created_at = new Date().toISOString();
            tests.unshift(updated);
            await writeJsonFile(TESTS_FILE, tests);
            sendJson(response, 200, updated);
            return;
          }

          tests[idx] = updated;
          await writeJsonFile(TESTS_FILE, tests);
          sendJson(response, 200, updated);
          return;
        }
      }

      const id = `test-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      // Support both durationMinutes (from admin UI) and durationSec (legacy)
      let durationSec = body.durationSec || 0;
      if (body.durationMinutes) {
        durationSec = body.durationMinutes * 60;
      }
      const next = { id, title: body.title || 'Untitled Test', seriesId: body.seriesId || null, sections: body.sections || [], durationSec: durationSec, durationMinutes: body.durationMinutes || undefined, published: body.published || false, publish_at: body.publish_at || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), meta: body.meta || {} };
      tests.unshift(next);
      await writeJsonFile(TESTS_FILE, tests);
      sendJson(response, 200, next);
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }

    return;
  }

  // Engine: get test template (public)
  if (url.pathname.startsWith('/api/tests/') && url.pathname.endsWith('/template') && request.method === 'GET') {
    const id = url.pathname.replace('/api/tests/', '').replace('/template', '');
    const tests = await readJsonFile(TESTS_FILE, []);
    const test = tests.find(t => t.id === id);
    if (!test) { sendJson(response, 404, { error: 'Not found' }); return; }
    sendJson(response, 200, test);
    return;
  }

  // Engine: question CRUD (admin)
  if (url.pathname === '/api/engine/questions' && request.method === 'POST') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const list = await readJsonFile(QUESTIONS_FILE, []);
      if (body.id) {
        const idx = list.findIndex(q => q.id === body.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...body, updated_at: new Date().toISOString() };
          await writeJsonFile(QUESTIONS_FILE, list);
          sendJson(response, 200, list[idx]);
          return;
        }
      }
      const id = `q-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const next = { id, type: body.type || 'mcq', text: body.text || '', media: body.media || [], options: body.options || [], correct: body.correct || null, sectionMetadata: body.sectionMetadata || {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      list.unshift(next);
      await writeJsonFile(QUESTIONS_FILE, list);
      sendJson(response, 200, next);
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  if (url.pathname === '/api/engine/questions' && request.method === 'GET') {
    const list = await readJsonFile(QUESTIONS_FILE, []);
    sendJson(response, 200, { questions: list });
    return;
  }

  if (url.pathname === '/api/uploads' && request.method === 'POST') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      // Expect { filename, data: base64, mime }
      if (
        typeof body.data !== 'string'
        || !body.data
        || typeof body.filename !== 'string'
        || !body.filename
      ) {
        sendJson(response, 400, { error: 'Missing data or filename' });
        return;
      }
      const contentType = getImageContentType(body.filename);
      if (!contentType) {
        sendJson(response, 415, { error: 'Only SVG, PNG, JPG, and WEBP images are supported' });
        return;
      }
      const expectedMime = contentType;
      const mimeAliases = contentType === 'image/jpeg' ? ['image/jpeg', 'image/jpg'] : [contentType];
      if (body.mime && !mimeAliases.includes(body.mime)) {
        sendJson(response, 415, { error: 'Image file extension and MIME type do not match' });
        return;
      }
      if (typeof body.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data)) {
        sendJson(response, 400, { error: 'Invalid base64 image data' });
        return;
      }
      if (body.data.length > Math.ceil(5 * 1024 * 1024 * 4 / 3) + 4) {
        sendJson(response, 413, { error: 'Image exceeds the 5 MB upload limit' });
        return;
      }
      const buf = Buffer.from(body.data, 'base64');
      if (buf.length > 5 * 1024 * 1024) {
        sendJson(response, 413, { error: 'Image exceeds the 5 MB upload limit' });
        return;
      }
      if (contentType === 'image/svg+xml' && !isSafeSvg(buf)) {
        sendJson(response, 400, { error: 'SVG contains unsupported or unsafe markup' });
        return;
      }
      const safeFilename = body.filename.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '');
      if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
        sendJson(response, 400, { error: 'Invalid image filename' });
        return;
      }
      const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeFilename}`;
      const outPath = resolve(UPLOADS_DIR, name);
      await writeFile(outPath, buf);
      const urlPath = `/uploads/${name}`;
      sendJson(response, 200, { url: urlPath, mime: expectedMime });
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  if (url.pathname === '/api/admin-state' && request.method === 'GET') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    const state = await readState();
    sendJson(response, 200, state);
    return;
  }

  if (url.pathname === '/api/admin-state' && request.method === 'PUT') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const chunks = [];

      for await (const chunk of request) {
        chunks.push(chunk);
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      const nextState = rawBody ? JSON.parse(rawBody) : DEFAULT_STATE;
      const normalized = {
        questions: Array.isArray(nextState.questions) ? nextState.questions : [],
        exams: Array.isArray(nextState.exams) ? nextState.exams : [],
        profile: nextState.profile && typeof nextState.profile === 'object' ? nextState.profile : {},
        activity: Array.isArray(nextState.activity) ? nextState.activity : [],
      };

      await writeState(normalized);
      sendJson(response, 200, normalized);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }

    return;
  }

  // NEW: Get all tests (admin)
  if (url.pathname === '/api/tests' && request.method === 'GET') {
    const tests = await readJsonFile(TESTS_FILE, []);
    const includeAll = url.searchParams.get('all') === 'true';
    const isAdmin = isAdminRequest(request);
    // For public requests (students), only return published tests
    const filtered = (includeAll || isAdmin) ? tests : tests.filter(t => t.published);
    sendJson(response, 200, { tests: filtered });
    return;
  }

  // NEW: Get single test by ID (admin)
  if (url.pathname.startsWith('/api/tests/') && !url.pathname.includes('/template') && request.method === 'GET') {
    const id = url.pathname.replace('/api/tests/', '').split('?')[0];
    if (!id || id.includes('/')) {
      sendJson(response, 400, { error: 'Invalid test id' });
      return;
    }
    const tests = await readJsonFile(TESTS_FILE, []);
    const test = tests.find(t => t.id === id);
    if (!test) { sendJson(response, 404, { error: 'Test not found' }); return; }
    sendJson(response, 200, test);
    return;
  }

  // NEW: Update single test by ID (admin)
  if (url.pathname.startsWith('/api/tests/') && !url.pathname.includes('/template') && request.method === 'PUT') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }

    const id = url.pathname.replace('/api/tests/', '');
    if (!id || id.includes('/')) { sendJson(response, 400, { error: 'Invalid test id' }); return; }

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const tests = await readJsonFile(TESTS_FILE, []);
      const idx = tests.findIndex(t => t.id === id);
      if (idx === -1) { sendJson(response, 404, { error: 'Test not found' }); return; }

      const updated = {
        ...tests[idx],
        ...body,
        id,
        updated_at: new Date().toISOString(),
      };

      tests[idx] = updated;
      await writeJsonFile(TESTS_FILE, tests);
      sendJson(response, 200, updated);
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  // NEW: Delete single test by ID (admin)
  if (url.pathname.startsWith('/api/tests/') && !url.pathname.includes('/template') && request.method === 'DELETE') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }

    const id = url.pathname.replace('/api/tests/', '');
    if (!id || id.includes('/')) { sendJson(response, 400, { error: 'Invalid test id' }); return; }

    const tests = await readJsonFile(TESTS_FILE, []);
    const idx = tests.findIndex(t => t.id === id);
    if (idx === -1) { sendJson(response, 404, { error: 'Test not found' }); return; }

    const removed = tests[idx];
    tests.splice(idx, 1);
    await writeJsonFile(TESTS_FILE, tests);
    sendJson(response, 200, { success: true, removed });
    return;
  }

  // NEW: Get tests for a specific series (admin)
  if (url.pathname.startsWith('/api/series/') && url.pathname.includes('/tests')) {
    const seriesId = url.pathname.split('/api/series/')[1].split('/')[0];
    if (!seriesId) { sendJson(response, 400, { error: 'Invalid series id' }); return; }

    const tests = await readJsonFile(TESTS_FILE, []);
    const seriesTests = tests.filter(t => t.seriesId === seriesId);
    sendJson(response, 200, { tests: seriesTests });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Impulse API running on http://localhost:${PORT}`);
});
