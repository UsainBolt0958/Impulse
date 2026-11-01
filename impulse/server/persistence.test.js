import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const {
  getPersistentStorageUsage,
  readPersistentJson,
  storeUploadedImage,
  writePersistentJson,
} = await import('./persistence.js');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent admin storage', () => {
  it('reads persisted admin JSON instead of local files', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ content: { questions: ['saved'] } }]), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const localRead = vi.fn();

    await expect(readPersistentJson('server/data/admin-state.json', {}, localRead))
      .resolves.toEqual({ questions: ['saved'] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(localRead).not.toHaveBeenCalled();
  });

  it('writes admin JSON to the service-only content table', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const writeLocal = vi.fn();

    await writePersistentJson('server/data/tests.json', [{ id: 'test-1' }], writeLocal);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      key: 'tests.json',
      content: [{ id: 'test-1' }],
    });
    expect(writeLocal).not.toHaveBeenCalled();
  });

  it('returns a public Supabase Storage URL for an uploaded image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const url = await storeUploadedImage('question.svg', 'image/svg+xml', Buffer.from('<svg/>'), vi.fn());

    expect(url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/admin-uploads\//);
  });

  it('totals admin content and uploaded object sizes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { key: 'tests.json', content: { title: 'Test' } },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { metadata: { size: 120 } },
        { metadata: { size: 80 } },
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPersistentStorageUsage()).resolves.toMatchObject({
      bucket: 'admin-uploads',
      uploadCount: 2,
      uploadBytes: 200,
      adminDocumentCount: 1,
      adminContentBytes: Buffer.byteLength(JSON.stringify({ title: 'Test' }), 'utf8'),
      trackedBytes: 200 + Buffer.byteLength(JSON.stringify({ title: 'Test' }), 'utf8'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('continues listing storage objects in pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(
        Array.from({ length: 1000 }, () => ({ metadata: { size: 1 } }))
      ), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { metadata: { size: 2 } },
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPersistentStorageUsage()).resolves.toMatchObject({
      uploadCount: 1001,
      uploadBytes: 1002,
      trackedBytes: 1002,
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).offset).toBe(1000);
  });
});
