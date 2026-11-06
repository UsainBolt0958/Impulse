const SUPABASE_MANAGEMENT_ACCESS_TOKEN = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN || '';
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF
  || /^https:\/\/([a-z\d-]+)\.supabase\.co$/i.exec(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  )?.[1]
  || '';

function flattenUsageMetrics(value, prefix = '', result = []) {
  if (result.length >= 100 || value === null || value === undefined) return result;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenUsageMetrics(entry, `${prefix}[${index}]`, result));
    return result;
  }
  if (typeof value === 'object') {
    const metricName = value.metric || value.name || value.label;
    const metricValue = value.value ?? value.usage;
    if (
      typeof metricName === 'string'
      && metricName.length <= 100
      && (typeof metricValue === 'number' || (typeof metricValue === 'string' && metricValue.length <= 100))
    ) {
      result.push({ metric: metricName, value: metricValue });
      return result;
    }
    Object.entries(value).forEach(([key, entry]) => {
      if (/token|secret|password|key$/i.test(key)) return;
      flattenUsageMetrics(entry, prefix ? `${prefix}.${key}` : key, result);
    });
    return result;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    result.push({ metric: prefix, value });
  }
  return result;
}

export async function getSupabaseProjectMetrics() {
  if (!SUPABASE_MANAGEMENT_ACCESS_TOKEN || !/^[a-z\d-]{10,40}$/i.test(SUPABASE_PROJECT_REF)) {
    return {
      configured: false,
      metrics: [],
      message: 'Set SUPABASE_MANAGEMENT_ACCESS_TOKEN and SUPABASE_PROJECT_REF on the API host.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(SUPABASE_PROJECT_REF)}/usage`,
      {
        headers: { Authorization: `Bearer ${SUPABASE_MANAGEMENT_ACCESS_TOKEN}` },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      console.error('Supabase project usage request returned HTTP', response.status);
      return {
        configured: true,
        status: 'error',
        metrics: [],
        message: response.status === 401 || response.status === 403
          ? 'Supabase Management API access was denied. Check the API-host token and project permissions.'
          : `Supabase project usage is unavailable (HTTP ${response.status}).`,
      };
    }

    const payload = await response.json();
    return {
      configured: true,
      status: 'healthy',
      metrics: flattenUsageMetrics(payload),
      measuredAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Could not load Supabase project usage metrics.', error);
    return {
      configured: true,
      status: 'error',
      metrics: [],
      message: error?.name === 'AbortError'
        ? 'Supabase project usage request timed out.'
        : 'Could not reach the Supabase Management API.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
