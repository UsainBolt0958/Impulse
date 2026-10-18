// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useNotebooks } from './useNotebooks';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('useNotebooks', () => {
  it('creates notebooks and persists questions without duplicates', () => {
    const { result } = renderHook(() => useNotebooks());
    let notebook;

    act(() => {
      notebook = result.current.createNotebook('Physics revision');
    });
    act(() => {
      expect(result.current.addQuestionToNotebook(notebook.id, 'question-1')).toBe(true);
      expect(result.current.addQuestionToNotebook(notebook.id, 'question-1')).toBe(false);
    });

    expect(result.current.notebooks).toEqual([
      expect.objectContaining({
        name: 'Physics revision',
        questionIds: ['question-1'],
      }),
    ]);

    const stored = JSON.parse(window.localStorage.getItem('impulse_notebooks'));
    expect(stored[0].questionIds).toEqual(['question-1']);
  });

  it('rejects blank names and loads notebooks created by another hook instance', () => {
    const first = renderHook(() => useNotebooks());
    const second = renderHook(() => useNotebooks());

    act(() => {
      expect(first.result.current.createNotebook('   ')).toBeNull();
      first.result.current.createNotebook('Chemistry');
    });

    expect(second.result.current.notebooks.map(notebook => notebook.name)).toEqual(['Chemistry']);
  });

  it('removes a question from every notebook', () => {
    const { result } = renderHook(() => useNotebooks());
    let firstNotebook;
    let secondNotebook;

    act(() => {
      firstNotebook = result.current.createNotebook('Physics');
      secondNotebook = result.current.createNotebook('Review');
      result.current.addQuestionToNotebook(firstNotebook.id, 'question-1');
      result.current.addQuestionToNotebook(secondNotebook.id, 'question-1');
    });
    act(() => {
      expect(result.current.removeQuestionFromNotebooks('question-1')).toBe(true);
    });

    expect(result.current.notebooks.every(notebook => notebook.questionIds.length === 0)).toBe(true);
    expect(result.current.removeQuestionFromNotebooks('question-1')).toBe(false);
  });
});
