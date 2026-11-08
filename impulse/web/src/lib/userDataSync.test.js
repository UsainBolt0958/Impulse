// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalUserData, isUserDataKey, startUserDataSync } from './userDataSync';

describe('user data sync keys', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defines an RLS-protected, idempotent append-only attempt migration', async () => {
    const migrationPath = [
      resolve(process.cwd(), 'supabase/append_only_study_attempts.sql'),
      resolve(process.cwd(), '../supabase/append_only_study_attempts.sql'),
    ].find(existsSync);
    expect(migrationPath).toBeDefined();
    const migration = await readFile(
      migrationPath,
      'utf8',
    );
    const rollback = await readFile(
      resolve(dirname(migrationPath), 'restore_study_attempts_to_user_data.sql'),
      'utf8',
    );

    expect(migration).toMatch(/primary key \(user_id, attempt_id\)/i);
    expect(migration).toMatch(/alter table public\.study_attempts enable row level security/i);
    expect(migration).toMatch(/on conflict \(user_id, attempt_id\) do nothing/i);
    expect(migration).toMatch(/auth\.uid\(\)/i);
    expect(migration).toMatch(/grant execute on function public\.append_study_attempts\(jsonb\) to authenticated/i);
    expect(migration).not.toMatch(/delete from public\.user_data/i);
    expect(rollback).toMatch(/insert into public\.user_data/i);
    expect(rollback).toMatch(/on conflict \(user_id, storage_key\) do update/i);
    expect(rollback).not.toMatch(/drop table|delete from public\.study_attempts/i);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('includes study history, saved work, analytics, and exam sessions', () => {
    [
      'impulse_solved',
      'impulse_marked',
      'impulse_notebooks',
      'impulse_profile_stat_visibility',
      'impulse_custom_test_results',
      'theme',
      'solve_font_size',
      'custom_test_font_size',
      'exam_sync_queue',
      'exam_analytics_session-123',
      'exam_analytics_emergency',
      'exam_checkpoint_session-123_1700000000000',
      'test_analytics_history',
      'test_series_test-123_data_v1',
      'test_series_test-123_sess_v1',
      'test_series_test-123_sess_v1_hash',
      'jee_adv_sess_v2_hash',
      'jee_adv_2025_data_v1',
      'jee_adv_2025_sess_v1_hash',
      'exam_session_session-123',
      'exam_session_session-123_chunks',
      'exam_session_session-123_chunk_0',
    ].forEach((key) => expect(isUserDataKey(key)).toBe(true));
  });

  it('excludes admin state, public question data, and quiz access tokens', () => {
    [
      'impulse_admin_exams',
      'impulse_questions',
      'impulse_custom_test_session',
      'exam_hidden_warning',
    ].forEach((key) => expect(isUserDataKey(key)).toBe(false));
  });

  it('clears only signed-in user data from the browser on sign-out', async () => {
    window.localStorage.setItem('impulse_solved', '[]');
    window.localStorage.setItem('test_series_test-123_sess_v1', '{}');
    window.localStorage.setItem('impulse_custom_test_session', '{"id":"active-test"}');
    window.localStorage.setItem('impulse_admin_exams', '[]');
    window.localStorage.setItem('theme', 'dark');

    await clearLocalUserData();

    expect(window.localStorage.getItem('impulse_solved')).toBeNull();
    expect(window.localStorage.getItem('test_series_test-123_sess_v1')).toBeNull();
    expect(window.localStorage.getItem('impulse_custom_test_session')).toBeNull();
    expect(window.localStorage.getItem('impulse_admin_exams')).toBe('[]');
    expect(window.localStorage.getItem('theme')).toBeNull();
  });

  it('imports browser study history and syncs later browser changes', async () => {
    window.localStorage.setItem('impulse_solved', JSON.stringify([
      { question_id: 'question-1', is_correct: true },
    ]));
    window.localStorage.setItem('impulse_marked', JSON.stringify(['local-question']));
    window.localStorage.setItem('impulse_notebooks', JSON.stringify([
      { id: 'notebook-1', name: 'Local notebook', questionIds: ['local-question'] },
    ]));
    window.localStorage.setItem('theme', 'light');
    const savedRows = new Map();
    savedRows.set('impulse_marked', {
      storage_key: 'impulse_marked',
      value: ['remote-question'],
    });
    savedRows.set('impulse_notebooks', {
      storage_key: 'impulse_notebooks',
      value: [{ id: 'notebook-1', name: 'Cloud notebook', questionIds: ['remote-question'] }],
    });
    savedRows.set('theme', { storage_key: 'theme', value: 'dark' });
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [...savedRows.values()], error: null };
              },
            };
          },
          async upsert(row) {
            savedRows.set(row.storage_key, row);
            return { error: null };
          },
          delete() {
            return {
              eq() {
                return {
                  async eq(_column, key) {
                    savedRows.delete(key);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
    let status = 'idle';
    const stop = startUserDataSync(client, 'user-1', (nextStatus) => {
      status = nextStatus;
    });

    await vi.waitFor(() => {
      expect(status).toBe('synced');
      expect(savedRows.get('impulse_solved')?.value).toEqual([
        { question_id: 'question-1', is_correct: true },
      ]);
      expect(savedRows.get('impulse_marked')?.value).toEqual([
        'remote-question',
        'local-question',
      ]);
      expect(savedRows.get('impulse_notebooks')?.value).toEqual([
        {
          id: 'notebook-1',
          name: 'Local notebook',
          questionIds: ['remote-question', 'local-question'],
        },
      ]);
      expect(window.localStorage.getItem('theme')).toBe('light');
    });

    window.localStorage.setItem('impulse_marked', JSON.stringify(['question-2']));
    await vi.waitFor(() => {
      expect(savedRows.get('impulse_marked')?.value).toEqual(['question-2']);
    });
    stop();
  });

  it('finishes local account-data reconciliation before background cloud writes complete', async () => {
    let finishUpsert;
    let upsertStarted = false;
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
          upsert() {
            upsertStarted = true;
            return new Promise((resolve) => {
              finishUpsert = () => resolve({ error: null });
            });
          },
          delete() {
            return {
              eq() {
                return {
                  async eq() {
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
    window.localStorage.setItem('impulse_marked', JSON.stringify(['local-question']));
    let status = 'idle';
    const stop = startUserDataSync(client, 'user-1', (nextStatus) => {
      status = nextStatus;
    });

    try {
      await vi.waitFor(() => {
        expect(upsertStarted).toBe(true);
        expect(status).toBe('syncing');
      });
      expect(JSON.parse(window.localStorage.getItem('impulse_marked'))).toEqual(['local-question']);

      finishUpsert();
      await vi.waitFor(() => expect(status).toBe('synced'));
    } finally {
      stop();
    }
  });

  it('does not apply an old account response after its sync is stopped', async () => {
    let resolveOldAccountRead;
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return new Promise((resolve) => {
                  resolveOldAccountRead = resolve;
                });
              },
            };
          },
        };
      },
    };
    const oldAccountSync = startUserDataSync(client, 'old-user', () => {});

    await vi.waitFor(() => expect(resolveOldAccountRead).toBeDefined());
    oldAccountSync();
    window.localStorage.setItem('impulse_solved', JSON.stringify([
      { question_id: 'new-account-attempt', is_correct: true },
    ]));
    resolveOldAccountRead({
      data: [{
        storage_key: 'impulse_solved',
        value: [{ question_id: 'old-account-private-attempt', is_correct: true }],
      }],
      error: null,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(JSON.parse(window.localStorage.getItem('impulse_solved'))).toEqual([
      { question_id: 'new-account-attempt', is_correct: true },
    ]);
  });

  it('does not start additional writes after an account sync is stopped', async () => {
    let finishFirstWrite;
    const writes = [];
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
          upsert(row) {
            writes.push(row);
            return new Promise((resolve) => {
              finishFirstWrite = () => resolve({ error: null });
            });
          },
        };
      },
    };
    window.localStorage.setItem('theme', 'light');
    window.localStorage.setItem('impulse_marked', JSON.stringify(['account-one-bookmark']));
    const stop = startUserDataSync(client, 'account-one', () => {});

    try {
      await vi.waitFor(() => expect(writes).toHaveLength(1));
      stop();
      window.localStorage.setItem('impulse_marked', JSON.stringify(['account-two-bookmark']));
      finishFirstWrite();
      await Promise.resolve();
      await Promise.resolve();
      expect(writes).toHaveLength(1);
      expect(writes[0].user_id).toBe('account-one');
      expect(writes[0].value).toBe('light');
    } finally {
      finishFirstWrite?.();
    }
  });

  it('does not send full custom-test sessions through the generic user-data sync', async () => {
    const savedRows = new Map();
    let sessionWrites = 0;
    let upsertCount = 0;
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [...savedRows.values()], error: null };
              },
            };
          },
          async upsert(row) {
            upsertCount += 1;
            savedRows.set(row.storage_key, row);
            if (row.storage_key === 'impulse_custom_test_session') sessionWrites += 1;
            return { error: null };
          },
          delete() {
            return {
              eq(_column, _userId) {
                return {
                  async eq(_column, key) {
                    savedRows.delete(key);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    window.localStorage.setItem('impulse_custom_test_session', JSON.stringify({
      questions: [{ id: 'question-1', prompt: 'Original' }],
    }));
    const stop = startUserDataSync(client, 'user-1', () => {});

    try {
      window.localStorage.setItem('impulse_custom_test_session', JSON.stringify({
        questions: [{ id: 'question-1', prompt: 'Updated' }],
      }));
      window.localStorage.setItem('theme', 'dark');

      await vi.waitFor(() => expect(savedRows.get('theme')?.value).toBe('dark'));
      expect(upsertCount).toBe(1);
      expect(sessionWrites).toBe(0);
      expect(window.localStorage.getItem('impulse_custom_test_session')).toContain('Updated');
    } finally {
      stop();
    }
  });

  it('coalesces repeated test-series session syncs to a 90-second cloud checkpoint', async () => {
    vi.useFakeTimers();
    const writes = [];
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
          async upsert(row) {
            writes.push(row);
            return { error: null };
          },
        };
      },
    };
    const sessionKey = 'test_series_test-1_sess_v1';
    window.localStorage.setItem(sessionKey, JSON.stringify({ answer: 'A', savedAt: 1 }));
    const stop = startUserDataSync(client, 'user-1', () => {});

    try {
      for (let attempt = 0; attempt < 20 && writes.length < 1; attempt++) await Promise.resolve();
      expect(writes).toHaveLength(1);
      window.localStorage.setItem(sessionKey, JSON.stringify({ answer: 'B', savedAt: 2 }));
      await vi.advanceTimersByTimeAsync(89_999);
      expect(writes).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      for (let attempt = 0; attempt < 20 && writes.length < 2; attempt++) await Promise.resolve();
      expect(writes).toHaveLength(2);
      expect(writes[1].value).toEqual({ answer: 'B', savedAt: 2 });
    } finally {
      stop();
    }
  });

  it('flushes pending test-series session progress immediately when the page becomes hidden', async () => {
    vi.useFakeTimers();
    const writes = [];
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
          async upsert(row) {
            writes.push(row);
            return { error: null };
          },
        };
      },
    };
    const sessionKey = 'test_series_test-2_sess_v1';
    window.localStorage.setItem(sessionKey, JSON.stringify({ answer: 'A' }));
    let status = 'idle';
    const stop = startUserDataSync(client, 'user-1', (nextStatus) => {
      status = nextStatus;
    });

    try {
      for (let attempt = 0; attempt < 20 && status !== 'synced'; attempt++) await Promise.resolve();
      expect(writes).toHaveLength(1);
      window.localStorage.setItem(sessionKey, JSON.stringify({ answer: 'B' }));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      for (let attempt = 0; attempt < 20 && writes.length < 2; attempt++) await Promise.resolve();
      expect(writes).toHaveLength(2);
      expect(writes[1].value).toEqual({ answer: 'B' });
    } finally {
      delete document.visibilityState;
      stop();
    }
  });

  it('syncs test-series session removals immediately', async () => {
    vi.useFakeTimers();
    const deletes = [];
    let status = 'idle';
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return { data: [], error: null };
              },
            };
          },
          async upsert() {
            return { error: null };
          },
          delete() {
            return {
              eq() {
                return {
                  async eq(_column, key) {
                    deletes.push(key);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
    const sessionKey = 'test_series_test-3_sess_v1';
    window.localStorage.setItem(sessionKey, JSON.stringify({ answer: 'A' }));
    const stop = startUserDataSync(client, 'user-1', (nextStatus) => {
      status = nextStatus;
    });

    try {
      for (let attempt = 0; attempt < 20 && status !== 'synced'; attempt++) await Promise.resolve();
      window.localStorage.removeItem(sessionKey);
      await vi.advanceTimersByTimeAsync(0);
      for (let attempt = 0; attempt < 20 && deletes.length === 0; attempt++) await Promise.resolve();
      expect(deletes).toEqual([sessionKey]);
    } finally {
      stop();
    }
  });

  it('appends only new solved attempts while merging legacy and normalized history', async () => {
    vi.stubEnv('VITE_SUPABASE_APPEND_ONLY_ATTEMPTS', 'true');
    const legacyAttempt = {
      question_id: 'legacy-question',
      is_correct: true,
      timestamp: '2026-11-01T10:00:00.000Z',
    };
    const legacyAttemptWithDifferentPropertyOrder = {
      timestamp: '2026-11-01T10:00:00.000Z',
      is_correct: true,
      question_id: 'legacy-question',
    };
    const normalizedAttempt = {
      question_id: 'normalized-question',
      is_correct: false,
      timestamp: '2026-11-02T10:00:00.000Z',
    };
    const localOnlyAttempt = {
      question_id: 'offline-question',
      is_correct: true,
      timestamp: '2026-11-03T10:00:00.000Z',
    };
    window.localStorage.setItem('impulse_solved', JSON.stringify([
      legacyAttemptWithDifferentPropertyOrder,
      localOnlyAttempt,
    ]));
    const rpcCalls = [];
    const upsertCalls = [];
    const client = {
      from(table) {
        if (table === 'user_data') {
          return {
            select() {
              return {
                async eq() {
                  return {
                    data: [{ storage_key: 'impulse_solved', value: [legacyAttempt] }],
                    error: null,
                  };
                },
              };
            },
            async upsert(row) {
              upsertCalls.push(row);
              return { error: null };
            },
          };
        }

        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      async range() {
                        return {
                          data: [{
                            attempt_id: 'legacy-normalized-id',
                            attempt: normalizedAttempt,
                          }],
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      async rpc(name, args) {
        rpcCalls.push({ name, args });
        return { data: 1, error: null };
      },
    };
    const stop = startUserDataSync(client, 'user-1', () => {});

    try {
      await vi.waitFor(() => {
        expect(rpcCalls).toHaveLength(1);
        expect(window.localStorage.getItem('impulse_solved')).not.toBeNull();
      });

      expect(rpcCalls[0]).toEqual({
        name: 'append_study_attempts',
        args: { p_attempts: [localOnlyAttempt] },
      });
      expect(upsertCalls.some((row) => row.storage_key === 'impulse_solved')).toBe(false);
      expect(JSON.parse(window.localStorage.getItem('impulse_solved'))).toEqual([
        legacyAttempt,
        normalizedAttempt,
        localOnlyAttempt,
      ]);
    } finally {
      stop();
    }
  });

  it('loads normalized history in pages beyond the Supabase row limit', async () => {
    vi.stubEnv('VITE_SUPABASE_APPEND_ONLY_ATTEMPTS', 'true');
    const savedAttempts = Array.from({ length: 1003 }, (_, index) => ({
      attempt_id: `attempt-${String(index).padStart(4, '0')}`,
      attempt: { question_id: `question-${index}`, is_correct: index % 2 === 0 },
    }));
    const requestedRanges = [];
    const client = {
      from(table) {
        if (table === 'user_data') {
          return {
            select() {
              return {
                async eq() {
                  return { data: [], error: null };
                },
              };
            },
          };
        }
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      async range(start, end) {
                        requestedRanges.push([start, end]);
                        return {
                          data: savedAttempts.slice(start, end + 1),
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      async rpc() {
        throw new Error('No append should be needed for cloud-only history.');
      },
    };
    const stop = startUserDataSync(client, 'user-1', () => {});

    try {
      await vi.waitFor(() => {
        expect(JSON.parse(window.localStorage.getItem('impulse_solved'))).toHaveLength(1003);
      });
      expect(requestedRanges).toEqual([
        [0, 999],
        [1000, 1999],
      ]);
    } finally {
      stop();
    }
  });

  it('chunks large solved-attempt appends into bounded RPC payloads', async () => {
    vi.stubEnv('VITE_SUPABASE_APPEND_ONLY_ATTEMPTS', 'true');
    const attempts = Array.from({ length: 251 }, (_, index) => ({
      question_id: `question-${index}`,
      is_correct: index % 2 === 0,
      timestamp: `2026-11-01T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    window.localStorage.setItem('impulse_solved', JSON.stringify(attempts));
    const batches = [];
    const client = {
      from(table) {
        if (table === 'user_data') {
          return {
            select() {
              return {
                async eq() {
                  return { data: [], error: null };
                },
              };
            },
          };
        }
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      async range() {
                        return { data: [], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      async rpc(name, args) {
        batches.push({ name, size: args.p_attempts.length });
        return { data: args.p_attempts.length, error: null };
      },
    };
    const stop = startUserDataSync(client, 'user-1', () => {});

    try {
      await vi.waitFor(() => expect(batches).toHaveLength(2));
      expect(batches).toEqual([
        { name: 'append_study_attempts', size: 250 },
        { name: 'append_study_attempts', size: 1 },
      ]);
    } finally {
      stop();
    }
  });
});
