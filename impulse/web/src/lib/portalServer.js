import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const PUBLIC_QUESTIONS_CACHE_TTL_MS = 60_000;
const CUSTOM_TEST_CATALOG_CACHE_TTL_MS = 60_000;
const PUBLIC_TEST_CATALOG_CACHE_TTL_MS = 30_000;
const PUBLIC_TEST_CATALOG_CACHE_MAX_ENTRIES = 50;
const QUESTION_CATALOG_CACHE_TTL_MS = 30_000;
const QUESTION_CATALOG_CACHE_MAX_ENTRIES = 100;
const PUBLIC_TEST_SUMMARY_CACHE_TTL_MS = 30_000;
const PUBLIC_TEST_SUMMARY_CACHE_MAX_ENTRIES = 100;
const PUBLIC_SERIES_CACHE_TTL_MS = 30_000;
const PUBLIC_QUESTION_PAGE_CACHE_TTL_MS = 15_000;
const PUBLIC_QUESTION_PAGE_CACHE_MAX_ENTRIES = 50;
let cachedPublicQuestions = null;
let publicQuestionsExpiresAt = 0;
let publicQuestionsRequest = null;
let cachedCustomTestCatalog = null;
let customTestCatalogExpiresAt = 0;
let customTestCatalogRequest = null;
const questionCatalogCache = new Map();
const questionCatalogRequests = new Map();
let questionCatalogVersion = 0;
const publicQuestionPageCache = new Map();
const publicQuestionPageRequests = new Map();
let publicQuestionPageVersion = 0;
const publicTestCatalogCache = new Map();
const publicTestCatalogRequests = new Map();
let publicTestCatalogVersion = 0;
let cachedPublicSeries = null;
let publicSeriesExpiresAt = 0;
let publicSeriesRequest = null;
const publicTestSummaryCache = new Map();
const publicTestSummaryRequests = new Map();
const QUESTION_METADATA_CACHE_TTL_MS = 60_000;
const questionMetadataCache = new Map();
const questionMetadataRequests = new Map();
let clientSessionId = '';

function getClientSessionId() {
  if (clientSessionId) return clientSessionId;

  try {
    clientSessionId = window.localStorage.getItem('impulse_client_session') || '';
    if (!clientSessionId) {
      clientSessionId = globalThis.crypto?.randomUUID?.()
        || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
          const random = Math.floor(Math.random() * 16);
          return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
        });
      window.localStorage.setItem('impulse_client_session', clientSessionId);
    }
  } catch {
    clientSessionId = globalThis.crypto?.randomUUID?.()
      || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16);
        return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
      });
  }
  return clientSessionId;
}

function withClientSessionHeader(headers = {}) {
  return {
    ...headers,
    'X-Client-Session': getClientSessionId(),
  };
}

async function getAccessToken() {
  if (!supabase) throw new Error('Supabase is not configured for this website.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Sign in with Google before starting a test.');
  return data.session.access_token;
}

async function requestWithUserAuth(path, init = {}) {
  const accessToken = await getAccessToken();
  return requestJsonOrThrow(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function requestJson(path, init = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: init.credentials || 'include',
      headers: {
        'Content-Type': 'application/json',
        ...withClientSessionHeader(init.headers),
      },
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody === 'object' && errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        // ignore invalid JSON error body
      }
      console.error('API request failed:', path, errorMessage);
      return null;
    }

    if (response.status === 204) {
      return {};
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', path, error);
    return null;
  }
}

async function requestJsonOrThrow(path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: init.credentials || 'include',
    headers: {
      'Content-Type': 'application/json',
      ...withClientSessionHeader(init.headers),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === 'object' && errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // ignore invalid JSON error body
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {};
  }

  return await response.json();
}

export async function loadPortalStateFromServer() {
  return requestJsonOrThrow('/admin-state', { method: 'GET', cache: 'no-store' });
}

export async function loadPublicQuestionsFromServer() {
  if (cachedPublicQuestions && Date.now() < publicQuestionsExpiresAt) {
    return [...cachedPublicQuestions];
  }

  if (!publicQuestionsRequest) {
    publicQuestionsRequest = requestJsonOrThrow('/questions', { method: 'GET', cache: 'no-store' })
      .then((data) => {
        cachedPublicQuestions = Array.isArray(data?.questions) ? data.questions : [];
        publicQuestionsExpiresAt = Date.now() + PUBLIC_QUESTIONS_CACHE_TTL_MS;
        return cachedPublicQuestions;
      })
      .finally(() => {
        publicQuestionsRequest = null;
      });
  }

  return [...await publicQuestionsRequest];
}

