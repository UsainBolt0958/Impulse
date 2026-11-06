const BUCKET_DURATION_MS = 5 * 60 * 1000;
const ACTIVE_SESSION_DURATION_MS = 5 * 60 * 1000;
const HISTORY_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MONTHLY_ACTIVE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MONTHLY_HISTORY_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 25_000;
const MAX_MONTHLY_SESSIONS = 100_000;
const MAX_ROUTE_COUNT = 50;
const MAX_KNOWN_ROUTES = 100;
const LATENCY_BOUNDARIES_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const startedAt = Date.now();
const trafficBuckets = new Map();
const dailyTrafficBuckets = new Map();
const activeSessions = new Map();
const monthlySessions = new Map();
const storageMeasurements = [];
const knownRoutes = new Set();
let peakActiveSessions = 0;
let lastPrunedAt = 0;

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[a-f\d-]{36}$/i.test(sessionId);
}

function normalizeRoute(pathname) {
  const route = pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^[a-f\d-]{16,}$/i.test(segment) || /^\d+$/.test(segment)) return ':id';
      if (segment.length > 40) return ':id';
      return segment;
    })
    .join('/');
  if (knownRoutes.has(route)) return route;
  if (knownRoutes.size >= MAX_KNOWN_ROUTES) return 'other';
  knownRoutes.add(route);
  return route;
}

function createRouteMetrics() {
  return {
    requests: 0,
    clientErrors: 0,
    serverErrors: 0,
    latencyTotalMs: 0,
    latencyHistogram: Array(LATENCY_BOUNDARIES_MS.length + 1).fill(0),
    statusCodes: {},
    responseBytes: 0,
  };
}

function createBucket(withRoutes = true) {
  return {
    requests: 0,
    requestBytes: 0,
    responseBytes: 0,
    clientErrors: 0,
    serverErrors: 0,
    latencyTotalMs: 0,
    latencyHistogram: Array(LATENCY_BOUNDARIES_MS.length + 1).fill(0),
    statusCodes: {},
    routes: withRoutes ? new Map() : null,
    peakActiveSessions: 0,
  };
}

function getBucket(timestamp) {
  const bucketStart = Math.floor(timestamp / BUCKET_DURATION_MS) * BUCKET_DURATION_MS;
  let bucket = trafficBuckets.get(bucketStart);
  if (!bucket) {
    bucket = createBucket();
    trafficBuckets.set(bucketStart, bucket);
  }
  return bucket;
}

function pruneMetrics(now, force = false) {
  if (!force && now - lastPrunedAt < 60_000) return;
  lastPrunedAt = now;
  const historyStart = now - HISTORY_DURATION_MS;
  for (const timestamp of trafficBuckets.keys()) {
    if (timestamp < historyStart) trafficBuckets.delete(timestamp);
  }
  const monthlyHistoryStart = now - MONTHLY_HISTORY_DURATION_MS;
  for (const timestamp of dailyTrafficBuckets.keys()) {
    if (timestamp < monthlyHistoryStart) dailyTrafficBuckets.delete(timestamp);
  }
  for (const [sessionId, lastSeenAt] of activeSessions) {
    if (lastSeenAt >= now - ACTIVE_SESSION_DURATION_MS) break;
    activeSessions.delete(sessionId);
  }
  for (const [sessionId, lastSeenAt] of monthlySessions) {
    if (lastSeenAt >= now - MONTHLY_ACTIVE_DURATION_MS) break;
    monthlySessions.delete(sessionId);
  }
  while (storageMeasurements.length && storageMeasurements[0].timestamp < now - MONTHLY_HISTORY_DURATION_MS) {
    storageMeasurements.shift();
  }
  while (activeSessions.size > MAX_ACTIVE_SESSIONS) {
    activeSessions.delete(activeSessions.keys().next().value);
  }
  while (monthlySessions.size > MAX_MONTHLY_SESSIONS) {
    monthlySessions.delete(monthlySessions.keys().next().value);
  }
}

export function recordStorageMeasurement(bytes, measuredAt = Date.now()) {
  const timestamp = new Date(measuredAt).getTime();
  const sizeBytes = Number(bytes);
  if (!Number.isFinite(timestamp) || !Number.isFinite(sizeBytes) || sizeBytes < 0) return;

  const latest = storageMeasurements[storageMeasurements.length - 1];
  if (latest?.timestamp === timestamp) {
    latest.bytes = sizeBytes;
    return;
  }
  storageMeasurements.push({ timestamp, bytes: sizeBytes });
  if (storageMeasurements.length > 100) storageMeasurements.shift();
  pruneMetrics(timestamp);
}

