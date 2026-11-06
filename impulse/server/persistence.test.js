import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const {
  getSupabaseConnectionStatus,
  getPersistentStorageUsage,
  normalizedQuestionStorageEnabled,
  readPersistentJson,
  readNormalizedQuestionPage,
  readNormalizedQuestions,
  storeUploadedImage,
  writePersistentJson,
} = await import('./persistence.js');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent admin storage', () => {
  it('uses normalized question storage only when explicitly enabled', () => {
    const previous = process.env.SUPABASE_NORMALIZED_QUESTIONS;
    delete process.env.SUPABASE_NORMALIZED_QUESTIONS;
    expect(normalizedQuestionStorageEnabled()).toBe(false);
    process.env.SUPABASE_NORMALIZED_QUESTIONS = 'true';
    expect(normalizedQuestionStorageEnabled()).toBe(true);
    if (previous === undefined) delete process.env.SUPABASE_NORMALIZED_QUESTIONS;
    else process.env.SUPABASE_NORMALIZED_QUESTIONS = previous;
  });

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

  it('coalesces reads for the same persisted document and returns isolated values', async () => {
    let resolveFetch;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);
    const firstRead = readPersistentJson('server/data/engine-questions.json', [], vi.fn());
    const secondRead = readPersistentJson('server/data/engine-questions.json', [], vi.fn());

    resolveFetch(new Response(JSON.stringify([{ content: [{ id: 'question-1' }] }]), { status: 200 }));
    const [first, second] = await Promise.all([firstRead, secondRead]);
    first[0].id = 'changed';

    await expect(readPersistentJson('server/data/engine-questions.json', [], vi.fn()))
      .resolves.toEqual([{ id: 'question-1' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('compacts duplicate test solution fields in storage and restores the API shape', async () => {
    const storedTests = [{
      id: 'test-1',
      sections: [{
        questions: [
          { id: 'q-1', solution: 'same', explanation: 'same' },
          { id: 'q-2', solution: 'solution', explanation: 'different' },
          { id: 'q-3', explanation: 'no solution' },
        ],
      }],
    }];
    const expectedTests = [{
      id: 'test-1',
      sections: [{
        questions: [
          { id: 'q-1', solution: 'same' },
          { id: 'q-2', solution: 'solution', explanation: 'different' },
          { id: 'q-3', explanation: 'no solution' },
        ],
      }],
    }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ content: storedTests }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readPersistentJson('server/data/tests.json', [], vi.fn()))
      .resolves.toEqual([{
        id: 'test-1',
        sections: [{
          questions: [
            { id: 'q-1', solution: 'same', explanation: 'same' },
            { id: 'q-2', solution: 'solution', explanation: 'different' },
            { id: 'q-3', explanation: 'no solution' },
          ],
        }],
      }]);

    await writePersistentJson('server/data/tests.json', expectedTests, vi.fn());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toEqual(expectedTests);
    await expect(readPersistentJson('server/data/tests.json', [], vi.fn()))
      .resolves.toEqual([{
        id: 'test-1',
        sections: [{
          questions: [
            { id: 'q-1', solution: 'same', explanation: 'same' },
            { id: 'q-2', solution: 'solution', explanation: 'different' },
            { id: 'q-3', explanation: 'no solution' },
          ],
        }],
      }]);
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

  it('writes normalized admin saves through the atomic RPC without falling back locally', async () => {
    const previous = process.env.SUPABASE_NORMALIZED_QUESTIONS;
    process.env.SUPABASE_NORMALIZED_QUESTIONS = 'true';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const state = { questions: [{ id: 'q-1', question: 'Saved' }] };
    const writeLocal = vi.fn();

    try {
      await writePersistentJson('server/data/admin-state.json', state, writeLocal);
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_NORMALIZED_QUESTIONS;
      else process.env.SUPABASE_NORMALIZED_QUESTIONS = previous;
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://project.supabase.co/rest/v1/rpc/save_admin_state_and_question_versions',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_content: state });
    expect(writeLocal).not.toHaveBeenCalled();
  });

  it('surfaces a missing normalized-storage RPC instead of falling back to local files', async () => {
    const previous = process.env.SUPABASE_NORMALIZED_QUESTIONS;
    process.env.SUPABASE_NORMALIZED_QUESTIONS = 'true';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('function not found', { status: 404 }),
    ));
    const writeLocal = vi.fn();

    try {
      await expect(writePersistentJson(
        'server/data/admin-state.json',
        { questions: [] },
        writeLocal,
      )).rejects.toThrow('Supabase storage request failed (404)');
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_NORMALIZED_QUESTIONS;
      else process.env.SUPABASE_NORMALIZED_QUESTIONS = previous;
    }

    expect(writeLocal).not.toHaveBeenCalled();
  });

  it('reads normalized question rows in position-ordered batches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        ...Array.from({ length: 1000 }, (_, index) => ({ content: { id: `q-${index + 1}` } })),
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { content: { id: 'q-1001' } },
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const questions = await readNormalizedQuestions();
    expect(questions).toHaveLength(1001);
    expect(questions[0]).toEqual({ id: 'q-1' });
    expect(questions[1000]).toEqual({ id: 'q-1001' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://project.supabase.co/rest/v1/question_versions?select=content&is_current=eq.true&order=position.asc',
      'https://project.supabase.co/rest/v1/question_versions?select=content&is_current=eq.true&order=position.asc',
    ]);
    expect(fetchMock.mock.calls.map(([, options]) => options.headers.Range)).toEqual([
      '0-999',
      '1000-1999',
    ]);
  });

  it('returns an indexed question page and exact total from Supabase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ content: { id: 'q-2' } }]),
      { status: 200, headers: { 'Content-Range': '20-20/31' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readNormalizedQuestionPage({
      exam: ['JEE MAIN'],
      subject: ['Math', 'Physics'],
      chapter: ['Algebra'],
      difficulty: [],
      year: ['2025'],
    }, 2, 20)).resolves.toEqual({
      questions: [{ id: 'q-2' }],
      total: 31,
      page: 2,
      limit: 20,
      hasMore: true,
    });
    const [url, options] = fetchMock.mock.calls[0];
    const query = new URL(url).searchParams;
    expect(query.get('exam')).toBe('eq.JEE MAIN');
    expect(query.get('subject')).toBe('in.("Math","Physics")');
    expect(query.get('chapter')).toBe('eq.Algebra');
    expect(query.get('year')).toBe('eq.2025');
    expect(options.headers.Range).toBe('20-39');
    expect(options.headers.Prefer).toBe('count=exact');
  });

  it('uses the successful write to refresh the cached document', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ content: [{ id: 'old' }] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const localRead = vi.fn();

    await readPersistentJson('server/data/series.json', [], localRead);
    await writePersistentJson('server/data/series.json', [{ id: 'new' }], vi.fn());
    await expect(readPersistentJson('server/data/series.json', [], localRead))
      .resolves.toEqual([{ id: 'new' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retain a large document in the process cache', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(
      JSON.stringify([{ content: { payload: 'x'.repeat(5 * 1024 * 1024 + 1) } }]),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await readPersistentJson('server/data/quiz-challenges.json', {}, vi.fn());
    await readPersistentJson('server/data/quiz-challenges.json', {}, vi.fn());

    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('checks Supabase database and storage API availability', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSupabaseConnectionStatus()).resolves.toMatchObject({
      configured: true,
      database: { status: 'healthy' },
      storage: { status: 'healthy' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://project.supabase.co/rest/v1/admin_content?select=key&limit=1',
      'https://project.supabase.co/storage/v1/bucket/admin-uploads',
    ]);
  });

  it('reports Supabase service health failures without hiding them', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 })));

    await expect(getSupabaseConnectionStatus()).resolves.toMatchObject({
      database: { status: 'error', statusCode: 503 },
      storage: { status: 'healthy' },
    });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