export async function loadPublicQuestionCatalog(exam, subject) {
  const cacheKey = JSON.stringify([exam, subject]);
  const cached = questionCatalogCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.chapters.map((chapter) => ({ ...chapter, years: [...chapter.years] }));
  }

  let request = questionCatalogRequests.get(cacheKey);
  if (!request) {
    const requestVersion = questionCatalogVersion;
    const params = new URLSearchParams({ exam, subject });
    const loadRequest = requestJsonOrThrow(`/questions/catalog?${params}`, {
      method: 'GET',
      cache: 'no-store',
    }).then((data) => {
      const chapters = Array.isArray(data?.chapters) ? data.chapters : [];
      if (requestVersion === questionCatalogVersion) {
        if (questionCatalogCache.size >= QUESTION_CATALOG_CACHE_MAX_ENTRIES) {
          const oldestKey = questionCatalogCache.keys().next().value;
          if (oldestKey !== undefined) questionCatalogCache.delete(oldestKey);
        }
        questionCatalogCache.set(cacheKey, {
          chapters,
          expiresAt: Date.now() + QUESTION_CATALOG_CACHE_TTL_MS,
        });
      }
      return chapters;
    }).finally(() => {
      if (questionCatalogRequests.get(cacheKey) === loadRequest) {
        questionCatalogRequests.delete(cacheKey);
      }
    });
    request = loadRequest;
    questionCatalogRequests.set(cacheKey, request);
  }

  const chapters = await request;
  return chapters.map((chapter) => ({ ...chapter, years: [...chapter.years] }));
}

export async function loadPublicQuestionMetadata(ids) {
  const uniqueIds = [...new Set(ids.map((id) => String(id)).filter(Boolean))].sort();
  const batches = [];
  for (let index = 0; index < uniqueIds.length; index += 200) {
    batches.push(uniqueIds.slice(index, index + 200));
  }

  await Promise.all(batches.map(async (batch) => {
    const cacheKey = batch.join('\u001f');
    const cached = questionMetadataCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return;

    let request = questionMetadataRequests.get(cacheKey);
    if (!request) {
      const params = new URLSearchParams();
      batch.forEach((id) => params.append('id', id));
      request = requestJsonOrThrow(`/questions/metadata?${params}`, {
        method: 'GET',
        cache: 'no-store',
      }).then((data) => {
        const questions = Array.isArray(data?.questions) ? data.questions : [];
        questionMetadataCache.set(cacheKey, {
          questions,
          expiresAt: Date.now() + QUESTION_METADATA_CACHE_TTL_MS,
        });
        return questions;
      }).finally(() => {
        questionMetadataRequests.delete(cacheKey);
      });
      questionMetadataRequests.set(cacheKey, request);
    }
    await request;
  }));

  return Object.fromEntries(batches.flatMap((batch) => {
    const cached = questionMetadataCache.get(batch.join('\u001f'));
    return (cached?.questions || []).map((question) => [String(question.id), question]);
  }));
}

export async function loadCustomTestCatalog() {
  if (cachedCustomTestCatalog && Date.now() < customTestCatalogExpiresAt) {
    return [...cachedCustomTestCatalog];
  }

  if (!customTestCatalogRequest) {
    customTestCatalogRequest = requestJsonOrThrow('/questions/custom-test/catalog', {
      method: 'GET',
      cache: 'no-store',
    }).then((data) => {
      cachedCustomTestCatalog = Array.isArray(data?.exams) ? data.exams : [];
      customTestCatalogExpiresAt = Date.now() + CUSTOM_TEST_CATALOG_CACHE_TTL_MS;
      return cachedCustomTestCatalog;
    }).finally(() => {
      customTestCatalogRequest = null;
    });
  }

  return [...await customTestCatalogRequest];
}

