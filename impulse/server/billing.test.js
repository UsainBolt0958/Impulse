import { describe, expect, it } from 'vitest';
import { buildSeriesAccessMap } from './billing.js';

describe('batched test-series access', () => {
  it('preserves purchased access and locks series for Basic users', () => {
    expect(buildSeriesAccessMap(
      ['owned-series', 'paid-series', 'unconfigured-series'],
      [{ series_id: 'owned-series' }]
    )).toEqual({
      'owned-series': { allowed: true, reason: 'purchased' },
      'paid-series': { allowed: false, reason: 'pro_required' },
      'unconfigured-series': { allowed: false, reason: 'pro_required' },
    });
  });

  it('grants every requested series to an active Pro member', () => {
    expect(buildSeriesAccessMap(
      ['series-one', 'series-two'],
      [],
      true
    )).toEqual({
      'series-one': { allowed: true, reason: 'pro_membership' },
      'series-two': { allowed: true, reason: 'pro_membership' },
    });
  });

});
