// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { loadPublicQuestionsFromServer } = vi.hoisted(() => ({
  loadPublicQuestionsFromServer: vi.fn(),
}));

vi.mock('@/lib/portalServer', () => ({ loadPublicQuestionsFromServer }));

import { useQuestions } from './useQuestions';

describe('useQuestions', () => {
  beforeEach(() => {
    loadPublicQuestionsFromServer.mockReset();
    loadPublicQuestionsFromServer.mockResolvedValue([
      { id: 'physics-1', exam: 'JEE', subject: 'Physics', difficulty: 'Easy' },
      { id: 'chemistry-1', exam: 'JEE', subject: 'Chemistry', difficulty: 'Medium' },
    ]);
  });

  it('memoizes filtered questions until the question bank or filters change', async () => {
    const { result, rerender } = renderHook(() => useQuestions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const initialFilteredQuestions = result.current.filteredQuestions;
    expect(initialFilteredQuestions).toHaveLength(2);

    rerender();
    expect(result.current.filteredQuestions).toBe(initialFilteredQuestions);

    act(() => result.current.updateFilters({ subject: ['Physics'] }));
    expect(result.current.filteredQuestions).toEqual([
      { id: 'physics-1', exam: 'JEE', subject: 'Physics', difficulty: 'Easy' },
    ]);
    expect(result.current.filteredQuestions).not.toBe(initialFilteredQuestions);
  });

  it('preserves first-match lookup and sorted unique values without exposing cached arrays', async () => {
    loadPublicQuestionsFromServer.mockResolvedValue([
      { id: 'duplicate', subject: 'Physics' },
      { id: 'duplicate', subject: 'Chemistry' },
      { id: 'missing-subject' },
    ]);
    const { result } = renderHook(() => useQuestions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getQuestionById('duplicate')).toMatchObject({ subject: 'Physics' });
    expect(result.current.getUniqueValues('subject')).toEqual([
      'Chemistry',
      'Physics',
      undefined,
    ]);

    const firstValues = result.current.getUniqueValues('subject');
    firstValues.pop();
    expect(result.current.getUniqueValues('subject')).toEqual([
      'Chemistry',
      'Physics',
      undefined,
    ]);
  });
});
