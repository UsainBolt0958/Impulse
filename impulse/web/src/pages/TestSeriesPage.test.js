import { describe, expect, it } from 'vitest';
import { getTestSeriesDashboardUrl } from './TestSeriesPage';

describe('test series dashboard entry', () => {
  it('opens the selected test in its attempt dashboard route', () => {
    expect(getTestSeriesDashboardUrl('jee-mains-paper/one', 'series one')).toBe(
      '/test-series/series%20one/jee-mains-paper%2Fone'
    );
  });
});
