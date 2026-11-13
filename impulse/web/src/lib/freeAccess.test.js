import { describe, expect, it } from 'vitest';
import { FREE_ACCESS_END, isFreeAccessActive } from './freeAccess';

describe('temporary free access', () => {
  it('is active through January 1, 2027 in India', () => {
    expect(isFreeAccessActive(new Date('2027-01-01T23:59:59+05:30'))).toBe(true);
  });

  it('ends at midnight on January 2, 2027 in India', () => {
    expect(isFreeAccessActive(FREE_ACCESS_END)).toBe(false);
  });
});