function updateConcurrencyPeak(bucket, now) {
  const concurrentSessions = activeSessions.size;
  peakActiveSessions = Math.max(peakActiveSessions, concurrentSessions);
  bucket.peakActiveSessions = Math.max(bucket.peakActiveSessions, concurrentSessions);
}

function incrementLatency(histogram, durationMs) {
  const index = LATENCY_BOUNDARIES_MS.findIndex((boundary) => durationMs <= boundary);
  histogram[index < 0 ? histogram.length - 1 : index] += 1;
}

function getPercentile(histogram, percentile) {
  const count = histogram.reduce((total, samples) => total + samples, 0);
  if (!count) return 0;
  const target = Math.ceil(count * percentile);
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) return LATENCY_BOUNDARIES_MS[index] ?? LATENCY_BOUNDARIES_MS.at(-1) + 1;
  }
  return 0;
}

function getRoute(bucket, pathname) {
  const route = normalizeRoute(pathname);
  let metrics = bucket.routes.get(route);
  if (metrics) return metrics;

  if (bucket.routes.size >= MAX_ROUTE_COUNT) {
    metrics = bucket.routes.get('other');
    if (!metrics) {
      metrics = createRouteMetrics();
      bucket.routes.set('other', metrics);
    }
    return metrics;
  }

  metrics = createRouteMetrics();
  bucket.routes.set(route, metrics);
  return metrics;
}

function getDailyBucket(timestamp) {
  const dayStart = Math.floor(timestamp / (24 * 60 * 60 * 1000)) * 24 * 60 * 60 * 1000;
  let bucket = dailyTrafficBuckets.get(dayStart);
  if (!bucket) {
    bucket = createBucket(false);
    dailyTrafficBuckets.set(dayStart, bucket);
  }
  return bucket;
}

function addRequestToMetrics(metrics, { statusCode, requestBytes, responseBytes, durationMs }) {
  metrics.requests += 1;
  metrics.clientErrors += statusCode >= 400 && statusCode < 500 ? 1 : 0;
  metrics.serverErrors += statusCode >= 500 ? 1 : 0;
  metrics.latencyTotalMs += durationMs;
  metrics.responseBytes += responseBytes;
  incrementLatency(metrics.latencyHistogram, durationMs);
  const statusKey = String(statusCode);
  metrics.statusCodes[statusKey] = (metrics.statusCodes[statusKey] || 0) + 1;
}

export function recordVisitorHeartbeat(sessionId, userId, now = Date.now()) {
  if (!isValidSessionId(sessionId) || !isValidSessionId(userId)) return;
  pruneMetrics(now);
  activeSessions.delete(sessionId);
  activeSessions.set(sessionId, now);
  monthlySessions.delete(userId);
  monthlySessions.set(userId, now);
  const bucket = getBucket(now);
  updateConcurrencyPeak(bucket, now);
  const dailyBucket = getDailyBucket(now);
  dailyBucket.peakActiveSessions = Math.max(dailyBucket.peakActiveSessions, activeSessions.size);
}

export function recordApiRequest({
  pathname = '/api/unknown',
  statusCode,
  requestBytes = 0,
  responseBytes = 0,
  durationMs = 0,
  now = Date.now(),
}) {
  pruneMetrics(now);
  const bucket = getBucket(now);
  const dailyBucket = getDailyBucket(now);
  const request = {
    statusCode: Number(statusCode) || 0,
    requestBytes: Math.max(0, Number(requestBytes) || 0),
    responseBytes: Math.max(0, Number(responseBytes) || 0),
    durationMs: Math.max(0, Number(durationMs) || 0),
  };

  for (const target of [bucket, dailyBucket]) {
    target.requests += 1;
    target.requestBytes += request.requestBytes;
    target.responseBytes += request.responseBytes;
    target.clientErrors += request.statusCode >= 400 && request.statusCode < 500 ? 1 : 0;
    target.serverErrors += request.statusCode >= 500 ? 1 : 0;
    target.latencyTotalMs += request.durationMs;
    incrementLatency(target.latencyHistogram, request.durationMs);
    target.statusCodes[String(request.statusCode)] = (
      target.statusCodes[String(request.statusCode)] || 0
    ) + 1;
  }
  addRequestToMetrics(getRoute(bucket, pathname), request);
  updateConcurrencyPeak(bucket, now);
  dailyBucket.peakActiveSessions = Math.max(dailyBucket.peakActiveSessions, activeSessions.size);
  pruneMetrics(now);
}

