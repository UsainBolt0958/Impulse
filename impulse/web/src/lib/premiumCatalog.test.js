import { describe, expect, it } from 'vitest';
import { formatPriceInr, getPlanLimitText } from './premiumCatalog';

describe('premium catalog presentation', () => {
  it('formats rupee amounts without embedding plan prices', () => {
    expect(formatPriceInr(199)).toBe('₹199');
    expect(formatPriceInr(1199)).toBe('₹1,199');
  });

  it('describes the free-tier lifetime limits and excluded test series', () => {
    expect(getPlanLimitText({
      plan_code: 'free',
      limits: {
        friends: 1,
        custom_test_lifetime: 3,
      },
    })).toEqual([
      'Up to 1 friend',
      'JEE Advanced 2025 + one JEE Main and one NEET paper',
      'Up to 2 attempts per included paper',
      '3 custom-test creations for the account lifetime',
      'All PYQ question practice',
      'Test series sold separately',
    ]);
  });

  it('shows tiered daily caps and unlimited limits from catalog data', () => {
    expect(getPlanLimitText({
      plan_code: 'gold',
      limits: {
        friends: 5,
        previous_paper_daily: 3,
        custom_test_daily: 10,
      },
    })).toEqual([
      'Up to 5 friends',
      '3 previous-paper tests per day',
      '10 custom tests per day',
      'All PYQ question practice',
      'Test series sold separately',
    ]);
    expect(getPlanLimitText({
      plan_code: 'ultimate',
      limits: {
        friends: null,
        previous_paper_daily: null,
        custom_test_daily: null,
      },
    })).toEqual([
      'Unlimited friends',
      'Unlimited previous-paper tests',
      'Unlimited custom tests',
      'All PYQ question practice',
      'Test series sold separately',
    ]);
  });
});
