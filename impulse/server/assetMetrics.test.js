import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let getAssetMetrics;
let recordApiRequest;
let recordStorageMeasurement;
let recordVisitorHeartbeat;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
  vi.resetModules();
  ({ getAssetMetrics, recordApiRequest, recordStorageMeasurement, recordVisitorHeartbeat } = await import('./assetMetrics.js'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('asset metrics', () => {
  it('aggregates recent API traffic into a 24-hour series', () => {
    recordVisitorHeartbeat(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    );
    recordVisitorHeartbeat(
      '00000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002'
    );
    recordApiRequest({
      pathname: '/api/questions/12345678901234567890',
      statusCode: 200,
      requestBytes: 12,
      responseBytes: 120,
      durationMs: 40,
    });
    recordApiRequest({
      pathname: '/api/questions/98765432109876543210',
      statusCode: 503,
      requestBytes: 5,
      responseBytes: 30,
      durationMs: 60,
    });
    recordApiRequest({
      pathname: '/api/series/123/tests',
      statusCode: 200,
      responseBytes: 10,
    });

    const metrics = getAssetMetrics();
    expect(metrics.traffic24h).toMatchObject({
      requests: 3,
      requestBytes: 17,
      responseBytes: 160,
      clientErrors: 0,
      serverErrors: 1,
      averageLatencyMs: 33,
      p50LatencyMs: 50,
      p95LatencyMs: 100,
    });
    expect(metrics.activeSessions).toBe(2);
    expect(metrics.peakActiveSessions).toBe(2);
    expect(metrics.traffic24h.peakActiveSessions).toBe(2);
    expect(metrics.series).toHaveLength(48);
    expect(metrics.series.reduce((total, bucket) => total + bucket.requests, 0)).toBe(3);
    expect(metrics.routes.map(({ path }) => path)).toContain('/api/questions/:id');
    expect(JSON.stringify(metrics.routes)).not.toContain('12345678901234567890');
  });

  it('expires inactive sessions and drops traffic older than 24 hours', () => {
    recordVisitorHeartbeat(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    );
    recordApiRequest({ statusCode: 200, responseBytes: 50 });

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    const metrics = getAssetMetrics();

    expect(metrics.activeSessions).toBe(0);
    expect(metrics.traffic24h.requests).toBe(0);
  });

  it('groups route status counts and tracks daily traffic over seven days', () => {
    recordApiRequest({
      pathname: '/api/questions',
      statusCode: 404,
      durationMs: 500,
    });

    const metrics = getAssetMetrics();
    expect(metrics.traffic24h.errorRatePercent).toBe(100);
    expect(metrics.traffic24h.clientErrors).toBe(1);
    expect(metrics.routes[0]).toMatchObject({
      path: '/api/questions',
      requests: 1,
      statusCodes: { 404: 1 },
    });
    expect(metrics.series7d).toHaveLength(7);
    expect(metrics.traffic30d.requests).toBe(1);
  });

  it('projects file-storage growth only when there are two dated samples', () => {
    const firstSample = Date.now();
    recordStorageMeasurement(1024, firstSample);
    expect(getAssetMetrics().storageTrend).toMatchObject({ samples: 1, bytesPerDay: 0 });

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    recordStorageMeasurement(2048, Date.now());
    expect(getAssetMetrics().storageTrend).toMatchObject({
      samples: 2,
      bytesPerDay: 2048,
    });
  });
});
