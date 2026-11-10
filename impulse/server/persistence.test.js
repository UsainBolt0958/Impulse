import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const {
  getSupabaseConnectionStatus,
  getPersistentStorageUsage,
  normalizedQuestionStorageEnabled,
  readPersistentJson,
  readPersistentJsonItem,
  readPersistentJsonItemsByField,
  readNormalizedQuestionPage,
  readCurrentNormalizedQuestionVersions,
  readNormalizedQuestionVersions,
  readNormalizedQuestions,
  readNormalizedQuestionsForSelection,
  storeUploadedImage,
  writePersistentJson,
} = await import('./persistence.js');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent admin storage', () => {
  it('avoids rewriting already-compacted test documents when the SQL is rerun', async () => {
    const migration = await readFile(
      fileURLToPath(new URL('../supabase/compact_test_solutions.sql', import.meta.url)),
      'utf8',
    );

    expect(migration).toMatch(/p_in_question\s+and\s+v_key = 'explanation'/i);
    expect(migration).toMatch(/p_in_question or v_key = 'questions'/i);
    expect(migration).toMatch(/security definer[\s\S]*?compact_duplicate_solution_aliases_recursive\(p_value, false\)/i);
    expect(migration).toMatch(/with compacted as materialized/i);
    expect(migration).toMatch(/begin;[\s\S]*?for update[\s\S]*?tests\.json is missing from admin_content/i);
    expect(migration).toMatch(/tests\.json must be a json array[\s\S]*?tests\.json compaction verification failed[\s\S]*?commit;/i);
    expect(migration).toMatch(/content is distinct from public\.compact_duplicate_solution_aliases\(content\)/i);
    expect(migration).toMatch(/document\.content is distinct from compacted\.content/i);
    expect(migration).toMatch(/where key = 'tests\.json'[\s\S]*?jsonb_typeof\(content\) = 'array'/i);
  });

  it('keeps normalized question ordering unique while allowing admin reorders', async () => {
    const migration = await readFile(
      fileURLToPath(new URL('../supabase/normalized_question_storage.sql', import.meta.url)),
      'utf8',
    );

    expect(migration).toMatch(/position bigint not null check \(position >= 0\)/);
    expect(migration).toMatch(/create unique index if not exists question_versions_current_position[\s\S]*?where is_current;/);
    expect(migration).toMatch(/pg_advisory_xact_lock\(hashtextextended\('admin-state-question-versions', 0\)\)/);
    expect(migration).toMatch(/max\(position\) filter \(where is_current\)/);
    expect(migration).toMatch(/set position = position \+ v_position_offset[\s\S]*?for v_question, v_position in/);
    expect(migration).toMatch(/if v_reorder_positions and exists[\s\S]*?position <> v_position/);
  });

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
          {
            id: 'q-4',
            parts: [{ solution: 'nested', explanation: 'nested' }],
          },
        ],
      }],
      metadata: { solution: 'metadata only' },
    }];
    const expectedTests = [{
      id: 'test-1',
      sections: [{
        questions: [
          { id: 'q-1', solution: 'same' },
          { id: 'q-2', solution: 'solution', explanation: 'different' },
          { id: 'q-3', explanation: 'no solution' },
          {
            id: 'q-4',
            parts: [{ solution: 'nested' }],
          },
        ],
      }],
      metadata: { solution: 'metadata only' },
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
            {
              id: 'q-4',
              parts: [{ solution: 'nested', explanation: 'nested' }],
            },
          ],
        }],
        metadata: { solution: 'metadata only' },
      }]);

    await writePersistentJson('server/data/tests.json', expectedTests, vi.fn());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toEqual([{
      id: 'test-1',
      sections: [{
        questions: [
          { id: 'q-1', solution: 'same' },
          { id: 'q-2', solution: 'solution', explanation: 'different' },
          { id: 'q-3', explanation: 'no solution' },
          {
            id: 'q-4',
            parts: [{ solution: 'nested' }],
          },
        ],
      }],
      metadata: { solution: 'metadata only' },
    }]);
    await expect(readPersistentJson('server/data/tests.json', [], vi.fn()))
      .resolves.toEqual([{
        id: 'test-1',
        sections: [{
          questions: [
            { id: 'q-1', solution: 'same', explanation: 'same' },
            { id: 'q-2', solution: 'solution', explanation: 'different' },
            { id: 'q-3', explanation: 'no solution' },
            {
              id: 'q-4',
              parts: [{ solution: 'nested', explanation: 'nested' }],
            },
          ],
        }],
        metadata: { solution: 'metadata only' },
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

  it('loads exact immutable question versions by question ID and version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { question_id: 'question-1', version: 3, content: { id: 'question-1' } },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readNormalizedQuestionVersions([
      { questionId: 'question-1', version: 3 },
      { questionId: 'question-2', version: 3 },
    ])).resolves.toEqual([
      { question_id: 'question-1', version: 3, content: { id: 'question-1' } },
    ]);

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.searchParams.get('select')).toBe('question_id,version,content');
    expect(requestUrl.searchParams.get('version')).toBe('eq.3');
    expect(requestUrl.searchParams.get('question_id')).toBe('in.("question-1","question-2")');
  });

  it('loads current immutable versions for selected test questions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { question_id: 'question-1', version: 2, content: { id: 'question-1' } },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readCurrentNormalizedQuestionVersions(['question-1', 'question-1']))
      .resolves.toEqual([
        { question_id: 'question-1', version: 2, content: { id: 'question-1' } },
      ]);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('is_current')).toBe('eq.true');
  });

  it('includes the immutable version number with selected custom-test questions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { version: 5, content: { id: 'question-1', question_text: 'Prompt' } },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readNormalizedQuestionsForSelection({
      exam: 'JEE MAINS',
      subjects: ['Physics'],
      chapters: ['Mechanics'],
      years: ['2025'],
      difficulty: 'easy',
    })).resolves.toEqual([{
      id: 'question-1',
      question_text: 'Prompt',
      question_version: 5,
    }]);
  });

  it('validates versioned-reference migration ordering and keeps unmatched snapshots', async () => {
    const migration = await readFile(
      fileURLToPath(new URL('../supabase/version_test_question_references.sql', import.meta.url)),
      'utf8',
    );
    const rollback = await readFile(
      fileURLToPath(new URL('../supabase/restore_test_question_snapshots.sql', import.meta.url)),
      'utf8',
    );

    expect(migration).toMatch(/question_versions is missing; run normalized_question_storage\.sql first/i);
    expect(migration).toMatch(/question_version_matches_test_question/);
    expect(migration).toMatch(/p_question \? 'questionRef'[\s\S]*?return p_question/i);
    expect(migration).toMatch(/storage_key = 'impulse_custom_test_results'[\s\S]*?value is distinct from/i);
    expect(migration).toMatch(/v_version\.content->>'id' = v_question_id/);
    expect(migration).toMatch(/begin;[\s\S]*?commit;/i);
    expect(rollback).toMatch(/restore_test_question_version_snapshot/);
    expect(rollback).toMatch(/restore_test_result_question_snapshot/);
    expect(rollback).toMatch(/Test question snapshot rollback verification failed/);
    expect(rollback).not.toMatch(/drop table public\.question_versions/i);
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

  it('indexes collection items briefly, returns isolated rows, and invalidates after writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await writePersistentJson('server/data/series.json', [
      { id: 'series-1', title: 'Original' },
      { id: 'series-1', title: 'Duplicate' },
    ], vi.fn());
    fetchMock.mockClear();

    const first = await readPersistentJsonItem('server/data/series.json', 'series-1', [], vi.fn());
    first.title = 'Mutated';
    await expect(readPersistentJsonItem('server/data/series.json', 'series-1', [], vi.fn()))
      .resolves.toEqual({ id: 'series-1', title: 'Original' });
    expect(fetchMock).not.toHaveBeenCalled();

    await writePersistentJson('server/data/series.json', [
      { id: 'series-1', title: 'Updated' },
    ], vi.fn());
    await expect(readPersistentJsonItem('server/data/series.json', 'series-1', [], vi.fn()))
      .resolves.toEqual({ id: 'series-1', title: 'Updated' });
  });

  it('indexes collection groups by field and invalidates grouped reads after writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await writePersistentJson('server/data/tests.json', [
      { id: 'test-1', seriesId: 'series-1' },
      { id: 'test-2', seriesId: 'series-1' },
      { id: 'test-3', seriesId: 'series-2' },
    ], vi.fn());
    fetchMock.mockClear();

    const first = await readPersistentJsonItemsByField('server/data/tests.json', 'series-1', [], vi.fn());
    first[0].id = 'mutated';
    await expect(readPersistentJsonItemsByField('server/data/tests.json', 'series-1', [], vi.fn()))
      .resolves.toEqual([
        { id: 'test-1', seriesId: 'series-1' },
        { id: 'test-2', seriesId: 'series-1' },
      ]);
    expect(fetchMock).not.toHaveBeenCalled();

    await writePersistentJson('server/data/tests.json', [
      { id: 'test-4', seriesId: 'series-1' },
    ], vi.fn());
    await expect(readPersistentJsonItemsByField('server/data/tests.json', 'series-1', [], vi.fn()))
      .resolves.toEqual([{ id: 'test-4', seriesId: 'series-1' }]);
  });

  it('does not retain a large document in the process cache', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(writePersistentJson('server/data/engine-questions.json', [], vi.fn()))
      .rejects.toThrow();

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => new Response(
      JSON.stringify([{ content: { payload: 'x'.repeat(5 * 1024 * 1024 + 1) } }]),
      { status: 200 }
    ));

    await readPersistentJson('server/data/engine-questions.json', {}, vi.fn());
    await readPersistentJson('server/data/engine-questions.json', {}, vi.fn());

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
