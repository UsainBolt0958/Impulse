const PUBLIC_CATALOG_CACHE_TTL_MS = 30_000;
const PUBLIC_CATALOG_CACHE_MAX_ENTRIES = 50;
const PUBLIC_CATALOG_CACHE_MAX_BYTES = 5 * 1024 * 1024;
const publicCatalogCache = new Map();
const publicCatalogRequests = new Map();
let publicCatalogCacheBytes = 0;
let publicCatalogCacheVersion = 0;

function removeCacheEntry(key) {
  const entry = publicCatalogCache.get(key);
  if (!entry) return;
  publicCatalogCacheBytes -= entry.bytes;
  publicCatalogCache.delete(key);
}

export function getPublicCatalogCacheVersion() {
  return publicCatalogCacheVersion;
}

export function getCachedPublicCatalog(key) {
  const entry = publicCatalogCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    removeCacheEntry(key);
    return null;
  }
  return structuredClone(entry.value);
}

export function cachePublicCatalog(key, value, requestVersion = publicCatalogCacheVersion) {
  if (requestVersion !== publicCatalogCacheVersion) return;

  const serializedValue = JSON.stringify(value);
  const bytes = Buffer.byteLength(serializedValue, 'utf8');
  if (bytes > PUBLIC_CATALOG_CACHE_MAX_BYTES) return;

  removeCacheEntry(key);
  while (
    publicCatalogCache.size >= PUBLIC_CATALOG_CACHE_MAX_ENTRIES
    || publicCatalogCacheBytes + bytes > PUBLIC_CATALOG_CACHE_MAX_BYTES
  ) {
    const oldestKey = publicCatalogCache.keys().next().value;
    if (oldestKey === undefined) break;
    removeCacheEntry(oldestKey);
  }

  publicCatalogCache.set(key, {
    value: structuredClone(value),
    bytes,
    expiresAt: Date.now() + PUBLIC_CATALOG_CACHE_TTL_MS,
  });
  publicCatalogCacheBytes += bytes;
}

export async function getOrLoadPublicCatalog(key, loader) {
  const cached = getCachedPublicCatalog(key);
  if (cached) return cached;

  const pendingRequest = publicCatalogRequests.get(key);
  if (pendingRequest) return structuredClone(await pendingRequest);

  const requestVersion = publicCatalogCacheVersion;
  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      cachePublicCatalog(key, value, requestVersion);
      return value;
    })
    .finally(() => {
      if (publicCatalogRequests.get(key) === request) {
        publicCatalogRequests.delete(key);
      }
    });
  publicCatalogRequests.set(key, request);
  return structuredClone(await request);
}

export function invalidatePublicCatalogCache() {
  publicCatalogCacheVersion += 1;
  publicCatalogCache.clear();
  publicCatalogCacheBytes = 0;
  publicCatalogRequests.clear();
}

export function paginatePublicTestCatalog(series, tests, page, limit, summarizeTest = (test) => test) {
  const testCounts = getTestCountsBySeries(tests);

  const start = (page - 1) * limit;
  const pageTests = tests.slice(start, start + limit);
  return {
    series,
    tests: pageTests.map(summarizeTest),
    testCountsBySeries: Object.fromEntries(testCounts),
    pageInfo: {
      page,
      limit,
      total: tests.length,
      hasMore: start + limit < tests.length,
    },
  };
}

export function getTestCountsBySeries(tests) {
  const testCounts = new Map();
  tests.forEach(({ seriesId }) => {
    testCounts.set(seriesId, (testCounts.get(seriesId) || 0) + 1);
  });
  return testCounts;
}
