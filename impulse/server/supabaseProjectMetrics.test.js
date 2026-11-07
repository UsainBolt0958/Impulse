import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Supabase project metrics', () => {
  it('requires server-only project management credentials', async () => {
    vi.stubEnv('SUPABASE_MANAGEMENT_ACCESS_TOKEN', '');
    vi.stubEnv('SUPABASE_PROJECT_REF', '');
    vi.resetModules();
    const { getSupabaseProjectMetrics } = await import('./supabaseProjectMetrics.js');

    await expect(getSupabaseProjectMetrics()).resolves.toMatchObject({
      configured: false,
      metrics: [],
    });
  });

  it('reads numeric usage metrics from the Management API without exposing credentials', async () => {
    vi.stubEnv('SUPABASE_MANAGEMENT_ACCESS_TOKEN', 'private-management-token');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghij1234567890');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      database_size_bytes: 4096,
      usage: [{ metric: 'monthly_active_users', value: 12 }],
      service_role_key: 'must-not-be-returned',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { getSupabaseProjectMetrics } = await import('./supabaseProjectMetrics.js');

    const result = await getSupabaseProjectMetrics();
    expect(result).toMatchObject({
      configured: true,
      status: 'healthy',
      metrics: [
        { metric: 'database_size_bytes', value: 4096 },
        { metric: 'monthly_active_users', value: 12 },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.supabase.com/v1/projects/abcdefghij1234567890/usage',
      expect.objectContaining({
        headers: { Authorization: 'Bearer private-management-token' },
      })
    );
    expect(JSON.stringify(result)).not.toContain('must-not-be-returned');
    expect(JSON.stringify(result)).not.toContain('private-management-token');
  });

  it('returns an explicit status when project usage is denied', async () => {
    vi.stubEnv('SUPABASE_MANAGEMENT_ACCESS_TOKEN', 'private-management-token');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghij1234567890');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    vi.resetModules();
    const { getSupabaseProjectMetrics } = await import('./supabaseProjectMetrics.js');

    await expect(getSupabaseProjectMetrics()).resolves.toMatchObject({
      configured: true,
      status: 'error',
      message: expect.stringContaining('access was denied'),
    });
  });
});
