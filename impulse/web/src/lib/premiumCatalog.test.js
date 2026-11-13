import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from } }));

import { formatPriceInr, getPlanLimitText, updateProAnnualPrice } from './premiumCatalog';

beforeEach(() => {
  from.mockReset();
});

describe('premium catalog presentation', () => {
  it('updates only the Pro annual price', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({
      data: { price_inr: 999 },
      error: null,
    });
    from.mockReturnValue(query);

    await expect(updateProAnnualPrice(999)).resolves.toBe(999);
    expect(from).toHaveBeenCalledWith('premium_plan_prices');
    expect(query.update).toHaveBeenCalledWith({ price_inr: 999 });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'plan_code', 'pro');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'duration_months', 12);
  });

  it('rejects invalid Pro prices before writing', async () => {
    await expect(updateProAnnualPrice(1.5)).rejects.toThrow('whole-rupee');
    expect(from).not.toHaveBeenCalled();
  });

  it('formats rupee amounts without embedding plan prices', () => {
    expect(formatPriceInr(199)).toBe('₹199');
    expect(formatPriceInr(1199)).toBe('₹1,199');
  });

  it('describes the Basic plan daily limits', () => {
    expect(getPlanLimitText({
      plan_code: 'free',
      limits: {
        friends: 3,
        previous_paper_daily: 2,
        custom_test_daily: 5,
      },
    })).toEqual([
      'Up to 3 friends',
      '2 previous papers per day',
      '5 custom tests per day',
      'Unlimited PYQ practice',
      'Test-series access requires Pro',
    ]);
  });

  it('describes unrestricted Pro access', () => {
    expect(getPlanLimitText({
      plan_code: 'pro',
      limits: {
        friends: null,
        previous_paper_daily: null,
        custom_test_daily: null,
      },
    })).toEqual([
      'Unlimited friends',
      'Unlimited previous papers',
      'Unlimited custom tests',
      'Unlimited PYQ practice',
      'Complete access with no usage restrictions',
    ]);
  });
});
