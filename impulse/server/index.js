import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBillingOrder,
  getSeriesAccess,
  getSeriesAccessBatch,
  handleGatewayWebhook,
  refreshBillingOrder,
  verifyCustomerAccessToken,
} from './billing.js';
import {
  getPersistentStorageUsage,
  getSupabaseConnectionStatus,
  normalizedQuestionStorageEnabled,
  readPersistentJson,
  readPersistentJsonItem,
  readPersistentJsonItemsByField,
  readNormalizedCustomTestCatalogQuestions,
  readNormalizedQuestionCatalog,
  readNormalizedQuestionMetadata,
  readNormalizedQuestionPage,
  readCurrentNormalizedQuestionVersions,
  readNormalizedQuestionVersions,
  readNormalizedQuizCatalogQuestions,
  readNormalizedQuizQuestions,
  readNormalizedQuestions,
  readNormalizedQuestionsForSelection,
  storeUploadedImage,
  writePersistentJson,
} from './persistence.js';
import {
  collectTestQuestionReferences,
  compactVersionedTestQuestions,
  hydrateVersionedTestQuestions,
} from './versionedQuestionRefs.js';
import {
  getOrLoadCustomTestCatalog,
  getOrLoadQuestionCatalog,
  getOrLoadQuestionMetadata,
  getOrLoadQuestionPage,
  getOrLoadPrecomputedQuestionPage,
  getQuestionMetadataCacheVersion,
  invalidateQuestionMetadataCache,
} from './questionQuery.js';
import {
  getOrLoadQuizCatalog,
  getOrLoadQuizQuestions,
  getOrLoadQuizQuestionsForChapter,
  getQuizCatalogCacheVersion,
  invalidateQuizCatalogCache,
} from './quizCatalog.js';
import {
  CUSTOM_DIFFICULTIES,
  MAX_QUESTIONS_PER_SUBJECT,
  selectCustomTestQuestionsBySubject,
} from '../shared/customTestSelection.js';
import {
  getAssetMetrics,
  recordApiRequest,
  recordStorageMeasurement,
  recordVisitorHeartbeat,
} from './assetMetrics.js';
import { getSupabaseProjectMetrics } from './supabaseProjectMetrics.js';
import {
  getOrLoadPublicCatalog,
  getTestCountsBySeries,
  invalidatePublicCatalogCache,
  paginatePublicTestCatalog,
} from './publicCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = Number(process.env.PORT || 4001);
const ADMIN_SESSION_COOKIE = 'impulse_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const ADMIN_SESSIONS = new Map();
const EXAM_SESSION_COOKIE = 'impulse_exam_session';
const EXAM_SESSION_MAX_AGE_SECONDS = 6 * 60 * 60;
const EXAM_SESSIONS = new Map();
const APPROVED_ADMIN_EMAILS = new Set([
  'yashbharati81@gmail.com',
  'impulsepreps@gmail.com',
]);
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_ALLOWED_ORIGINS = new Set(
  (process.env.ADMIN_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4000,http://127.0.0.1:3000,http://127.0.0.1:4000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const DATA_DIR = resolve(__dirname, 'data');
const STATE_FILE = resolve(DATA_DIR, 'admin-state.json');
const SERIES_FILE = resolve(DATA_DIR, 'series.json');
const TESTS_FILE = resolve(DATA_DIR, 'tests.json');
const QUESTIONS_FILE = resolve(DATA_DIR, 'engine-questions.json');
const QUIZ_CHALLENGES_FILE = resolve(DATA_DIR, 'quiz-challenges.json');
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
  const state = await readJsonFile(STATE_FILE, DEFAULT_STATE);
  if (!normalizedQuestionStorageEnabled()) return state;
  return {
    ...state,
    questions: await readNormalizedQuestions(),
  };
}

async function readQuestions() {
  if (normalizedQuestionStorageEnabled()) return readNormalizedQuestions();
  const state = await readState();
  return state.questions || [];
}

async function writeState(state) {
  await ensureStateFile();
  await writeJsonFile(STATE_FILE, state);
  invalidateQuizCatalogCache();
  invalidateQuestionMetadataCache();
}

async function readJsonFile(filePath, fallback) {
  return readPersistentJson(filePath, fallback, () => readLocalJsonFile(filePath, fallback));
}

async function readJsonFileItem(filePath, id) {
  return readPersistentJsonItem(filePath, id, [], () => readLocalJsonFile(filePath, []));
}

async function readJsonFileItemsByField(filePath, fieldValue, fieldName = 'seriesId') {
  return readPersistentJsonItemsByField(
    filePath,
    fieldValue,
    [],
    () => readLocalJsonFile(filePath, []),
    fieldName,
  );
}

async function readLocalJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getTestQuestionEntries(test) {
  return (test?.sections || []).flatMap((section) => (
    Array.isArray(section?.questions) ? section.questions : []
  ));
}

async function compactVersionedTest(test) {
  const questions = getTestQuestionEntries(test);
  const canCreateReferences = normalizedQuestionStorageEnabled();
  const questionIds = canCreateReferences ? [...new Set(questions
    .filter((question) => !question?.questionRef && typeof question?.id === 'string')
    .map((question) => question.id))] : [];
  const references = collectTestQuestionReferences(test);
  if (!canCreateReferences && references.length === 0) return test;
  const [currentRows, referencedRows] = await Promise.all([
    questionIds.length ? readCurrentNormalizedQuestionVersions(questionIds) : [],
    references.length ? readNormalizedQuestionVersions(references) : [],
  ]);
  return compactVersionedTestQuestions(test, currentRows, referencedRows);
}

async function hydrateVersionedTests(tests) {
  const references = tests.flatMap(collectTestQuestionReferences);
  if (references.length === 0) return tests;
  const rows = await readNormalizedQuestionVersions(references);
  return tests.map((test) => hydrateVersionedTestQuestions(test, rows));
}

async function writeJsonFile(filePath, data) {
  await writePersistentJson(filePath, data, async () => {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  });
  if ([SERIES_FILE, TESTS_FILE].includes(filePath)) invalidatePublicCatalogCache();
}

let quizChallenges = [];
let quizChallengesLoaded = false;
let quizChallengeOperations = Promise.resolve();

function updateQuizChallenges(operation) {
  const result = quizChallengeOperations.then(async () => {
    if (!quizChallengesLoaded) {
      await mkdir(DATA_DIR, { recursive: true });
      const saved = await readJsonFile(QUIZ_CHALLENGES_FILE, []);
      quizChallenges = Array.isArray(saved) ? saved : [];
      quizChallengesLoaded = true;
    }

    const previousState = JSON.stringify(quizChallenges);
    const value = await operation(quizChallenges);
    if (JSON.stringify(quizChallenges) !== previousState) {
      await writeJsonFile(QUIZ_CHALLENGES_FILE, quizChallenges);
    }
    return value;
  });
  quizChallengeOperations = result.then(() => undefined, () => undefined);
  return result;
}

function advanceQuizQuestion(challenge, now = Date.now()) {
  if (challenge.status !== 'playing') return false;
  const answers = challenge.answers[challenge.questionIndex] || {};
  const allAnswered = challenge.players.every((player) => Boolean(answers[player.id]));
  const timedOut = now >= challenge.questionStartedAt + challenge.secondsPerQuestion * 1000;
  if (!allAnswered && !timedOut) return false;

  if (challenge.questionIndex + 1 >= challenge.questions.length) {
    challenge.status = 'completed';
    challenge.completedAt = now;
  } else {
    challenge.questionIndex += 1;
    challenge.questionStartedAt = now;
  }
  return true;
}

function serializeQuizChallenge(challenge, playerId, now = Date.now()) {
  const currentQuestion = challenge.status === 'playing'
    ? challenge.questions[challenge.questionIndex]
    : null;
  const answers = challenge.answers[challenge.questionIndex] || {};
  const currentPlayer = challenge.players.find((player) => player.id === playerId);

  return {
    id: challenge.id,
    playerToken: currentPlayer?.token || null,
    status: challenge.status,
    subject: challenge.subject,
    chapter: challenge.chapter,
    questionCount: challenge.questions.length,
    secondsPerQuestion: challenge.secondsPerQuestion,
    questionIndex: challenge.questionIndex,
    questionStartedAt: challenge.questionStartedAt,
    serverTime: now,
    inviteeName: challenge.inviteeName,
    players: challenge.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      correctAnswers: player.correctAnswers,
      answered: Boolean(answers[player.id]),
      isCurrentPlayer: player.id === playerId,
    })),
    currentQuestion: currentQuestion ? {
      id: currentQuestion.id,
      question: currentQuestion.question,
      image: currentQuestion.image,
      options: currentQuestion.options,
    } : null,
    completedAt: challenge.completedAt || null,
  };
}

