const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase access is not configured on the API host.');
  }
}

async function fetchWithTimeout(url, init, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function supabaseRequest(path, init = {}) {
  requireSupabaseConfig();
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const rawBody = await response.text();
  let body = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error('Supabase returned an invalid response to a billing request.');
    }
  }
  if (!response.ok) {
    console.error('Supabase access request failed.', response.status, body?.code || body?.message || 'Unknown error');
    throw new Error('Could not securely check membership access.');
  }
  return body;
}

export async function verifyCustomerAccessToken(accessToken) {
  requireSupabaseConfig();
  if (typeof accessToken !== 'string' || !accessToken.trim()) return null;

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === 'string' ? user : null;
}

export async function verifyGoogleCustomerAccessToken(accessToken) {
  const user = await verifyCustomerAccessToken(accessToken);
  if (!user || !user.email_confirmed_at) return null;
  const hasGoogleIdentity = user.app_metadata?.provider === 'google'
    || user.identities?.some((identity) => identity.provider === 'google');
  return hasGoogleIdentity ? user : null;
}

export async function consumeBasicDailyQuota(userId, feature, resourceId) {
  const result = await supabaseRequest('rpc/consume_basic_daily_quota', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: userId,
      p_feature: feature,
      p_resource_id: resourceId,
    }),
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function getSeriesAccess(userId, seriesId) {
  const activeProQuery = new URLSearchParams({
    user_id: `eq.${userId}`,
    status: 'eq.approved',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id',
    limit: '1',
  });
  const activePro = await supabaseRequest(`pro_applications?${activeProQuery}`);
  if (activePro?.length) {
    return { allowed: true, reason: 'pro_membership' };
  }

  const purchaseQuery = new URLSearchParams({
    user_id: `eq.${userId}`,
    series_id: `eq.${seriesId}`,
    status: 'eq.active',
    select: 'id',
    limit: '1',
  });
  const purchases = await supabaseRequest(`test_series_purchases?${purchaseQuery}`);
  return purchases?.length
    ? { allowed: true, reason: 'purchased' }
    : { allowed: false, reason: 'pro_required' };
}

export function buildSeriesAccessMap(seriesIds, purchaseRows, hasProAccess = false) {
  const purchases = new Set((purchaseRows || []).map((row) => row.series_id));
  return Object.fromEntries(seriesIds.map((seriesId) => {
    if (hasProAccess) return [seriesId, { allowed: true, reason: 'pro_membership' }];
    if (purchases.has(seriesId)) return [seriesId, { allowed: true, reason: 'purchased' }];
    return [seriesId, { allowed: false, reason: 'pro_required' }];
  }));
}

export async function getSeriesAccessBatch(userId, seriesIds) {
  if (seriesIds.length === 0) return {};

  const postgrestInList = `(${seriesIds.map((id) => (
    `"${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  )).join(',')})`;
  const activeProQuery = new URLSearchParams({
    user_id: `eq.${userId}`,
    status: 'eq.approved',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id',
    limit: '1',
  });
  const purchaseQuery = new URLSearchParams({
    user_id: `eq.${userId}`,
    series_id: `in.${postgrestInList}`,
    status: 'eq.active',
    select: 'series_id',
  });
  const [activePro, purchases] = await Promise.all([
    supabaseRequest(`pro_applications?${activeProQuery}`),
    supabaseRequest(`test_series_purchases?${purchaseQuery}`),
  ]);
  return buildSeriesAccessMap(seriesIds, purchases, Boolean(activePro?.length));
}