export async function createCustomTestQuestions(payload) {
  const data = await requestWithUserAuth('/questions/custom-test', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  return Array.isArray(data?.questions) ? data.questions : [];
}

export async function loadQuestionVersions(references) {
  if (!Array.isArray(references) || references.length === 0) return [];
  const accessToken = await getAccessToken();
  const questions = [];
  for (let offset = 0; offset < references.length; offset += 100) {
    const data = await requestJsonOrThrow('/questions/versions', {
      method: 'POST',
      body: JSON.stringify({ references: references.slice(offset, offset + 100) }),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!Array.isArray(data?.questions)) {
      throw new Error('The question-version response was invalid.');
    }
    questions.push(...data.questions);
  }
  return questions;
}

export async function loadPublicQuestionsPage(filters, page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const key of ['exam', 'subject', 'chapter', 'difficulty', 'year']) {
    const values = Array.isArray(filters[key]) ? filters[key] : [filters[key]];
    values.filter((value) => value !== undefined && value !== null && String(value).trim())
      .forEach((value) => params.append(key, String(value)));
  }

  const cacheKey = params.toString();
  const cached = publicQuestionPageCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.result);
  }

  let request = publicQuestionPageRequests.get(cacheKey);
  if (!request) {
    const requestVersion = publicQuestionPageVersion;
    const loadRequest = requestJsonOrThrow(`/questions?${params}`, {
      method: 'GET',
      cache: 'no-store',
    }).then((data) => {
      const result = {
        questions: Array.isArray(data?.questions) ? data.questions : [],
        total: Number.isInteger(data?.total) ? data.total : 0,
        page: Number.isInteger(data?.page) ? data.page : page,
        limit: Number.isInteger(data?.limit) ? data.limit : limit,
        hasMore: Boolean(data?.hasMore),
      };
      if (requestVersion === publicQuestionPageVersion) {
        if (publicQuestionPageCache.size >= PUBLIC_QUESTION_PAGE_CACHE_MAX_ENTRIES) {
          const oldestKey = publicQuestionPageCache.keys().next().value;
          if (oldestKey !== undefined) publicQuestionPageCache.delete(oldestKey);
        }
        publicQuestionPageCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + PUBLIC_QUESTION_PAGE_CACHE_TTL_MS,
        });
      }
      return result;
    }).finally(() => {
      if (publicQuestionPageRequests.get(cacheKey) === loadRequest) {
        publicQuestionPageRequests.delete(cacheKey);
      }
    });
    request = loadRequest;
    publicQuestionPageRequests.set(cacheKey, request);
  }

  return structuredClone(await request);
}

export async function loadAdminSessionFromServer() {
  return requestJson('/admin-session', { method: 'GET' });
}

export async function loadAdminStorageUsage() {
  return requestJsonOrThrow('/admin/storage-usage', { method: 'GET', cache: 'no-store' });
}

export async function loadAdminAssetMetrics() {
  return requestJsonOrThrow('/admin/asset-metrics', { method: 'GET', cache: 'no-store' });
}

export async function loadAdminOperations() {
  return requestJsonOrThrow('/admin/operations', { method: 'GET', cache: 'no-store' });
}

export async function loadAdminProjectMetrics() {
  return requestJsonOrThrow('/admin/project-metrics', { method: 'GET', cache: 'no-store' });
}

export function startClientSessionHeartbeat() {
  const sendHeartbeat = () => {
    requestWithUserAuth('/telemetry/heartbeat', {
      method: 'POST',
      body: '{}',
      keepalive: true,
    }).catch((error) => {
      console.error('Could not update active-session telemetry.', error);
    });
  };
  sendHeartbeat();
  const intervalId = window.setInterval(sendHeartbeat, 60_000);
  return () => window.clearInterval(intervalId);
}

