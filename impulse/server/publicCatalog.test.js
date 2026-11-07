import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cachePublicCatalog,
  getOrLoadPublicCatalog,
  getCachedPublicCatalog,
  getPublicCatalogCacheVersion,
  invalidatePublicCatalogCache,
  paginatePublicTestCatalog,
} from './publicCatalog.js';

afterEach(() => {
  vi.useRealTimers();
  invalidatePublicCatalogCache();
});

describe('public catalog cache', () => {
  it('coalesces concurrent cache misses and returns isolated values', async () => {
    let finishLoad;
    const loader = vi.fn(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));

    const firstRequest = getOrLoadPublicCatalog('coalesced', loader);
    const secondRequest = getOrLoadPublicCatalog('coalesced', loader);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledOnce();

    finishLoad({ tests: [{ id: 'test-1' }] });
    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.tests[0].id = 'mutated';
    await expect(getOrLoadPublicCatalog('coalesced', loader)).resolves.toEqual({
      tests: [{ id: 'test-1' }],
    });
    expect(loader).toHaveBeenCalledOnce();
  });

  it('does not cache stale in-flight results after invalidation', async () => {
    let finishLoad;
    const oldRequest = getOrLoadPublicCatalog('stale', () => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    await Promise.resolve();
    invalidatePublicCatalogCache();
    finishLoad({ tests: ['stale'] });
    await oldRequest;

    await expect(getOrLoadPublicCatalog('stale', async () => ({ tests: ['current'] })))
      .resolves.toEqual({ tests: ['current'] });
  });

  it('paginates public test summaries while preserving per-series totals', () => {
    const series = [{ id: 'series-1' }];
    const tests = [
      { id: 'test-1', seriesId: 'series-1' },
      { id: 'test-2', seriesId: 'series-1' },
      { id: 'test-3', seriesId: 'series-2' },
    ];

    expect(paginatePublicTestCatalog(series, tests, 2, 2)).toEqual({
      series,
      tests: [tests[2]],
      testCountsBySeries: {
        'series-1': 2,
        'series-2': 1,
      },
      pageInfo: {
        page: 2,
        limit: 2,
        total: 3,
        hasMore: false,
      },
    });
  });

  it('summarizes only tests on the requested page', () => {
    const tests = [
      { id: 'test-1', seriesId: 'series-1' },
      { id: 'test-2', seriesId: 'series-1' },
      { id: 'test-3', seriesId: 'series-2' },
    ];
    const summarizeTest = vi.fn(({ id }) => ({ id }));

    expect(paginatePublicTestCatalog([], tests, 2, 1, summarizeTest).tests)
      .toEqual([{ id: 'test-2' }]);
    expect(summarizeTest).toHaveBeenCalledOnce();
    expect(summarizeTest.mock.calls[0][0]).toBe(tests[1]);
  });

  it('caches results briefly and returns isolated values', () => {
    vi.useFakeTimers();
    const catalog = { series: [{ id: 'series-1' }], tests: [{ id: 'test-1' }] };
    cachePublicCatalog('all', catalog);
    catalog.series[0].id = 'mutated';

    const cached = getCachedPublicCatalog('all');
    expect(cached).toEqual({
      series: [{ id: 'series-1' }],
      tests: [{ id: 'test-1' }],
    });
    cached.tests[0].id = 'also-mutated';
    expect(getCachedPublicCatalog('all').tests[0].id).toBe('test-1');

    vi.advanceTimersByTime(30_000);
    expect(getCachedPublicCatalog('all')).toBeNull();
  });

  it('isolates cache keys and ignores stale fills after invalidation', () => {
    const oldVersion = getPublicCatalogCacheVersion();
    invalidatePublicCatalogCache();
    cachePublicCatalog('all', { tests: ['stale'] }, oldVersion);
    expect(getCachedPublicCatalog('all')).toBeNull();

    cachePublicCatalog('all', { tests: ['current'] });
    expect(getCachedPublicCatalog('filtered')).toBeNull();
    expect(getCachedPublicCatalog('all')).toEqual({ tests: ['current'] });
    invalidatePublicCatalogCache();
    expect(getCachedPublicCatalog('all')).toBeNull();
  });
});
