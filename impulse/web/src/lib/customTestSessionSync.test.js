import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let createCustomTestCloudSession;
let completeCustomTestCloudSession;
let getCustomTestSessionProgress;
let loadCustomTestCloudSession;
let saveCustomTestCloudProgress;

const session = {
  id: 'custom-test-1',
  exam: 'JEE MAINS',
  difficulty: 'moderate-hard',
  startedAt: 1_000,
  updatedAt: '2026-11-05T10:00:00.000Z',
  endsAt: 601_000,
  durationSeconds: 600,
  subjects: [{ name: 'Physics', questionIds: ['question-1'] }],
  marks: { MCQ: { correct: 4, wrong: -1 } },
  questions: [{ id: 'question-1', question_text: 'Large question body' }],
  answers: { 'question-1': 'A' },
  timeSpent: { 'question-1': 12 },
  currentIndex: 0,
  markedForReview: [],
  bookmarked: ['question-1'],
};

function authenticatedClient(overrides = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.doMock('./supabase', () => ({ supabase: null }));
  ({
    createCustomTestCloudSession,
    completeCustomTestCloudSession,
    getCustomTestSessionProgress,
    loadCustomTestCloudSession,
    saveCustomTestCloudProgress,
  } = await import('./customTestSessionSync.js'));
});

afterEach(() => {
  vi.doUnmock('./supabase');
});

describe('custom test cloud checkpoints', () => {
  it('separates the one-time question snapshot from compact progress checkpoints', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = authenticatedClient({ rpc });
    await createCustomTestCloudSession(session, client);

    expect(rpc).toHaveBeenCalledWith('save_custom_test_session', expect.objectContaining({
      p_session_id: 'custom-test-1',
      p_questions: session.questions,
      p_progress: {
        answers: session.answers,
        bookmarked: session.bookmarked,
        currentIndex: 0,
        markedForReview: [],
        timeSpent: session.timeSpent,
        updatedAt: session.updatedAt,
      },
    }));
    expect(rpc.mock.calls[0][1].p_metadata).not.toHaveProperty('questions');
    expect(getCustomTestSessionProgress(session)).not.toHaveProperty('questions');
  });

  it('updates only the progress row, scoped to the signed-in user and active session', async () => {
    let updatePayload;
    const query = {
      eq: vi.fn(function eq() { return this; }),
      select: vi.fn(function select() { return this; }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { session_id: session.id },
        error: null,
      }),
    };
    const client = authenticatedClient({
      from: vi.fn().mockReturnValue({
        update: vi.fn((payload) => {
          updatePayload = payload;
          return query;
        }),
      }),
    });

    await saveCustomTestCloudProgress(session, client);

    expect(updatePayload).toEqual({
      progress: getCustomTestSessionProgress(session),
      updated_at: expect.any(String),
    });
    expect(query.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['session_id', session.id],
      ['status', 'active'],
    ]);
  });

  it('restores the latest saved progress with its separate immutable question snapshot', async () => {
    const row = {
      session_id: session.id,
      metadata: {
        exam: session.exam,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
      },
      progress: {
        answers: { 'question-1': 'B' },
        currentIndex: 0,
        timeSpent: { 'question-1': 20 },
        updatedAt: '2026-11-05T10:01:00.000Z',
      },
      updated_at: '2026-11-05T10:01:00.000Z',
      status: 'active',
    };
    const client = authenticatedClient({
      from: vi.fn((table) => ({
        select: vi.fn(function select() { return this; }),
        eq: vi.fn(function eq() { return this; }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'custom_test_sessions'
            ? row
            : { questions: session.questions },
          error: null,
        }),
      })),
    });

    await expect(loadCustomTestCloudSession(null, client)).resolves.toMatchObject({
      id: session.id,
      exam: session.exam,
      answers: { 'question-1': 'B' },
      timeSpent: { 'question-1': 20 },
      questions: session.questions,
    });
  });

  it('migrates an old full-session user_data value before removing the legacy row', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const deleteQuery = {
      eq: vi.fn(function eq() { return this; }),
    };
    const client = authenticatedClient({
      rpc,
      from: vi.fn((table) => {
        if (table === 'custom_test_sessions') {
          return {
            select: vi.fn(function select() { return this; }),
            eq: vi.fn(function eq() { return this; }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn(function select() { return this; }),
          eq: vi.fn(function eq() { return this; }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { value: session }, error: null }),
          delete: vi.fn(() => deleteQuery),
        };
      }),
    });

    await expect(loadCustomTestCloudSession(null, client)).resolves.toMatchObject({
      id: session.id,
      questions: session.questions,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(deleteQuery.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['storage_key', 'impulse_custom_test_session'],
    ]);
  });

  it('creates a compact cloud snapshot when a local-only session signs in later', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = authenticatedClient({
      rpc,
      from: vi.fn((table) => ({
        select: vi.fn(function select() { return this; }),
        eq: vi.fn(function eq() { return this; }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === 'custom_test_sessions' ? null : null,
          error: null,
        }),
      })),
    });

    await expect(loadCustomTestCloudSession(session, client)).resolves.toBe(session);
    expect(rpc).toHaveBeenCalledWith('save_custom_test_session', expect.objectContaining({
      p_session_id: session.id,
      p_questions: session.questions,
    }));
  });

  it('replaces an older completed cloud marker with a newer offline local test', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = authenticatedClient({
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(function select() { return this; }),
        eq: vi.fn(function eq() { return this; }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            session_id: 'completed-test',
            status: 'completed',
            updated_at: '2026-11-05T09:00:00.000Z',
          },
          error: null,
        }),
      })),
    });

    await expect(loadCustomTestCloudSession(session, client)).resolves.toBe(session);
    expect(rpc).toHaveBeenCalledWith('save_custom_test_session', expect.objectContaining({
      p_session_id: session.id,
    }));
  });

  it('does not revive a local session older than its cloud completion marker', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = authenticatedClient({
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(function select() { return this; }),
        eq: vi.fn(function eq() { return this; }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            session_id: 'completed-test',
            status: 'completed',
            updated_at: '2026-11-05T10:00:00.000Z',
          },
          error: null,
        }),
      })),
    });
    const staleSession = { ...session, updatedAt: '2026-11-05T09:00:00.000Z' };

    await expect(loadCustomTestCloudSession(staleSession, client)).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not access cloud data without an authenticated user and completes by session id', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = authenticatedClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
      rpc,
    });
    await expect(createCustomTestCloudSession(session, client)).resolves.toBe(false);
    await expect(loadCustomTestCloudSession(session, client)).resolves.toBe(session);
    expect(rpc).not.toHaveBeenCalled();

    client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    await completeCustomTestCloudSession(session.id, client);
    expect(rpc).toHaveBeenCalledWith('complete_custom_test_session', {
      p_session_id: session.id,
    });
  });
});