function findQuizChallenge(challenges, id) {
  return challenges.find((challenge) => challenge.id === id);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function readRequestBody(request, maxBytes = Infinity) {
  const chunks = [];
  let bytesRead = 0;
  for await (const chunk of request) {
    bytesRead += chunk.length;
    if (bytesRead > maxBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

function sendQuizRequestError(response, error, message) {
  if (error?.statusCode === 400) {
    sendJson(response, 400, { error: error.message });
    return;
  }
  console.error(message, error);
  sendJson(response, 500, { error: message });
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
  });
  response.end(JSON.stringify(payload));
}

function sendJsonBodyError(response, error) {
  if (Number.isInteger(error?.statusCode)) {
    console.error('Persistent admin storage request failed.', error);
    sendJson(response, error.statusCode, { error: error.message });
    return;
  }
  sendJson(response, 400, { error: 'Invalid JSON body' });
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin || !ADMIN_ALLOWED_ORIGINS.has(origin)) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Session');
  response.setHeader('Vary', 'Origin');
  return true;
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((accumulator, pair) => {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey) return accumulator;
    accumulator[rawKey] = decodeURIComponent(rest.join('='));
    return accumulator;
  }, {});
}

function createAdminSession(email) {
  const token = randomBytes(32).toString('base64url');
  ADMIN_SESSIONS.set(token, {
    email,
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });
  return token;
}

function getAdminSession(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) return null;
  const session = ADMIN_SESSIONS.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    ADMIN_SESSIONS.delete(token);
    return null;
  }
  return session;
}

function isAdminRequest(request) {
  return Boolean(getAdminSession(request));
}

function createExamSession(userId) {
  const now = Date.now();
  for (const [token, session] of EXAM_SESSIONS) {
    if (session.expiresAt <= now) EXAM_SESSIONS.delete(token);
  }
  const token = randomBytes(32).toString('base64url');
  EXAM_SESSIONS.set(token, {
    userId,
    expiresAt: now + EXAM_SESSION_MAX_AGE_SECONDS * 1000,
  });
  return token;
}

function getExamSession(request) {
  const token = parseCookies(request.headers.cookie || '')[EXAM_SESSION_COOKIE];
  if (!token) return null;
  const session = EXAM_SESSIONS.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    EXAM_SESSIONS.delete(token);
    return null;
  }
  return { token, ...session };
}

function setExamCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.ADMIN_COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  response.setHeader(
    'Set-Cookie',
    `${EXAM_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${EXAM_SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=${sameSite}${secure}`
  );
}

function clearExamCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.ADMIN_COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  response.setHeader(
    'Set-Cookie',
    `${EXAM_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure}`
  );
}

function publicSeriesSummary(series) {
  const sections = Array.isArray(series.sections) ? series.sections : [];
  return {
    id: series.id,
    title: series.title,
    description: series.description || '',
    published: Boolean(series.published),
    publish_at: series.publish_at || null,
    durationMinutes: series.durationMinutes,
    subjects: Array.isArray(series.subjects) ? series.subjects : [],
    rankMapping: series.rankMapping,
    backgroundImage: series.backgroundImage,
    meta: series.meta || {},
    sections: sections.map((section) => ({
      subject: section.subject,
      sectionName: section.sectionName,
      name: section.name,
      type: section.type,
      posMarks: section.posMarks,
      negMarks: section.negMarks,
      questionCountPerSubject: section.questionCountPerSubject,
      questionCount: section.questionCount,
    })),
  };
}

function publicTestSummary(test) {
  const sections = Array.isArray(test.sections) ? test.sections : [];
  const subjects = Array.isArray(test.subjects)
    ? test.subjects
    : [...new Set(sections.map((section) => section.subject).filter(Boolean))];
  return {
    id: test.id,
    title: test.title,
    name: test.name,
    seriesId: test.seriesId,
    published: Boolean(test.published),
    publish_at: test.publish_at || null,
    durationMinutes: test.durationMinutes,
    durationSec: test.durationSec,
    questionCount: sections.reduce((total, section) => (
      total + (Array.isArray(section.questions)
        ? section.questions.length
        : Number(section.questionCountPerSubject || section.questionCount || 0))
    ), 0),
    subjects,
    meta: test.meta || {},
  };
}