export async function establishAdminServerSession(accessToken) {
  return requestJsonOrThrow('/admin-login', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

export async function logoutFromAdminServer() {
  return requestJsonOrThrow('/admin-logout', {
    method: 'POST',
  });
}

export async function getSeriesBillingAccess(seriesId) {
  const params = new URLSearchParams({ seriesId });
  return requestWithUserAuth(`/billing/series-access?${params}`, {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function getSeriesBillingAccessBatch(seriesIds) {
  if (!Array.isArray(seriesIds) || seriesIds.length < 1 || seriesIds.length > 50) {
    throw new Error('Provide between 1 and 50 test-series IDs to check access.');
  }
  const result = await requestWithUserAuth('/billing/series-access/batch', {
    method: 'POST',
    body: JSON.stringify({ seriesIds }),
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!result?.accessBySeriesId || typeof result.accessBySeriesId !== 'object') {
    throw new Error('The server returned an invalid test-series access response.');
  }
  return result.accessBySeriesId;
}

export async function establishExamSession(seriesId, testId) {
  const apiUrl = new URL(API_BASE, window.location.origin);
  window.sessionStorage.setItem('impulse_api_origin', apiUrl.origin);
  return requestWithUserAuth('/billing/exam-session', {
    method: 'POST',
    body: JSON.stringify({ seriesId, ...(testId ? { testId } : {}) }),
  });
}

export async function clearExamSession() {
  return requestJsonOrThrow('/billing/exam-session', { method: 'DELETE' });
}

export async function savePortalStateToServer(state) {
  const result = await requestJsonOrThrow('/admin-state', {
    method: 'PUT',
    body: JSON.stringify(state),
  });
  questionCatalogVersion += 1;
  questionCatalogCache.clear();
  questionCatalogRequests.clear();
  publicQuestionPageVersion += 1;
  publicQuestionPageCache.clear();
  publicQuestionPageRequests.clear();
  return result;
}

export async function loadSeries() {
  const data = await requestJsonOrThrow('/series?all=true', { method: 'GET' });
  return Array.isArray(data?.series) ? data.series : [];
}

export async function getSeries(seriesId) {
  if (!seriesId) return null;
  return requestJsonOrThrow(`/series/${seriesId}`, { method: 'GET' });
}

export async function loadPublicSeries() {
  if (cachedPublicSeries && Date.now() < publicSeriesExpiresAt) {
    return structuredClone(cachedPublicSeries);
  }

  if (!publicSeriesRequest) {
    const requestVersion = publicTestCatalogVersion;
    const request = requestJsonOrThrow('/series', { method: 'GET' })
      .then((data) => {
        const series = Array.isArray(data?.series) ? data.series : [];
        if (requestVersion === publicTestCatalogVersion) {
          cachedPublicSeries = series;
          publicSeriesExpiresAt = Date.now() + PUBLIC_SERIES_CACHE_TTL_MS;
        }
        return series;
      })
      .finally(() => {
        if (publicSeriesRequest === request) publicSeriesRequest = null;
      });
    publicSeriesRequest = request;
  }

  return structuredClone(await publicSeriesRequest);
}

export async function loadPublicTestSummary(seriesId, testId) {
  if (!seriesId || !testId) {
    throw new Error('Series ID and test ID are required to load a test summary.');
  }
  const cacheKey = JSON.stringify([seriesId, testId]);
  const cached = publicTestSummaryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return structuredClone(cached.summary);
  }

  let request = publicTestSummaryRequests.get(cacheKey);
  if (request) return structuredClone(await request);

  const requestVersion = publicTestCatalogVersion;
  const params = new URLSearchParams({ seriesId, testId });
  const loadRequest = requestJsonOrThrow(`/test-catalog?${params}`, { method: 'GET' })
    .then((summary) => {
      if (requestVersion === publicTestCatalogVersion) {
        if (publicTestSummaryCache.size >= PUBLIC_TEST_SUMMARY_CACHE_MAX_ENTRIES) {
          const oldestKey = publicTestSummaryCache.keys().next().value;
          if (oldestKey !== undefined) publicTestSummaryCache.delete(oldestKey);
        }
        publicTestSummaryCache.set(cacheKey, {
          summary,
          expiresAt: Date.now() + PUBLIC_TEST_SUMMARY_CACHE_TTL_MS,
        });
      }
      return summary;
    }).finally(() => {
      if (publicTestSummaryRequests.get(cacheKey) === loadRequest) {
        publicTestSummaryRequests.delete(cacheKey);
      }
    });
  publicTestSummaryRequests.set(cacheKey, loadRequest);
  return structuredClone(await loadRequest);
}

export async function loadPublicTestCatalog({ kind, examKey, page, limit } = {}) {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (examKey) params.set('examKey', examKey);
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();
  const cacheKey = query || 'all';
  const cached = publicTestCatalogCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    publicTestCatalogCache.delete(cacheKey);
    publicTestCatalogCache.set(cacheKey, cached);
    return structuredClone(cached.catalog);
  }
  if (cached) {
    publicTestCatalogCache.delete(cacheKey);
  }

  let request = publicTestCatalogRequests.get(cacheKey);
  if (!request) {
    const requestVersion = publicTestCatalogVersion;
    request = requestJsonOrThrow(`/test-catalog${query ? `?${query}` : ''}`, { method: 'GET' })
      .then((data) => {
        const catalog = {
          series: Array.isArray(data?.series) ? data.series : [],
          tests: Array.isArray(data?.tests) ? data.tests : [],
        };
        if (data?.pageInfo && typeof data.pageInfo === 'object') {
          catalog.pageInfo = data.pageInfo;
          catalog.testCountsBySeries = data.testCountsBySeries || {};
        }
        if (requestVersion === publicTestCatalogVersion) {
          while (publicTestCatalogCache.size >= PUBLIC_TEST_CATALOG_CACHE_MAX_ENTRIES) {
            const oldestKey = publicTestCatalogCache.keys().next().value;
            if (oldestKey === undefined) break;
            publicTestCatalogCache.delete(oldestKey);
          }
          publicTestCatalogCache.set(cacheKey, {
            catalog: structuredClone(catalog),
            expiresAt: Date.now() + PUBLIC_TEST_CATALOG_CACHE_TTL_MS,
          });
        }
        return catalog;
      })
      .finally(() => {
        if (publicTestCatalogRequests.get(cacheKey) === request) {
          publicTestCatalogRequests.delete(cacheKey);
        }
      });
    publicTestCatalogRequests.set(cacheKey, request);
  }

  const catalog = await request;
  return structuredClone(catalog);
}

function invalidatePublicTestCatalog() {
  publicTestCatalogVersion += 1;
  publicTestCatalogCache.clear();
  publicTestCatalogRequests.clear();
  cachedPublicSeries = null;
  publicSeriesExpiresAt = 0;
  publicSeriesRequest = null;
  publicTestSummaryCache.clear();
  publicTestSummaryRequests.clear();
}

export async function createSeries(title, description = '') {
  const result = await requestJsonOrThrow('/series', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
  invalidatePublicTestCatalog();
  return result;
}

export async function updateSeries(id, payload) {
  if (!id) return null;
  const result = await requestJsonOrThrow(`/series/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
  });
  invalidatePublicTestCatalog();
  return result;
}

export async function deleteSeries(id) {
  if (!id) return null;
  const result = await requestJsonOrThrow(`/series/${id}`, {
    method: 'DELETE',
  });
  invalidatePublicTestCatalog();
  return result;
}

// Test Management API Functions
export async function loadTests() {
  const data = await requestJsonOrThrow('/tests', { method: 'GET' });
  return Array.isArray(data?.tests) ? data.tests : [];
}

export async function getTest(testId) {
  if (!testId) return null;
  return requestJsonOrThrow(`/tests/${testId}`, { method: 'GET' });
}

export async function createTest(payload) {
  const result = await requestJsonOrThrow('/tests', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  invalidatePublicTestCatalog();
  return result;
}

export async function updateTest(testId, payload) {
  if (!testId) return null;
  const result = await requestJsonOrThrow(`/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
  });
  invalidatePublicTestCatalog();
  return result;
}

export async function deleteTest(testId) {
  if (!testId) return null;
  const result = await requestJsonOrThrow(`/tests/${testId}`, {
    method: 'DELETE',
  });
  invalidatePublicTestCatalog();
  return result;
}

export async function getSeriesTests(seriesId) {
  if (!seriesId) {
    throw new Error('Series id is required to load tests.');
  }
  const data = await requestJsonOrThrow(`/series/${seriesId}/tests`, { method: 'GET' });
  return Array.isArray(data?.tests) ? data.tests : [];
}

// Image Upload
export async function uploadImage(file) {
  if (!file) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
  if (typeof dataUrl !== 'string') {
    throw new Error(`Could not read "${file.name}" as an image.`);
  }
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error(`Could not encode "${file.name}" as an image.`);

  return requestJsonOrThrow('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      data: base64,
      mime: file.type,
    }),
  });
}
