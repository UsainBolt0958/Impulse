import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendSolvedQuestionAttempts, SOLVED_QUESTIONS_KEY } from './solvedQuestions';

describe('appendSolvedQuestionAttempts', () => {
  const values = new Map();

  beforeEach(() => {
    values.clear();
    globalThis.window = {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('adds answered custom-test questions to the shared solved-question store', () => {
    const existing = [{ question_id: 'pyq-question', is_correct: true }];
    window.localStorage.setItem(SOLVED_QUESTIONS_KEY, JSON.stringify(existing));
    const attempts = [{
      question_id: 'custom-question',
      is_correct: false,
      time_taken: 24,
      timestamp: '2026-10-15T08:00:00.000Z',
      attempt_id: 'custom-test:test-1:custom-question',
    }];

    const updated = appendSolvedQuestionAttempts(attempts);

    expect(updated).toEqual([...existing, ...attempts]);
    expect(JSON.parse(window.localStorage.getItem(SOLVED_QUESTIONS_KEY))).toEqual(updated);
  });

  it('does not add the same custom-test attempt more than once', () => {
    const attempt = {
      question_id: 'custom-question',
      is_correct: true,
      time_taken: 18,
      timestamp: '2026-10-15T08:00:00.000Z',
      attempt_id: 'custom-test:test-1:custom-question',
    };

    appendSolvedQuestionAttempts([attempt]);
    const updated = appendSolvedQuestionAttempts([attempt]);

    expect(updated).toEqual([attempt]);
  });

  it('recovers from invalid saved data and reports the malformed value', () => {
    const attempt = { question_id: 'custom-question', is_correct: true };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    values.set(SOLVED_QUESTIONS_KEY, '{invalid');

    const updated = appendSolvedQuestionAttempts([attempt]);

    expect(updated).toEqual([attempt]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