async function requestHasSeriesAccess(request, seriesId) {
  if (isAdminRequest(request)) return true;
  const session = getExamSession(request);
  if (!session) return false;
  const access = await getSeriesAccess(session.userId, seriesId);
  return access.allowed;
}

function sendBillingError(response, error, defaultMessage) {
  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : /^(Enter a valid|Choose a valid|This subscription|This test series|Unsupported product|You already own)/i.test(error?.message || '')
      ? 400
      : 503;
  if (statusCode >= 500) console.error(defaultMessage, error);
  sendJson(response, statusCode, {
    error: statusCode < 500 ? error.message : defaultMessage,
  });
}

function setAdminCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.ADMIN_COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  response.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=${sameSite}${secure}`
  );
}

function clearAdminCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.ADMIN_COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  response.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secure}`
  );
}

async function authenticateAdminAccessToken(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase authentication is not configured on the admin API.');
  }
  if (typeof accessToken !== 'string' || !accessToken.trim()) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;

  const user = await response.json();
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  const hasGoogleIdentity = Array.isArray(user.identities)
    && user.identities.some((identity) => identity?.provider === 'google');
  if (
    !email
    || !APPROVED_ADMIN_EMAILS.has(email)
    || !user.email_confirmed_at
    || !hasGoogleIdentity
  ) {
    return null;
  }
  return email;
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const originAllowed = applyCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    if (request.headers.origin && !originAllowed) {
      sendJson(response, 403, { error: 'Origin is not allowed.' });
      return;
    }
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/billing/webhook' && request.method === 'POST') {
    try {
      const payload = await readRequestBody(request, 16 * 1024);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        sendJson(response, 400, { error: 'The webhook body must be a JSON object.' });
        return;
      }
      await handleGatewayWebhook(payload);
      sendJson(response, 200, { received: true });
    } catch (error) {
      sendBillingError(response, error, 'Could not verify the payment notification.');
    }
    return;
  }

  if (url.pathname === '/api/billing/orders' && request.method === 'POST') {
    try {
      const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to continue to checkout.' });
        return;
      }

      const body = await readRequestBody(request, 16 * 1024);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'The request body must be a JSON object.' });
        return;
      }
      if (body.productType === 'test_series') {
        const seriesId = typeof body.seriesId === 'string' ? body.seriesId.trim() : '';
        const series = await readJsonFile(SERIES_FILE, []);
        if (!seriesId || !series.some((item) => item.id === seriesId && item.published)) {
          sendJson(response, 400, { error: 'Choose a published test series.' });
          return;
        }
      }
      const order = await createBillingOrder({
        userId: user.id,
        productType: body.productType,
        planCode: body.planCode,
        durationMonths: body.durationMonths,
        seriesId: body.seriesId,
        mobile: body.mobile,
      });
      sendJson(response, 201, order);
    } catch (error) {
      sendBillingError(response, error, 'Could not create a payment order.');
    }
    return;
  }

  if (url.pathname.startsWith('/api/billing/orders/') && request.method === 'GET') {
    const orderId = url.pathname.slice('/api/billing/orders/'.length);
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(orderId)) {
      sendJson(response, 400, { error: 'Invalid payment order id.' });
      return;
    }
    try {
      const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to check your payment.' });
        return;
      }
      const order = await refreshBillingOrder(orderId, user.id);
      if (!order) {
        sendJson(response, 404, { error: 'Payment order not found.' });
        return;
      }
      sendJson(response, 200, {
        orderId: order.order_id,
        productType: order.product_type,
        planCode: order.plan_code,
        durationMonths: order.duration_months,
        seriesId: order.series_id,
        amountInr: order.amount_inr,
        status: order.status,
        createdAt: order.created_at,
        expiresAt: order.expires_at,
        paidAt: order.paid_at,
      });
    } catch (error) {
      sendBillingError(response, error, 'Could not check the payment status.');
    }
    return;
  }

  if (url.pathname === '/api/billing/exam-session' && request.method === 'POST') {
    try {
      const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to access this test.' });
        return;
      }
      const body = await readRequestBody(request, 16 * 1024);
      const seriesId = typeof body?.seriesId === 'string' ? body.seriesId.trim() : '';
      if (!seriesId || seriesId.length > 200) {
        sendJson(response, 400, { error: 'A valid test series id is required.' });
        return;
      }
      const series = await readJsonFile(SERIES_FILE, []);
      if (!series.some((item) => item.id === seriesId && item.published)) {
        sendJson(response, 404, { error: 'This test series is not available.' });
        return;
      }
      const access = await getSeriesAccess(user.id, seriesId);
      if (!access.allowed) {
        sendJson(response, 403, {
          error: 'Purchase this test series before opening its tests.',
          reason: access.reason,
          priceInr: access.price_inr,
        });
        return;
      }
      const previousSession = getExamSession(request);
      if (previousSession) EXAM_SESSIONS.delete(previousSession.token);
      setExamCookie(response, createExamSession(user.id));
      sendJson(response, 200, { authorized: true });
    } catch (error) {
      sendBillingError(response, error, 'Could not authorize this test session.');
    }
    return;
  }

  if (url.pathname === '/api/billing/series-access' && request.method === 'GET') {
    try {
      const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to check test-series access.' });
        return;
      }
      const seriesId = url.searchParams.get('seriesId') || '';
      if (!seriesId || seriesId.length > 200) {
        sendJson(response, 400, { error: 'A valid test series id is required.' });
        return;
      }
      const access = await getSeriesAccess(user.id, seriesId);
      sendJson(response, 200, access);
    } catch (error) {
      sendBillingError(response, error, 'Could not check test-series access.');
    }
    return;
  }

  if (url.pathname === '/api/billing/series-access/batch' && request.method === 'POST') {
    try {
      const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to check test-series access.' });
        return;
      }
      const body = await readRequestBody(request, 16 * 1024);
      if (!Array.isArray(body?.seriesIds) || body.seriesIds.length < 1 || body.seriesIds.length > 50) {
        sendJson(response, 400, { error: 'Provide between 1 and 50 valid test-series IDs.' });
        return;
      }
      const seriesIds = [...new Set(body.seriesIds)];
      if (seriesIds.some((seriesId) => (
        typeof seriesId !== 'string' || !seriesId.trim() || seriesId.trim().length > 200
      ))) {
        sendJson(response, 400, { error: 'Provide between 1 and 50 valid test-series IDs.' });
        return;
      }
      const normalizedSeriesIds = seriesIds.map((seriesId) => seriesId.trim());
      const accessBySeriesId = await getSeriesAccessBatch(user.id, normalizedSeriesIds);
      sendJson(response, 200, { accessBySeriesId });
    } catch (error) {
      sendBillingError(response, error, 'Could not check test-series access.');
    }
    return;
  }

  if (url.pathname === '/api/billing/exam-session' && request.method === 'DELETE') {
    const session = getExamSession(request);
    if (session) EXAM_SESSIONS.delete(session.token);
    clearExamCookie(response);
    sendJson(response, 200, { authorized: false });
    return;
  }

  if (url.pathname === '/api/admin-session' && request.method === 'GET') {
    const session = getAdminSession(request);
    sendJson(response, 200, { authenticated: Boolean(session), email: session?.email || null });
    return;
  }

  if (url.pathname === '/api/admin/storage-usage' && request.method === 'GET') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    try {
      const usage = await getPersistentStorageUsage();
      recordStorageMeasurement(usage.uploadBytes, usage.measuredAt);
      sendJson(response, 200, {
        ...usage,
        storageTrend: getAssetMetrics().storageTrend,
      });
    } catch (error) {
      console.error('Could not load admin storage usage.', error);
      sendJson(response, error?.statusCode || 503, {
        error: error?.statusCode ? error.message : 'Could not load storage usage.',
      });
    }
    return;
  }

  if (url.pathname === '/api/telemetry/heartbeat' && request.method === 'POST') {
    const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
    if (!accessToken) {
      sendJson(response, 401, { error: 'Sign in to report active-session metrics.' });
      return;
    }
    try {
      const user = await verifyCustomerAccessToken(accessToken);
      if (!user) {
        sendJson(response, 401, { error: 'Sign in to report active-session metrics.' });
        return;
      }
      recordVisitorHeartbeat(request.headers['x-client-session'], user.id);
      sendJson(response, 200, { recorded: true });
    } catch (error) {
      console.error('Could not validate an active-session heartbeat.', error);
      sendJson(response, error?.statusCode || 503, {
        error: error?.statusCode ? error.message : 'Active-session verification is unavailable.',
      });
    }
    return;
  }

  if (url.pathname === '/api/admin/asset-metrics' && request.method === 'GET') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    sendJson(response, 200, getAssetMetrics());
    return;
  }

  if (url.pathname === '/api/admin/operations' && request.method === 'GET') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    sendJson(response, 200, {
      api: {
        status: 'healthy',
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memoryBytes: process.memoryUsage().rss,
        checkedAt: new Date().toISOString(),
      },
      supabase: await getSupabaseConnectionStatus(),
      backups: { status: 'not_available', message: 'Backup status is not exposed by the configured API credentials.' },
    });
    return;
  }

  if (url.pathname === '/api/admin/project-metrics' && request.method === 'GET') {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    sendJson(response, 200, await getSupabaseProjectMetrics());
    return;
  }

  if (url.pathname === '/api/admin-login' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { authenticated: false, error: 'The request body must be a JSON object.' });
        return;
      }
      const email = await authenticateAdminAccessToken(body.accessToken);
      if (!email) {
        sendJson(response, 403, { authenticated: false, error: 'No admin access.' });
        return;
      }

      setAdminCookie(response, createAdminSession(email));
      sendJson(response, 200, { authenticated: true, email });
    } catch (error) {
      const status = error?.statusCode === 400 ? 400 : 503;
      console.error('Could not establish an admin session.', error);
      sendJson(response, status, {
        authenticated: false,
        error: status === 400 ? error.message : 'Admin sign-in verification is unavailable.',
      });
    }

    return;
  }

  if (url.pathname === '/api/admin-logout' && request.method === 'POST') {
    const token = parseCookies(request.headers.cookie || '')[ADMIN_SESSION_COOKIE];
    if (token) ADMIN_SESSIONS.delete(token);
    clearAdminCookie(response);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (url.pathname === '/api/questions/custom-test/catalog' && request.method === 'GET') {
    const cacheVersion = getQuestionMetadataCacheVersion();
    const exams = await getOrLoadCustomTestCatalog(async () => {
      return normalizedQuestionStorageEnabled()
        ? readNormalizedCustomTestCatalogQuestions()
        : readQuestions();
    }, cacheVersion);
    sendJson(response, 200, {
      exams,
    });
    return;
  }

  if (url.pathname === '/api/questions/custom-test' && request.method === 'POST') {
    let body;
    try {
      body = await readRequestBody(request, 64 * 1024);
    } catch (error) {
      sendJson(response, error?.statusCode || 400, { error: error.message });
      return;
    }

    const subjects = body?.subjects;
    const validSubject = (subject) => (
      subject
      && typeof subject.name === 'string'
      && subject.name.trim().length > 0
      && subject.name.length <= 100
      && Array.isArray(subject.chapters)
      && subject.chapters.length > 0
      && subject.chapters.length <= 100
      && subject.chapters.every((chapter) => (
        typeof chapter === 'string' && chapter.trim().length > 0 && chapter.length <= 200
      ))
      && Number.isInteger(subject.count)
      && subject.count >= 1
      && subject.count <= MAX_QUESTIONS_PER_SUBJECT
    );
    if (
      !body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.exam !== 'string' || !body.exam.trim() || body.exam.length > 100
      || !Array.isArray(subjects) || subjects.length < 1 || subjects.length > 20
      || !subjects.every(validSubject)
      || new Set(subjects.map((subject) => subject.name.trim())).size !== subjects.length
      || !Array.isArray(body.years) || body.years.length < 1 || body.years.length > 100
      || !body.years.every((year) => typeof year === 'string' && year.trim().length > 0 && year.length <= 20)
      || !CUSTOM_DIFFICULTIES.some((option) => option.id === body.difficulty)
    ) {
      sendJson(response, 400, { error: 'Provide a valid exam, subjects, chapters, years, and difficulty.' });
      return;
    }

    const sourceQuestions = normalizedQuestionStorageEnabled()
      ? await readNormalizedQuestionsForSelection({
        exam: body.exam.trim(),
        subjects: subjects.map((subject) => subject.name.trim()),
        chapters: [...new Set(subjects.flatMap((subject) => subject.chapters.map((chapter) => chapter.trim())))],
        years: body.years.map((year) => year.trim()),
        difficulty: body.difficulty,
      })
      : await readQuestions();
    const questions = selectCustomTestQuestionsBySubject({
      questions: sourceQuestions,
      exam: body.exam.trim(),
      subjects: subjects.map((subject) => ({
        ...subject,
        name: subject.name.trim(),
        chapters: subject.chapters.map((chapter) => chapter.trim()),
      })),
      years: body.years.map((year) => year.trim()),
      difficulty: body.difficulty,
    });

    if (!questions.length) {
      sendJson(response, 400, { error: 'There are no questions for the selected chapters and years.' });
      return;
    }

    sendJson(response, 200, {
      questions,
    });
    return;
  }

  if (url.pathname === '/api/questions/metadata' && request.method === 'GET') {
    const ids = url.searchParams.getAll('id');
    if (!ids.length || ids.length > 200 || ids.some((id) => !id.trim())) {
      sendJson(response, 400, { error: 'Provide between 1 and 200 non-empty question IDs.' });
      return;
    }

    const cacheVersion = getQuestionMetadataCacheVersion();
    const questions = await getOrLoadQuestionMetadata(
      ids,
      normalizedQuestionStorageEnabled() ? readNormalizedQuestionMetadata : readQuestions,
      cacheVersion,
    );
    sendJson(response, 200, {
      questions,
    });
    return;
  }

  if (url.pathname === '/api/questions/versions' && request.method === 'POST') {
    const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1];
    let user;
    try {
      user = await verifyCustomerAccessToken(accessToken);
    } catch (error) {
      console.error('Could not verify access to historical question versions.', error);
      sendJson(response, 503, { error: 'Question version access is temporarily unavailable.' });
      return;
    }
    if (!user) {
      sendJson(response, 401, { error: 'Sign in to review saved question versions.' });
      return;
    }

    let body;
    try {
      body = await readRequestBody(request, 64 * 1024);
    } catch (error) {
      sendJson(response, error?.statusCode || 400, { error: error.message });
      return;
    }

    const references = body?.references;
    if (
      !body || typeof body !== 'object' || Array.isArray(body)
      || !Array.isArray(references) || references.length < 1 || references.length > 200
      || references.some((reference) => (
        !reference || typeof reference.questionId !== 'string'
        || !reference.questionId.trim() || reference.questionId.length > 500
        || !Number.isInteger(reference.version) || reference.version < 1
      ))
    ) {
      sendJson(response, 400, { error: 'Provide between 1 and 200 valid question version references.' });
      return;
    }
    const uniqueReferences = [...new Map(references.map((reference) => [
      `${reference.questionId}:${reference.version}`,
      reference,
    ])).values()];
    const rows = await readNormalizedQuestionVersions(uniqueReferences);
    const found = new Set(rows
      .filter((row) => row.content?.id === row.question_id)
      .map((row) => `${row.question_id}:${row.version}`));
    const missing = uniqueReferences.filter((reference) => (
      !found.has(`${reference.questionId}:${reference.version}`)
    ));
    if (missing.length > 0) {
      sendJson(response, 503, { error: 'One or more saved question versions are unavailable.' });
      return;
    }
    response.setHeader('Cache-Control', 'private, no-store');
    sendJson(response, 200, {
      questions: rows.map((row) => ({
        questionId: row.question_id,
        version: row.version,
        content: {
          question_text: row.content.question_text || row.content.question || row.content.text || '',
          explanation: row.content.explanation || row.content.solution || '',
        },
      })),
    });
    return;
  }

  if (url.pathname === '/api/questions/catalog' && request.method === 'GET') {
    const exam = url.searchParams.get('exam')?.trim();
    const subject = url.searchParams.get('subject')?.trim();
    if (!exam || !subject) {
      sendJson(response, 400, { error: 'Provide both exam and subject to load the question catalog.' });
      return;
    }

    const cacheVersion = getQuestionMetadataCacheVersion();
    const chapters = await getOrLoadQuestionCatalog(exam, subject, async () => {
      return normalizedQuestionStorageEnabled()
        ? readNormalizedQuestionCatalog(exam, subject)
        : readQuestions();
    }, cacheVersion);
    sendJson(response, 200, {
      chapters,
    });
    return;
  }

  if (url.pathname === '/api/questions' && request.method === 'GET') {
    const filters = {
      exam: url.searchParams.getAll('exam'),
      subject: url.searchParams.getAll('subject'),
      chapter: url.searchParams.getAll('chapter'),
      difficulty: url.searchParams.getAll('difficulty'),
      year: url.searchParams.getAll('year'),
    };
    const hasFilters = Object.values(filters).some((values) => values.length > 0);
    const hasPagination = url.searchParams.has('page') || url.searchParams.has('limit');

    if (hasFilters || hasPagination) {
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 20);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        sendJson(response, 400, { error: 'Page must be a positive integer and limit must be between 1 and 100.' });
        return;
      }

      const cacheVersion = getQuestionMetadataCacheVersion();
      const questionPage = normalizedQuestionStorageEnabled()
        ? await getOrLoadPrecomputedQuestionPage(
          filters,
          page,
          limit,
          () => readNormalizedQuestionPage(filters, page, limit),
          cacheVersion,
        )
        : await getOrLoadQuestionPage(filters, page, limit, readQuestions, cacheVersion);
      sendJson(response, 200, questionPage);
      return;
    }

    sendJson(response, 200, { questions: await readQuestions() });
    return;
  }

  if (url.pathname === '/api/quiz/catalog' && request.method === 'GET') {
    const cacheVersion = getQuizCatalogCacheVersion();
    const subjects = await getOrLoadQuizCatalog(async () => {
      return normalizedQuestionStorageEnabled()
        ? readNormalizedQuizCatalogQuestions()
        : readQuestions();
    }, cacheVersion);
    sendJson(response, 200, { subjects });
    return;
  }

  if (url.pathname === '/api/quiz/challenges' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'The request body must be a JSON object.' });
        return;
      }

      const {
        hostId,
        hostName,
        inviteeName,
        subject,
        chapter,
        questionCount,
        secondsPerQuestion,
      } = body;

      if (
        typeof hostId !== 'string' || !hostId.trim()
        || typeof hostName !== 'string' || !hostName.trim()
        || typeof inviteeName !== 'string' || !inviteeName.trim()
        || typeof subject !== 'string' || !subject.trim()
        || typeof chapter !== 'string' || !chapter.trim()
        || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50
        || !Number.isInteger(secondsPerQuestion) || secondsPerQuestion < 10 || secondsPerQuestion > 120
      ) {
        sendJson(response, 400, { error: 'Provide valid players, subject, chapter, question count, and timer settings.' });
        return;
      }

      const cacheVersion = getQuizCatalogCacheVersion();
      const availableQuestions = normalizedQuestionStorageEnabled()
        ? await getOrLoadQuizQuestionsForChapter(
          () => readNormalizedQuizQuestions(subject, chapter),
          subject,
          chapter,
          cacheVersion,
        )
        : await getOrLoadQuizQuestions(
          readQuestions,
          subject,
          chapter,
          cacheVersion,
        );
      if (availableQuestions.length < questionCount) {
        sendJson(response, 400, { error: `Only ${availableQuestions.length} playable question(s) are available for this chapter.` });
        return;
      }

      const selectedQuestions = shuffle(availableQuestions).slice(0, questionCount);
      const challenge = {
        id: randomUUID(),
        status: 'waiting',
        subject: subject.trim(),
        chapter: chapter.trim(),
        inviteeName: inviteeName.trim().slice(0, 60),
        secondsPerQuestion,
        questionIndex: 0,
        questionStartedAt: null,
        questions: selectedQuestions,
        answers: [],
        players: [{
          id: hostId.trim().slice(0, 100),
          token: randomUUID(),
          name: hostName.trim().slice(0, 60),
          score: 0,
          correctAnswers: 0,
        }],
        createdAt: Date.now(),
      };

      await updateQuizChallenges((challenges) => {
        challenges.push(challenge);
      });
      sendJson(response, 201, serializeQuizChallenge(challenge, challenge.players[0].id));
    } catch (error) {
      sendQuizRequestError(response, error, 'The quiz challenge could not be created.');
    }
    return;
  }

  const quizChallengeRoute = url.pathname.match(/^\/api\/quiz\/challenges\/([^/]+)(?:\/(join|answer))?$/);
  if (quizChallengeRoute) {
    let challengeId;
    try {
      challengeId = decodeURIComponent(quizChallengeRoute[1]);
    } catch {
      sendJson(response, 400, { error: 'Invalid challenge id.' });
      return;
    }
    const action = quizChallengeRoute[2];

    if (action === 'join' && request.method === 'POST') {
      try {
        const body = await readRequestBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(response, 400, { error: 'The request body must be a JSON object.' });
          return;
        }
        if (typeof body.playerId !== 'string' || !body.playerId.trim()) {
          sendJson(response, 400, { error: 'A player id is required to join the challenge.' });
          return;
        }
        const result = await updateQuizChallenges((challenges) => {
          const challenge = findQuizChallenge(challenges, challengeId);
          if (!challenge) return { statusCode: 404, error: 'Challenge not found.' };
          const existingPlayer = challenge.players.find((player) => player.id === body.playerId.trim());
          if (existingPlayer) {
            if (existingPlayer.token !== body.playerToken) {
              return { statusCode: 403, error: 'This player session is not authorized for the challenge.' };
            }
            return { challenge };
          }
          if (challenge.status !== 'waiting' || challenge.players.length >= 2) {
            return { statusCode: 409, error: 'This challenge is no longer waiting for a player.' };
          }
          if (typeof body.playerToken !== 'string' || !body.playerToken.trim()) {
            return { statusCode: 400, error: 'A private player token is required to join the challenge.' };
          }

          challenge.players.push({
            id: body.playerId.trim().slice(0, 100),
            token: body.playerToken.trim().slice(0, 100),
            name: String(body.name || challenge.inviteeName).trim().slice(0, 60) || challenge.inviteeName,
            score: 0,
            correctAnswers: 0,
          });
          challenge.status = 'playing';
          challenge.questionStartedAt = Date.now();
          return { challenge };
        });
        if (result.statusCode) {
          sendJson(response, result.statusCode, { error: result.error });
          return;
        }
        sendJson(response, 200, serializeQuizChallenge(result.challenge, body.playerId.trim()));
      } catch (error) {
        sendQuizRequestError(response, error, 'The quiz challenge could not be joined.');
      }
      return;
    }

    if (action === 'answer' && request.method === 'POST') {
      try {
        const body = await readRequestBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(response, 400, { error: 'The request body must be a JSON object.' });
          return;
        }
        const result = await updateQuizChallenges((challenges) => {
          const challenge = findQuizChallenge(challenges, challengeId);
          if (!challenge) return { statusCode: 404, error: 'Challenge not found.' };
          const player = challenge.players.find((item) => (
            item.id === body.playerId && item.token === body.playerToken
          ));
          if (!player) return { statusCode: 403, error: 'You are not a player in this challenge.' };
          advanceQuizQuestion(challenge);
          if (challenge.status !== 'playing' || body.questionIndex !== challenge.questionIndex) {
            return { statusCode: 409, error: 'This question is no longer active.' };
          }
          if (!['A', 'B', 'C', 'D'].includes(body.answer)) {
            return { statusCode: 400, error: 'Choose one of the four answer options.' };
          }

          const now = Date.now();
          if (now >= challenge.questionStartedAt + challenge.secondsPerQuestion * 1000) {
            advanceQuizQuestion(challenge, now);
            return { statusCode: 409, error: 'The time for this question has expired.' };
          }

          const answers = challenge.answers[challenge.questionIndex] || {};
          if (answers[player.id]) return { statusCode: 409, error: 'You have already answered this question.' };
          const question = challenge.questions[challenge.questionIndex];
          const isCorrect = body.answer === question.correctAnswer;
          const elapsed = Math.max(0, now - challenge.questionStartedAt);
          const points = isCorrect
            ? Math.max(1, Math.ceil(1000 * (1 - elapsed / (challenge.secondsPerQuestion * 1000))))
            : 0;
          answers[player.id] = {
            answer: body.answer,
            isCorrect,
            points,
            answeredAt: now,
          };
          challenge.answers[challenge.questionIndex] = answers;
          player.score += points;
          if (isCorrect) player.correctAnswers += 1;
          advanceQuizQuestion(challenge, now);
          return { challenge };
        });

        if (result.statusCode) {
          sendJson(response, result.statusCode, { error: result.error });
          return;
        }
        sendJson(response, 200, serializeQuizChallenge(result.challenge, body.playerId));
      } catch (error) {
        sendQuizRequestError(response, error, 'Your answer could not be submitted.');
      }
      return;
    }

    if (!action && request.method === 'GET') {
      const playerId = url.searchParams.get('playerId') || '';
      const playerToken = url.searchParams.get('playerToken') || '';
      try {
        const result = await updateQuizChallenges((challenges) => {
          const challenge = findQuizChallenge(challenges, challengeId);
          if (!challenge) return { statusCode: 404, error: 'Challenge not found.' };
          if (!challenge.players.some((player) => player.id === playerId && player.token === playerToken)) {
            return { statusCode: 403, error: 'You are not a player in this challenge.' };
          }
          advanceQuizQuestion(challenge);
          return { challenge };
        });
        if (result.statusCode) {
          sendJson(response, result.statusCode, { error: result.error });
          return;
        }
        sendJson(response, 200, serializeQuizChallenge(result.challenge, playerId));
      } catch (error) {
        sendQuizRequestError(response, error, 'The quiz challenge could not be loaded.');
      }
      return;
    }
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
    const includeAll = url.searchParams.get('all') === 'true';
    const isAdmin = isAdminRequest(request);
    if (includeAll && !isAdmin) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    if (!includeAll && !isAdmin) {
      const catalog = await getOrLoadPublicCatalog('public-series-list', async () => {
        const series = await readJsonFile(SERIES_FILE, []);
        return {
          series: series
            .filter((item) => item.published)
            .map(publicSeriesSummary),
        };
      });
      sendJson(response, 200, catalog);
      return;
    }

    const series = await readJsonFile(SERIES_FILE, []);
    const tests = await readJsonFile(TESTS_FILE, []);
    const testCounts = getTestCountsBySeries(tests);
    const enriched = series.map((item) => ({
      ...item,
      testCount: testCounts.get(item.id) || 0,
    }));
    sendJson(response, 200, {
      series: includeAll
        ? enriched
        : enriched.filter((item) => item.published).map(publicSeriesSummary),
    });
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
    const testCounts = getTestCountsBySeries(tests);
    const item = series.find(s => s.id === seriesId);
    if (!item) { sendJson(response, 404, { error: 'Series not found' }); return; }
    if (!item.published && !isAdminRequest(request)) {
      sendJson(response, 404, { error: 'Series not found' });
      return;
    }
    if (!await requestHasSeriesAccess(request, seriesId)) {
      sendJson(response, 403, { error: 'Purchase this test series before opening its tests.' });
      return;
    }
    
    const enriched = {
      ...item,
      testCount: testCounts.get(item.id) || 0,
    };
    sendJson(response, 200, isAdminRequest(request) ? enriched : publicSeriesSummary(enriched));
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
      sendJsonBodyError(response, e);
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
      sendJsonBodyError(response, e);
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
            tests.unshift(await compactVersionedTest(updated));
            await writeJsonFile(TESTS_FILE, tests);
            sendJson(response, 200, updated);
            return;
          }

          tests[idx] = await compactVersionedTest(updated);
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
      tests.unshift(await compactVersionedTest(next));
      await writeJsonFile(TESTS_FILE, tests);
      sendJson(response, 200, next);
    } catch (e) {
      sendJsonBodyError(response, e);
    }

    return;
  }

  // Engine: get test template (public)
  if (url.pathname.startsWith('/api/tests/') && url.pathname.endsWith('/template') && request.method === 'GET') {
    const id = url.pathname.replace('/api/tests/', '').replace('/template', '');
    const test = await readJsonFileItem(TESTS_FILE, id);
    if (!test) { sendJson(response, 404, { error: 'Not found' }); return; }
    if (!test.published && !isAdminRequest(request)) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    if (!isAdminRequest(request) && (!test.seriesId || !await requestHasSeriesAccess(request, test.seriesId))) {
      sendJson(response, 403, { error: 'Purchase this test series before opening its tests.' });
      return;
    }
    sendJson(response, 200, (await hydrateVersionedTests([test]))[0]);
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
      sendJsonBodyError(response, e);
    }
    return;
  }

  if (url.pathname === '/api/engine/questions' && request.method === 'GET') {
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }
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
      const urlPath = await storeUploadedImage(safeFilename, expectedMime, buf, async () => {
        const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeFilename}`;
        await writeFile(resolve(UPLOADS_DIR, name), buf);
        return `/uploads/${name}`;
      });
      sendJson(response, 200, { url: urlPath, mime: expectedMime });
    } catch (e) {
      if (e?.statusCode) {
        console.error('Could not persist uploaded image.', e);
        sendJson(response, e.statusCode, { error: e.message });
      } else {
        sendJsonBodyError(response, e);
      }
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
      sendJsonBodyError(response, error);
    }

    return;
  }

  if (url.pathname === '/api/test-catalog' && request.method === 'GET') {
    const seriesId = url.searchParams.get('seriesId')?.trim() || '';
    const testId = url.searchParams.get('testId')?.trim() || '';
    const kind = url.searchParams.get('kind')?.trim() || '';
    const examKey = url.searchParams.get('examKey')?.trim() || '';
    const hasPagination = url.searchParams.has('page') || url.searchParams.has('limit');
    const page = Number(url.searchParams.get('page'));
    const limit = Number(url.searchParams.get('limit'));
    if ((!seriesId && testId) || (seriesId && !testId)
      || seriesId.length > 200 || testId.length > 200
      || kind.length > 40 || examKey.length > 100
      || (kind && !['test-series', 'previous-papers'].includes(kind))
      || (examKey && kind !== 'previous-papers')
      || (kind === 'previous-papers' && !seriesId && !examKey)
      || (hasPagination && (
        kind !== 'test-series'
        || !url.searchParams.has('page')
        || !url.searchParams.has('limit')
        || !Number.isInteger(page)
        || page < 1
        || !Number.isInteger(limit)
        || limit < 1
        || limit > 50
      ))) {
      if (hasPagination) {
        sendJson(response, 400, {
          error: 'Test-series pagination requires a positive page and a limit between 1 and 50.',
        });
        return;
      }
      sendJson(response, 400, { error: 'A valid series ID and test ID are required.' });
      return;
    }

    if (!seriesId && !testId) {
      const cacheKey = JSON.stringify([kind, examKey, hasPagination ? page : null, hasPagination ? limit : null]);
      const catalog = await getOrLoadPublicCatalog(cacheKey, async () => {
        const [series, tests] = await Promise.all([
          readJsonFile(SERIES_FILE, []),
          readJsonFile(TESTS_FILE, []),
        ]);
        const selectedSeries = series.filter((item) => (
          item.published
          && (kind === 'test-series' ? item.meta?.kind !== 'previous-papers'
            : kind === 'previous-papers'
              ? item.meta?.kind === 'previous-papers'
                && (!examKey || item.meta?.examKey === examKey)
              : true)
        ));
        const seriesIds = new Set(selectedSeries.map((item) => item.id));
        const selectedTests = tests.filter((test) => (
          test.published
          && seriesIds.has(test.seriesId)
          && (kind === 'test-series' ? test.meta?.kind !== 'previous-paper'
            : kind === 'previous-papers'
              ? test.meta?.kind === 'previous-paper'
                && (!examKey || test.meta?.examKey === examKey)
              : true)
        ));
        const seriesSummaries = selectedSeries.map(publicSeriesSummary);
        return hasPagination
          ? paginatePublicTestCatalog(
            seriesSummaries,
            selectedTests,
            page,
            limit,
            publicTestSummary,
          )
          : { series: seriesSummaries, tests: selectedTests.map(publicTestSummary) };
      });
      sendJson(response, 200, catalog);
      return;
    }

    const summaryCacheKey = JSON.stringify(['summary', seriesId, testId]);
    const summary = await getOrLoadPublicCatalog(summaryCacheKey, async () => {
      const [selectedSeries, selectedTest] = await Promise.all([
        readJsonFileItem(SERIES_FILE, seriesId),
        readJsonFileItem(TESTS_FILE, testId),
      ]);
      if (
        !selectedSeries
        || !selectedTest
        || !selectedSeries.published
        || selectedTest.seriesId !== seriesId
        || !selectedTest.published
      ) {
        const error = new Error('Test series test not found.');
        error.statusCode = 404;
        throw error;
      }

      return {
        series: publicSeriesSummary(selectedSeries),
        test: publicTestSummary(selectedTest),
      };
    });
    sendJson(response, 200, summary);
    return;
  }

  if (url.pathname === '/api/test-launch' && request.method === 'GET') {
    const seriesId = url.searchParams.get('seriesId')?.trim() || '';
    const testId = url.searchParams.get('testId')?.trim() || '';
    if (!seriesId || seriesId.length > 200 || !testId || testId.length > 200) {
      sendJson(response, 400, { error: 'A valid series ID and test ID are required.' });
      return;
    }

    const [selectedSeries, selectedTest] = await Promise.all([
      readJsonFileItem(SERIES_FILE, seriesId),
      readJsonFileItem(TESTS_FILE, testId),
    ]);
    if (
      !selectedSeries
      || !selectedTest
      || !selectedSeries.published
      || selectedTest.seriesId !== seriesId
      || !selectedTest.published
    ) {
      sendJson(response, 404, { error: 'Test series test not found.' });
      return;
    }
    if (!await requestHasSeriesAccess(request, seriesId)) {
      sendJson(response, 403, { error: 'Purchase this test series before opening its tests.' });
      return;
    }

    response.setHeader('Cache-Control', 'private, no-store');
    sendJson(response, 200, {
      series: publicSeriesSummary(selectedSeries),
      test: (await hydrateVersionedTests([selectedTest]))[0],
    });
    return;
  }

  // NEW: Get all tests (admin)
  if (url.pathname === '/api/tests' && request.method === 'GET') {
    const includeAll = url.searchParams.get('all') === 'true';
    const isAdmin = isAdminRequest(request);
    if (includeAll && !isAdmin) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
    if (includeAll || isAdmin) {
      const tests = await readJsonFile(TESTS_FILE, []);
      sendJson(response, 200, { tests: await hydrateVersionedTests(tests) });
      return;
    }

    const catalog = await getOrLoadPublicCatalog('public-tests-list', async () => {
      const tests = await readJsonFile(TESTS_FILE, []);
      return {
        tests: tests.filter((test) => test.published).map(publicTestSummary),
      };
    });
    sendJson(response, 200, catalog);
    return;
  }

  // NEW: Get single test by ID (admin)
  if (url.pathname.startsWith('/api/tests/') && !url.pathname.includes('/template') && request.method === 'GET') {
    const id = url.pathname.replace('/api/tests/', '').split('?')[0];
    if (!id || id.includes('/')) {
      sendJson(response, 400, { error: 'Invalid test id' });
      return;
    }
    const test = await readJsonFileItem(TESTS_FILE, id);
    if (!test) { sendJson(response, 404, { error: 'Test not found' }); return; }
    if (!test.published && !isAdminRequest(request)) {
      sendJson(response, 404, { error: 'Test not found' });
      return;
    }
    if (!isAdminRequest(request) && (!test.seriesId || !await requestHasSeriesAccess(request, test.seriesId))) {
      sendJson(response, 403, { error: 'Purchase this test series before opening its tests.' });
      return;
    }
    sendJson(response, 200, (await hydrateVersionedTests([test]))[0]);
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

      tests[idx] = await compactVersionedTest(updated);
      await writeJsonFile(TESTS_FILE, tests);
      sendJson(response, 200, updated);
    } catch (e) {
      sendJsonBodyError(response, e);
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
    if (!isAdminRequest(request)) { sendJson(response, 401, { error: 'Unauthorized' }); return; }
    const seriesId = url.pathname.split('/api/series/')[1].split('/')[0];
    if (!seriesId) { sendJson(response, 400, { error: 'Invalid series id' }); return; }

    const seriesTests = await readJsonFileItemsByField(TESTS_FILE, seriesId);
    sendJson(response, 200, { tests: await hydrateVersionedTests(seriesTests) });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

function measureApiTraffic(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (
    !url.pathname.startsWith('/api/')
    || url.pathname === '/api/telemetry/heartbeat'
    || url.pathname === '/api/admin/asset-metrics'
    || url.pathname === '/api/admin/operations'
    || url.pathname === '/api/admin/project-metrics'
  ) {
    return;
  }

  const startedAt = Date.now();
  let responseBytes = 0;
  const byteLength = (chunk, encoding) => {
    if (chunk === undefined || chunk === null) return 0;
    if (Buffer.isBuffer(chunk) || ArrayBuffer.isView(chunk)) return chunk.byteLength;
    return Buffer.byteLength(String(chunk), typeof encoding === 'string' ? encoding : undefined);
  };
  const originalWrite = response.write;
  const originalEnd = response.end;

  response.write = function (chunk, ...args) {
    responseBytes += byteLength(chunk, args[0]);
    return originalWrite.call(this, chunk, ...args);
  };
  response.end = function (chunk, ...args) {
    responseBytes += byteLength(chunk, args[0]);
    return originalEnd.call(this, chunk, ...args);
  };

  response.once('finish', () => {
    recordApiRequest({
      sessionId: request.headers['x-client-session'],
      pathname: url.pathname,
      statusCode: response.statusCode || 0,
      requestBytes: Number(request.headers['content-length']) || 0,
      responseBytes,
      durationMs: Date.now() - startedAt,
    });
  });
}

const server = createServer((request, response) => {
  measureApiTraffic(request, response);
  handleRequest(request, response).catch((error) => {
    console.error('Unhandled API request error.', error);
    if (!response.headersSent) {
      sendJson(response, error?.statusCode || 500, {
        error: error?.statusCode ? error.message : 'The API could not complete this request.',
      });
    } else {
      response.destroy(error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Impulse API running on http://localhost:${PORT}`);
});
