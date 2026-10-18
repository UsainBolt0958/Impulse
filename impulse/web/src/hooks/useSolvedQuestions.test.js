// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSolvedQuestions } from './useSolvedQuestions';
import { appendSolvedQuestionAttempts } from '@/lib/solvedQuestions';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('useSolvedQuestions', () => {
  it('refreshes when custom-test attempts are appended to the shared store', () => {
    const { result } = renderHook(() => useSolvedQuestions());
    const attempt = {
      question_id: 'custom-question',
      is_correct: true,
      time_taken: 12,
      timestamp: '2026-10-15T08:00:00.000Z',
      attempt_id: 'custom-test:test-1:custom-question',
    };

    act(() => {
      appendSolvedQuestionAttempts([attempt]);
    });

    expect(result.current.solvedQuestions).toEqual([attempt]);
    expect(result.current.getTotalSolved()).toBe(1);
  });

  it('counts each question once across repeat attempts and ignores entries without an id', () => {
    const { result } = renderHook(() => useSolvedQuestions());

    act(() => {
      appendSolvedQuestionAttempts([
        { question_id: 'question-1', is_correct: false, timestamp: '2026-10-15T08:00:00.000Z' },
        { question_id: 'question-1', is_correct: true, timestamp: '2026-10-16T08:00:00.000Z' },
        { is_correct: true, timestamp: '2026-10-16T09:00:00.000Z' },
      ]);
    });

    expect(result.current.getTotalSolved()).toBe(1);
  });

  it('separates unique questions, total attempts, unique solves, and attempt accuracy', () => {
    const { result } = renderHook(() => useSolvedQuestions());

    act(() => {
      appendSolvedQuestionAttempts([
        { question_id: 'question-1', is_correct: false, timestamp: '2026-10-15T08:00:00.000Z' },
        { question_id: 'question-1', is_correct: true, timestamp: '2026-10-15T08:05:00.000Z' },
        { question_id: 'question-2', is_correct: false, timestamp: '2026-10-15T08:10:00.000Z' },
        { is_correct: true, timestamp: '2026-10-15T08:15:00.000Z' },
      ]);
    });

    expect(result.current.getUniqueAttemptedCount()).toBe(2);
    expect(result.current.getTotalAttempts()).toBe(3);
    expect(result.current.getUniqueSolvedCount()).toBe(1);
    expect(result.current.getAccuracy()).toBe('33.3');
  });

  it('stores subject and difficulty for rating calculations', () => {
    const { result } = renderHook(() => useSolvedQuestions());

    act(() => {
      result.current.addSolvedQuestion('physics-question', true, 18, {
        subject: 'Physics',
        difficulty: 'Hard',
      });
    });

    expect(result.current.solvedQuestions[0]).toMatchObject({
      question_id: 'physics-question',
      subject: 'Physics',
      difficulty: 'Hard',
      is_correct: true,
    });
  });
});
