// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalUserData, isUserDataKey, startUserDataSync } from './userDataSync';

describe('user data sync keys', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('includes study history, saved work, analytics, and exam sessions', () => {
    [
      'impulse_solved',
      'impulse_marked',
      'impulse_notebooks',
      'impulse_profile_stat_visibility',
      'impulse_custom_test_results',
      'impulse_quiz_player_id',
      'impulse_quiz_player_name',
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
      'impulse_quiz_player_token:challenge-1',
      'exam_hidden_warning',
    ].forEach((key) => expect(isUserDataKey(key)).toBe(false));
  });

  it('clears only signed-in user data from the browser on sign-out', async () => {
    window.localStorage.setItem('impulse_solved', '[]');
    window.localStorage.setItem('test_series_test-123_sess_v1', '{}');
    window.localStorage.setItem('impulse_admin_exams', '[]');
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('impulse_quiz_player_token:challenge-1', 'private-token');

    await clearLocalUserData();

    expect(window.localStorage.getItem('impulse_solved')).toBeNull();
    expect(window.localStorage.getItem('test_series_test-123_sess_v1')).toBeNull();
    expect(window.localStorage.getItem('impulse_admin_exams')).toBe('[]');
    expect(window.localStorage.getItem('theme')).toBeNull();
    expect(window.localStorage.getItem('impulse_quiz_player_token:challenge-1')).toBeNull();
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
});
