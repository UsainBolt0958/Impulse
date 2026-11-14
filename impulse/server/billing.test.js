import { describe, expect, it } from 'vitest';
import { buildSeriesAccessMap } from './billing.js';

describe('batched test-series access', () => {
  it('preserves free, purchased, and unpaid access decisions', () => {
    expect(buildSeriesAccessMap(
      ['free-series', 'owned-series', 'paid-series', 'unconfigured-series'],
      [
        { series_id: 'free-series', price_inr: 0 },
        { series_id: 'owned-series', price_inr: 500 },
        { series_id: 'paid-series', price_inr: 750 },
      ],
      [{ series_id: 'owned-series' }]
    )).toEqual({
      'free-series': { allowed: true, reason: 'free' },
      'owned-series': { allowed: true, reason: 'purchased' },
      'paid-series': { allowed: false, reason: 'payment_required', price_inr: 750 },
      'unconfigured-series': { allowed: true, reason: 'free' },
    });
  });

  it('applies temporary free access to every requested series', () => {
    expect(buildSeriesAccessMap(
      ['series-one', 'series-two'],
      [],
      [],
      true
    )).toEqual({
      'series-one': { allowed: true, reason: 'temporary_free_access' },
      'series-two': { allowed: true, reason: 'temporary_free_access' },
    });
  });

  it('grants every test series to Pro accounts', () => {
    expect(buildSeriesAccessMap(
      ['paid-series', 'unconfigured-series'],
      [{ series_id: 'paid-series', price_inr: 750 }],
      [],
      false,
      true
    )).toEqual({
      'paid-series': { allowed: true, reason: 'pro' },
      'unconfigured-series': { allowed: true, reason: 'pro' },
    });
  });
});