function createSummary() {
  return {
    requests: 0,
    requestBytes: 0,
    responseBytes: 0,
    clientErrors: 0,
    serverErrors: 0,
    latencyTotalMs: 0,
    latencyHistogram: Array(LATENCY_BOUNDARIES_MS.length + 1).fill(0),
    statusCodes: {},
    peakActiveSessions: 0,
    routes: new Map(),
  };
}

function mergeCounts(target, source) {
  for (const [statusCode, count] of Object.entries(source)) {
    target[statusCode] = (target[statusCode] || 0) + count;
  }
}

function mergeMetrics(summary, bucket) {
  summary.requests += bucket.requests;
  summary.requestBytes += bucket.requestBytes;
  summary.responseBytes += bucket.responseBytes;
  summary.clientErrors += bucket.clientErrors;
  summary.serverErrors += bucket.serverErrors;
  summary.latencyTotalMs += bucket.latencyTotalMs;
  summary.peakActiveSessions = Math.max(summary.peakActiveSessions, bucket.peakActiveSessions);
  bucket.latencyHistogram.forEach((count, index) => {
    summary.latencyHistogram[index] += count;
  });
  mergeCounts(summary.statusCodes, bucket.statusCodes);

  for (const [route, routeMetrics] of bucket.routes || []) {
    let targetRoute = summary.routes.get(route);
    if (!targetRoute) {
      targetRoute = createRouteMetrics();
      summary.routes.set(route, targetRoute);
    }
    targetRoute.requests += routeMetrics.requests;
    targetRoute.clientErrors += routeMetrics.clientErrors;
    targetRoute.serverErrors += routeMetrics.serverErrors;
    targetRoute.latencyTotalMs += routeMetrics.latencyTotalMs;
    targetRoute.responseBytes += routeMetrics.responseBytes;
    routeMetrics.latencyHistogram.forEach((count, index) => {
      targetRoute.latencyHistogram[index] += count;
    });
    mergeCounts(targetRoute.statusCodes, routeMetrics.statusCodes);
  }
}

function serializeSummary(summary) {
  return {
    requests: summary.requests,
    requestBytes: summary.requestBytes,
    responseBytes: summary.responseBytes,
    clientErrors: summary.clientErrors,
    serverErrors: summary.serverErrors,
    errorRatePercent: summary.requests
      ? Number((((summary.clientErrors + summary.serverErrors) / summary.requests) * 100).toFixed(2))
      : 0,
    averageLatencyMs: summary.requests ? Math.round(summary.latencyTotalMs / summary.requests) : 0,
    p50LatencyMs: getPercentile(summary.latencyHistogram, 0.5),
    p95LatencyMs: getPercentile(summary.latencyHistogram, 0.95),
    statusCodes: summary.statusCodes,
    peakActiveSessions: summary.peakActiveSessions,
  };
}

