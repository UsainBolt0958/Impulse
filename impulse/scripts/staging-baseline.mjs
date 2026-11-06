import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const siteUrl = new URL(
  process.env.STAGING_SITE_URL || 'https://69f58f03.impulse-6mk.pages.dev/',
);
const apiUrl = new URL(
  process.env.STAGING_API_URL || 'https://impulse-api-staging.onrender.com/',
);
const rounds = Math.min(5, Math.max(1, Math.trunc(Number(process.env.BASELINE_ROUNDS) || 3)));

const apiPaths = [
  ['/api/health', 'health'],
  ['/api/questions', 'questions-all'],
  ['/api/questions?page=1&limit=20', 'questions-page-1'],
  ['/api/questions?page=2&limit=20', 'questions-page-2'],
  ['/api/questions?exam=JEE%20MAINS&subject=Physics&page=1&limit=20', 'questions-filtered'],
  ['/api/questions?limit=1', 'questions-limit-1'],
  ['/api/questions/catalog?exam=JEE%20MAINS&subject=Physics', 'question-catalog'],
  ['/api/questions/custom-test/catalog', 'custom-test-catalog'],
  ['/api/quiz/catalog', 'quiz-catalog'],
  ['/api/series', 'series'],
  ['/api/tests', 'tests'],
  ['/api/test-catalog?kind=test-series&page=1&limit=18', 'test-catalog'],
  ['/api/admin-state', 'access-admin-state'],
  ['/api/engine/questions', 'access-engine-questions'],
];

async function fetchMeasured(url) {
  const started = performance.now();
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: { Accept: 'application/json, text/html, */*' },
      });
      const body = Buffer.from(await response.arrayBuffer());
      let data = null;
      try {
        data = JSON.parse(body.toString('utf8'));
      } catch {
        data = null;
      }

      return {
        status: response.status,
        ok: response.ok,
        elapsedMs: round(performance.now() - started),
        bodyBytes: body.byteLength,
        bodyText: body.toString('utf8'),
        contentType: response.headers.get('content-type'),
        cacheControl: response.headers.get('cache-control'),
        etag: Boolean(response.headers.get('etag')),
        data,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    status: null,
    ok: false,
    elapsedMs: round(performance.now() - started),
    bodyBytes: 0,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function getArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function getQuestionStats(data) {
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const distribution = { exam: {}, year: {}, subject: {}, difficulty: {}, type: {} };
  for (const question of questions) {
    for (const [field, value] of Object.entries({
      exam: question.exam,
      year: question.year,
      subject: question.subject,
      difficulty: question.difficulty,
      type: question.type,
    })) {
      const key = String(value ?? 'missing');
      distribution[field][key] = (distribution[field][key] || 0) + 1;
    }
  }
  const ids = questions.map((question) => String(question.id ?? ''));
  const signature = createHash('sha256').update(ids.join('\n')).digest('hex');
  return {
    questionCount: questions.length,
    uniqueQuestionIds: new Set(ids).size,
    questionIdSignature: signature,
    distribution,
  };
}

function summarizeSamples(samples) {
  const timings = samples
    .map((sample) => sample.elapsedMs)
    .filter((elapsedMs) => Number.isFinite(elapsedMs))
    .sort((left, right) => left - right);
  return {
    statusCodes: [...new Set(samples.map((sample) => sample.status))],
    medianMs: timings.length ? timings[Math.floor(timings.length / 2)] : null,
    minMs: timings.length ? timings[0] : null,
    maxMs: timings.length ? timings[timings.length - 1] : null,
    medianBodyBytes: median(samples.map((sample) => sample.bodyBytes)),
  };
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

async function main() {
  const page = await fetchMeasured(siteUrl);
  const assets = [...page.bodyText.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map((match) => new URL(match[1], siteUrl).href);
  const assetResults = [];
  for (const asset of assets) {
    const measured = await fetchMeasured(new URL(asset));
    assetResults.push({
      url: new URL(asset).pathname,
      status: measured.status,
      elapsedMs: measured.elapsedMs,
      decodedBodyBytes: measured.bodyBytes,
      contentType: measured.contentType,
      cacheControl: measured.cacheControl,
      etag: measured.etag,
    });
  }

  const apiResults = [];
  for (const [path, name] of apiPaths) {
    const samples = [];
    for (let index = 0; index < rounds; index += 1) {
      samples.push(await fetchMeasured(new URL(path, apiUrl)));
    }
    const first = samples[0];
    apiResults.push({
      name,
      path,
      ...summarizeSamples(samples),
      responseKeys: first?.data && typeof first.data === 'object'
        ? Object.keys(first.data)
        : [],
      itemCount: getArray(first?.data).length,
      ...(name.startsWith('questions-') ? getQuestionStats(first?.data) : {}),
      samples: samples.map(({ status, elapsedMs, bodyBytes, error }) => ({
        status,
        elapsedMs,
        bodyBytes,
        ...(error ? { error } : {}),
      })),
    });
  }

  const byName = new Map(apiResults.map((result) => [result.name, result]));
  const pageOne = byName.get('questions-page-1');
  const pageTwo = byName.get('questions-page-2');
  const filtered = byName.get('questions-filtered');
  const limitOne = byName.get('questions-limit-1');
  const allQuestions = byName.get('questions-all');
  const paginationEnvelope = Array.isArray(pageOne?.responseKeys)
    && ['total', 'page', 'limit', 'hasMore'].every((key) => pageOne.responseKeys.includes(key));

  const result = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    mode: 'read-only unauthenticated GET requests; no account or payment actions',
    rounds,
    site: {
      origin: siteUrl.origin,
      status: page.status,
      elapsedMs: page.elapsedMs,
      decodedHtmlBytes: page.bodyBytes,
      contentType: page.contentType,
      cacheControl: page.cacheControl,
      etag: page.etag,
      assets: assetResults,
    },
    api: {
      origin: apiUrl.origin,
      endpoints: apiResults,
      checks: {
        questionPageUsesPagination: Boolean(pageOne?.itemCount === 20 && paginationEnvelope),
        pageOneAndPageTwoDiffer: Boolean(
          pageOne?.questionIdSignature && pageTwo?.questionIdSignature
          && pageOne.questionIdSignature !== pageTwo.questionIdSignature,
        ),
        questionFilterReducesResults: Boolean(
          filtered && allQuestions && filtered.itemCount < allQuestions.itemCount,
        ),
        limitOneReturnsAtMostOneQuestion: Boolean(limitOne?.itemCount <= 1),
      },
    },
  };
  const json = JSON.stringify(result, null, 2);
  if (process.env.BASELINE_OUTPUT) {
    await writeFile(resolve(process.env.BASELINE_OUTPUT), `${json}\n`, 'utf8');
  }
  console.log(json);
  if (apiResults.some((endpoint) => endpoint.samples.some((sample) => sample.error))) {
    process.exitCode = 1;
  }
}

await main();
