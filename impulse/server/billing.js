import { randomBytes } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const UPIGATEWAY_USER_TOKEN = process.env.UPIGATEWAY_USER_TOKEN || '';
const UPIGATEWAY_API_BASE = (process.env.UPIGATEWAY_API_BASE || 'https://free.upigateway.dev/api').replace(/\/+$/, '');
const PAYMENT_RETURN_URL = process.env.PAYMENT_RETURN_URL || '';
const PROVIDER = 'upigateway';
const FREE_ACCESS_END = Date.parse('2027-01-02T00:00:00+05:30');

function isFreeAccessActive() {
  return Date.now() < FREE_ACCESS_END;
}

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Payment backend is not configured. Set the Supabase URL, anon key, and service-role key on the API host.');
  }
}

function requirePaymentConfig() {
  requireSupabaseConfig();
  if (!UPIGATEWAY_USER_TOKEN) {
    throw new Error('UPI Gateway is not configured on the API host.');
  }
  if (!PAYMENT_RETURN_URL) {
    throw new Error('Set PAYMENT_RETURN_URL to the HTTPS payment-return page on your website.');
  }
  const returnUrl = new URL(PAYMENT_RETURN_URL);
  const gatewayUrl = new URL(UPIGATEWAY_API_BASE);
  if (process.env.NODE_ENV === 'production' && returnUrl.protocol !== 'https:') {
    throw new Error('PAYMENT_RETURN_URL must use HTTPS in production.');
  }
  if (
    process.env.NODE_ENV === 'production'
    && (gatewayUrl.protocol !== 'https:' || gatewayUrl.hostname !== 'free.upigateway.dev')
  ) {
    throw new Error('UPIGATEWAY_API_BASE must use the official HTTPS UPI Gateway API host in production.');
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
    console.error('Supabase billing request failed.', response.status, body?.code || body?.message || 'Unknown error');
    throw new Error('Could not securely save or check the payment record.');
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

async function hasProAccess(userId) {
  const result = await supabaseRequest('rpc/has_pro_access', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId }),
  });
  return result === true;
}

export async function consumeDailyFeature(userId, feature) {
  if (!['custom_test', 'previous_paper'].includes(feature)) {
    throw new Error('Unsupported daily feature.');
  }
  const result = await supabaseRequest('rpc/consume_daily_feature', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_feature: feature }),
  });
  if (!result?.allowed) {
    const featureLabel = feature === 'custom_test' ? 'custom tests' : 'previous-year papers';
    const error = new Error(
      `You have reached the Basic limit of ${result?.limit} ${featureLabel} today. Upgrade to Pro for unlimited access.`
    );
    error.statusCode = 429;
    throw error;
  }
  return result;
}

export async function getBillingOrder(orderId, userId) {
  const query = new URLSearchParams({
    order_id: `eq.${orderId}`,
    user_id: `eq.${userId}`,
    select: 'order_id,user_id,product_type,plan_code,duration_months,series_id,amount_inr,status,payment_url,created_at,expires_at,paid_at',
    limit: '1',
  });
  const rows = await supabaseRequest(`upi_payment_orders?${query}`);
  return rows?.[0] || null;
}