export function getAssetMetrics(now = Date.now()) {
  pruneMetrics(now, true);
  const firstHalfHour = Math.floor(now / (30 * 60 * 1000)) * (30 * 60 * 1000) - 47 * 30 * 60 * 1000;
  const intervals = Array.from({ length: 48 }, (_, index) => ({
    timestamp: firstHalfHour + index * 30 * 60 * 1000,
    requests: 0,
    responseBytes: 0,
    serverErrors: 0,
    peakActiveSessions: 0,
  }));
  const intervalIndex = new Map(intervals.map((interval) => [interval.timestamp, interval]));
  const summaries = {
    traffic24h: createSummary(),
    traffic7d: createSummary(),
  };
  const traffic30d = createSummary();
  const routes24h = new Map();
  const activeSince = now - ACTIVE_SESSION_DURATION_MS;
  const history24h = now - 24 * 60 * 60 * 1000;
  const history7d = now - 7 * 24 * 60 * 60 * 1000;
  const history30d = now - MONTHLY_HISTORY_DURATION_MS;

  for (const [bucketStart, bucket] of trafficBuckets) {
    if (bucketStart >= history7d) mergeMetrics(summaries.traffic7d, bucket);
    if (bucketStart < history24h) continue;

    mergeMetrics(summaries.traffic24h, bucket);
    const intervalStart = Math.floor(bucketStart / (30 * 60 * 1000)) * (30 * 60 * 1000);
    const interval = intervalIndex.get(intervalStart);
    if (interval) {
      interval.requests += bucket.requests;
      interval.responseBytes += bucket.responseBytes;
      interval.serverErrors += bucket.serverErrors;
      interval.peakActiveSessions = Math.max(interval.peakActiveSessions, bucket.peakActiveSessions);
    }
    for (const [route, metrics] of bucket.routes || []) {
      let total = routes24h.get(route);
      if (!total) {
        total = createRouteMetrics();
        routes24h.set(route, total);
      }
      total.requests += metrics.requests;
      total.clientErrors += metrics.clientErrors;
      total.serverErrors += metrics.serverErrors;
      total.latencyTotalMs += metrics.latencyTotalMs;
      total.responseBytes += metrics.responseBytes;
      metrics.latencyHistogram.forEach((count, index) => {
        total.latencyHistogram[index] += count;
      });
      mergeCounts(total.statusCodes, metrics.statusCodes);
    }
  }

  for (const [dayStart, bucket] of dailyTrafficBuckets) {
    if (dayStart >= history30d) mergeMetrics(traffic30d, bucket);
  }

  const routes = [...routes24h.entries()]
    .map(([path, metrics]) => ({
      path,
      ...serializeSummary(metrics),
      responseBytes: metrics.responseBytes,
    }))
    .sort((left, right) => right.requests - left.requests)
    .slice(0, 20);
  const series7d = Array.from({ length: 7 }, (_, index) => {
    const dayStart = Math.floor((now - (6 - index) * 24 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000))
      * 24 * 60 * 60 * 1000;
    return { timestamp: dayStart, requests: 0, serverErrors: 0 };
  });
  const dailyIndex = new Map(series7d.map((day) => [day.timestamp, day]));
  for (const [dayStart, bucket] of dailyTrafficBuckets) {
    const day = dailyIndex.get(dayStart);
    if (day) {
      day.requests += bucket.requests;
      day.serverErrors += bucket.serverErrors;
    }
  }

  const lastStorageMeasurement = storageMeasurements[storageMeasurements.length - 1];
  const comparisonMeasurement = [...storageMeasurements]
    .reverse()
    .find((measurement) => lastStorageMeasurement
      && lastStorageMeasurement.timestamp - measurement.timestamp >= 6 * 60 * 60 * 1000);
  const storageDays = lastStorageMeasurement && comparisonMeasurement
    ? (lastStorageMeasurement.timestamp - comparisonMeasurement.timestamp) / (24 * 60 * 60 * 1000)
    : 0;
  const storageTrend = {
    samples: storageMeasurements.length,
    bytesPerDay: storageDays > 0
      ? Math.max(0, (lastStorageMeasurement.bytes - comparisonMeasurement.bytes) / storageDays)
      : 0,
    measuredAt: lastStorageMeasurement ? new Date(lastStorageMeasurement.timestamp).toISOString() : null,
  };

  return {
    startedAt: new Date(startedAt).toISOString(),
    measuredAt: new Date(now).toISOString(),
    retentionDays: HISTORY_DURATION_MS / (24 * 60 * 60 * 1000),
    activeWindowSeconds: ACTIVE_SESSION_DURATION_MS / 1000,
    activeSessions: [...activeSessions.values()].filter((lastSeenAt) => lastSeenAt >= activeSince).length,
    activeSessionsCapped: activeSessions.size >= MAX_ACTIVE_SESSIONS,
    peakActiveSessions,
    peakActiveSessionsCapped: peakActiveSessions >= MAX_ACTIVE_SESSIONS,
    observedMonthlyActiveSessions: monthlySessions.size,
    monthlyActiveSessionsCapped: monthlySessions.size >= MAX_MONTHLY_SESSIONS,
    traffic24h: serializeSummary(summaries.traffic24h),
    traffic7d: serializeSummary(summaries.traffic7d),
    traffic30d: serializeSummary(traffic30d),
    storageTrend,
    series: intervals,
    series7d,
    routes,
  };
}
