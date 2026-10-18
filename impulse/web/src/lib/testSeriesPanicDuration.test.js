import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const adapterSource = readFileSync(
  new URL('../../public/jee2025/assets/js/test-series-adapter.js', import.meta.url),
  'utf8',
);
const adapterContext = { window: {} };
runInNewContext(adapterSource, adapterContext);
const TestSeriesAdapter = adapterContext.window.TestSeriesAdapter;

describe('dynamic test-series panic duration', () => {
  it.each([
    [5, 5 * 60],
    [15, 15 * 60],
    [45, 15 * 60],
    [180, 15 * 60],
  ])('uses the configured window for a %s-minute exam', (durationMinutes, expectedSeconds) => {
    const adapter = new TestSeriesAdapter();
    adapter.config = { duration: durationMinutes };

    expect(adapter.getPanicWindowSeconds()).toBe(expectedSeconds);
  });

  it('rejects invalid durations instead of silently using a different window', () => {
    const adapter = new TestSeriesAdapter();

    adapter.config = { duration: 0 };

    expect(() => adapter.getPanicWindowSeconds()).toThrow('A positive exam duration is required');
  });
});