async function reconcileGatewayStatus(orderId) {
  requirePaymentConfig();
  const form = new URLSearchParams({
    user_token: UPIGATEWAY_USER_TOKEN,
    order_id: orderId,
  });
  const response = await fetchWithTimeout(`${UPIGATEWAY_API_BASE}/check-order-status.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) {
    console.error('UPI Gateway status check returned HTTP', response.status);
    throw new Error('Could not verify the payment with UPI Gateway.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('UPI Gateway returned an invalid payment status response.');
  }
  const gatewayStatus = String(result?.result?.status || '').toUpperCase();
  const responseOrderId = String(result?.result?.orderId || result?.result?.order_id || '');
  if (
    String(result?.status || '').toUpperCase() !== 'COMPLETED'
    || responseOrderId !== orderId
    || !['SUCCESS', 'PENDING', 'FAILURE'].includes(gatewayStatus)
  ) {
    throw new Error('UPI Gateway did not return a verifiable status for this order.');
  }

  let amountInRupees = null;
  if (gatewayStatus === 'SUCCESS') {
    const amount = Number(result.result.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(result.result.amount))) {
      throw new Error('UPI Gateway returned an invalid payment amount.');
    }
    const paise = Math.round(amount * 100);
    if (paise % 100 !== 0) {
      throw new Error('The confirmed payment amount does not match the whole-rupee price.');
    }
    amountInRupees = paise / 100;
  }

  if (gatewayStatus === 'SUCCESS' && typeof result.result.utr !== 'string') {
    throw new Error('UPI Gateway did not provide the bank reference for this payment.');
  }

  const reconciliation = await supabaseRequest('rpc/reconcile_upi_payment', {
    method: 'POST',
    body: JSON.stringify({
      p_order_id: orderId,
      p_provider_status: gatewayStatus,
      p_amount_inr: amountInRupees,
      p_provider_utr: gatewayStatus === 'SUCCESS' ? result.result.utr : null,
    }),
  });
  return reconciliation;
}

export async function createBillingOrder({ userId, productType, planCode, durationMonths, seriesId, mobile }) {
  if (isFreeAccessActive()) {
    const error = new Error('All paid access is free through January 1, 2027. Checkout is temporarily disabled.');
    error.statusCode = 409;
    throw error;
  }
  requirePaymentConfig();
  if (!/^[6-9]\d{9}$/.test(String(mobile || ''))) {
    throw new Error('Enter a valid 10-digit Indian mobile number for UPI checkout.');
  }

  let amount;
  if (productType === 'subscription') {
    if (!['lite', 'gold', 'ultimate'].includes(planCode) || ![3, 6, 12].includes(Number(durationMonths))) {
      throw new Error('Choose a valid subscription plan and duration.');
    }
    const query = new URLSearchParams({
      plan_code: `eq.${planCode}`,
      duration_months: `eq.${Number(durationMonths)}`,
      select: 'price_inr,premium_plans!inner(enabled)',
      limit: '1',
    });
    const prices = await supabaseRequest(`premium_plan_prices?${query}`);
    amount = Number(prices?.[0]?.price_inr);
    if (!prices?.[0]?.premium_plans?.enabled || !Number.isInteger(amount) || amount < 1) {
      throw new Error('This subscription term is not currently available for purchase.');
    }
  } else if (productType === 'test_series') {
    if (typeof seriesId !== 'string' || !seriesId.trim() || seriesId.length > 200) {
      throw new Error('Choose a valid test series.');
    }
    const query = new URLSearchParams({
      series_id: `eq.${seriesId}`,
      enabled: 'eq.true',
      select: 'price_inr',
      limit: '1',
    });
    const prices = await supabaseRequest(`test_series_prices?${query}`);
    amount = Number(prices?.[0]?.price_inr);
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error('This test series is not currently available for purchase.');
    }
    const purchaseQuery = new URLSearchParams({
      user_id: `eq.${userId}`,
      series_id: `eq.${seriesId}`,
      status: 'eq.active',
      select: 'id',
      limit: '1',
    });
    const existingPurchases = await supabaseRequest(`test_series_purchases?${purchaseQuery}`);
    if (existingPurchases?.length) throw new Error('You already own this test series.');
  } else {
    throw new Error('Unsupported product type.');
  }

  const orderId = `IMP${Date.now()}${randomBytes(12).toString('hex').toUpperCase()}`;
  const created = await supabaseRequest('rpc/create_upi_payment_order', {
    method: 'POST',
    body: JSON.stringify({
      p_order_id: orderId,
      p_user_id: userId,
      p_product_type: productType,
      p_plan_code: productType === 'subscription' ? planCode : null,
      p_duration_months: productType === 'subscription' ? Number(durationMonths) : null,
      p_series_id: productType === 'test_series' ? seriesId : null,
      p_amount_inr: amount,
    }),
  });
  const createdOrder = Array.isArray(created) ? created[0] : created;
  if (!createdOrder?.order_id) throw new Error('Could not initialize a secure payment order.');

  try {
    const payload = new URLSearchParams({
      customer_mobile: mobile,
      user_token: UPIGATEWAY_USER_TOKEN,
      amount: amount.toFixed(2),
      order_id: orderId,
      redirect_url: (() => {
        const returnUrl = new URL(PAYMENT_RETURN_URL);
        returnUrl.searchParams.set('order_id', orderId);
        return returnUrl.toString();
      })(),
      remark1: productType === 'subscription'
        ? `Impulse ${planCode} ${durationMonths}-month subscription`
        : `Impulse test series ${seriesId}`,
    });
    const response = await fetchWithTimeout(`${UPIGATEWAY_API_BASE}/create-order.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
    });
    if (!response.ok) {
      console.error('UPI Gateway order creation returned HTTP', response.status);
      throw new Error('UPI Gateway could not create the payment order.');
    }

    let gatewayResponse;
    try {
      gatewayResponse = await response.json();
    } catch {
      throw new Error('UPI Gateway returned an invalid order response.');
    }
    const paymentUrl = gatewayResponse?.result?.payment_url;
    const returnedOrderId = String(gatewayResponse?.result?.orderId || gatewayResponse?.result?.order_id || '');
    let parsedPaymentUrl;
    try {
      parsedPaymentUrl = new URL(paymentUrl);
    } catch {
      throw new Error('UPI Gateway did not return a valid payment URL.');
    }
    if (
      gatewayResponse.status !== true
      || returnedOrderId !== orderId
      || parsedPaymentUrl.protocol !== 'https:'
      || parsedPaymentUrl.hostname !== 'free.upigateway.dev'
    ) {
      throw new Error('UPI Gateway returned an unexpected payment-order response.');
    }

    await supabaseRequest(`upi_payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ payment_url: paymentUrl }),
    });
    return { orderId, paymentUrl };
  } catch (error) {
    try {
      await supabaseRequest('rpc/reconcile_upi_payment', {
        method: 'POST',
        body: JSON.stringify({
          p_order_id: orderId,
          p_provider_status: 'FAILURE',
          p_amount_inr: null,
          p_provider_utr: null,
        }),
      });
    } catch (reconcileError) {
      console.error('Could not mark the failed payment-order request.', reconcileError);
    }
    throw error;
  }
}

export async function refreshBillingOrder(orderId, userId) {
  const order = await getBillingOrder(orderId, userId);
  if (!order) return null;
  if (order.status === 'pending') {
    await reconcileGatewayStatus(order.order_id);
    return getBillingOrder(order.order_id, userId);
  }
  return order;
}

export async function handleGatewayWebhook(payload) {
  const orderId = String(payload?.order_id || '').trim();
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(orderId)) return { ignored: true };

  const rows = await supabaseRequest(`upi_payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id&limit=1`);
  if (!rows?.length) return { ignored: true };

  // The documented callback is not signed; always verify its order against the provider status API.
  await reconcileGatewayStatus(orderId);
  return { processed: true };
}

export async function getSeriesAccess(userId, seriesId) {
  if (await hasProAccess(userId)) {
    return { allowed: true, reason: 'pro' };
  }
  if (isFreeAccessActive()) {
    return { allowed: true, reason: 'temporary_free_access' };
  }

  const priceQuery = new URLSearchParams({
    series_id: `eq.${seriesId}`,
    select: 'price_inr',
    limit: '1',
  });
  const priceRows = await supabaseRequest(`test_series_prices?${priceQuery}`);
  const configuredPrice = priceRows?.[0];
  if (!configuredPrice || Number(configuredPrice.price_inr) === 0) {
    return { allowed: true, reason: 'free' };
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
    : { allowed: false, reason: 'payment_required', price_inr: Number(configuredPrice.price_inr) };
}

export function buildSeriesAccessMap(seriesIds, priceRows, purchaseRows, freeAccess = false, proAccess = false) {
  const prices = new Map((priceRows || []).map((row) => [row.series_id, Number(row.price_inr)]));
  const purchases = new Set((purchaseRows || []).map((row) => row.series_id));
  return Object.fromEntries(seriesIds.map((seriesId) => {
    if (proAccess) return [seriesId, { allowed: true, reason: 'pro' }];
    if (freeAccess) return [seriesId, { allowed: true, reason: 'temporary_free_access' }];
    const price = prices.get(seriesId);
    if (price === undefined || price === 0) return [seriesId, { allowed: true, reason: 'free' }];
    if (purchases.has(seriesId)) return [seriesId, { allowed: true, reason: 'purchased' }];
    return [seriesId, { allowed: false, reason: 'payment_required', price_inr: price }];
  }));
}

export async function getSeriesAccessBatch(userId, seriesIds) {
  if (await hasProAccess(userId)) {
    return buildSeriesAccessMap(seriesIds, [], [], false, true);
  }
  if (isFreeAccessActive()) {
    return buildSeriesAccessMap(seriesIds, [], [], true);
  }
  if (seriesIds.length === 0) return {};

  const postgrestInList = `(${seriesIds.map((id) => (
    `"${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  )).join(',')})`;
  const priceQuery = new URLSearchParams({
    series_id: `in.${postgrestInList}`,
    select: 'series_id,price_inr',
  });
  const purchaseQuery = new URLSearchParams({
    user_id: `eq.${userId}`,
    series_id: `in.${postgrestInList}`,
    status: 'eq.active',
    select: 'series_id',
  });
  const [prices, purchases] = await Promise.all([
    supabaseRequest(`test_series_prices?${priceQuery}`),
    supabaseRequest(`test_series_purchases?${purchaseQuery}`),
  ]);
  return buildSeriesAccessMap(seriesIds, prices, purchases);
}
