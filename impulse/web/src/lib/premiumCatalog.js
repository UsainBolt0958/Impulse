import { supabase } from './supabase';

export async function loadPremiumCatalog() {
  if (!supabase) throw new Error('Supabase is not configured for this website.');

  const [plansResult, pricesResult] = await Promise.all([
    supabase
      .from('premium_plans')
      .select('plan_code,name,description,features,limits,sort_order')
      .eq('enabled', true)
      .order('sort_order'),
    supabase
      .from('premium_plan_prices')
      .select('plan_code,duration_months,price_inr')
      .order('duration_months'),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (pricesResult.error) throw pricesResult.error;

  const pricesByPlan = new Map();
  (pricesResult.data || []).forEach((price) => {
    const prices = pricesByPlan.get(price.plan_code) || [];
    prices.push(price);
    pricesByPlan.set(price.plan_code, prices);
  });

  return (plansResult.data || []).map((plan) => ({
    ...plan,
    prices: pricesByPlan.get(plan.plan_code) || [],
  }));
}

export async function loadTestSeriesPriceMap() {
  if (!supabase) throw new Error('Supabase is not configured for this website.');
  const { data, error } = await supabase
    .from('test_series_prices')
    .select('series_id,price_inr,enabled');
  if (error) throw error;
  return new Map((data || []).map((row) => [row.series_id, row]));
}

export function formatPriceInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function getPlanLimitText(plan) {
  const limits = plan?.limits || {};
  const text = [];
  text.push(limits.friends == null
    ? 'Unlimited friends'
    : `Up to ${limits.friends} ${limits.friends === 1 ? 'friend' : 'friends'}`);

  if (plan.plan_code === 'free') {
    text.push('JEE Advanced 2025 + one JEE Main and one NEET paper');
    text.push('Up to 2 attempts per included paper');
    text.push(`${limits.custom_test_lifetime ?? 0} custom-test creations for the account lifetime`);
  } else {
    text.push(limits.previous_paper_daily == null
      ? 'Unlimited previous-paper tests'
      : `${limits.previous_paper_daily} previous-paper ${limits.previous_paper_daily === 1 ? 'test' : 'tests'} per day`);
    text.push(limits.custom_test_daily == null
      ? 'Unlimited custom tests'
      : `${limits.custom_test_daily} custom tests per day`);
  }

  text.push('All PYQ question practice');
  text.push('Test series sold separately');
  return text;
}
