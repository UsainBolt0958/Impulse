// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityCalendar from './ActivityCalender';

const { activityAttempts } = vi.hoisted(() => ({
  activityAttempts: [
    {
      question_id: 'jee-question-1',
      is_correct: true,
      timestamp: '2026-10-15T08:00:00.000Z',
    },
    {
      question_id: 'jee-question-2',
      is_correct: true,
      timestamp: '2026-10-15T08:00:00.000Z',
    },
    {
      question_id: 'jee-question-3',
      is_correct: true,
      timestamp: '2026-10-15T08:00:00.000Z',
    },
    {
      question_id: 'custom-question-1',
      is_correct: false,
      timestamp: '2026-10-15T08:00:00.000Z',
      attempt_id: 'custom-test:test-1:custom-question-1',
    },
    {
      question_id: 'custom-question-2',
      is_correct: true,
      timestamp: '2026-10-15T08:00:00.000Z',
      attempt_id: 'custom-test:test-1:custom-question-2',
    },
    {
      question_id: 'custom-question-2',
      is_correct: true,
      timestamp: '2026-10-15T12:00:00.000Z',
      attempt_id: 'custom-test:test-2:custom-question-2',
    },
  ],
}));

vi.mock('@/hooks/useSolvedQuestions', () => ({
  useSolvedQuestions: () => ({ solvedQuestions: activityAttempts }),
}));

vi.mock('@/hooks/useAttemptQuestionMetadata', () => ({
  useAttemptQuestionMetadata: () => ({
    'jee-question-1': { id: 'jee-question-1', exam: 'JEE MAINS', subject: 'Physics' },
    'jee-question-2': { id: 'jee-question-2', exam: 'JEE MAINS', subject: 'Chemistry' },
    'jee-question-3': { id: 'jee-question-3', exam: 'JEE MAINS', subject: 'Mathematics' },
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 15, 12));
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete globalThis.ResizeObserver;
});

describe('ActivityCalendar', () => {
  it('counts unique custom-test questions per day in the calendar and day breakdown', () => {
    render(<ActivityCalendar />);

    const day = screen.getByRole('button', { name: '2026-10-15, 5 unique questions attempted' });
    expect(day).toHaveTextContent('5');

    fireEvent.click(day);

    const questionCount = screen.getByText('Unique attempted').parentElement.querySelector('.text-3xl');
    expect(questionCount).toHaveTextContent('5');
    expect(screen.getByRole('option', { name: 'JEE MAINS (3)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom Test (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Unknown/ })).not.toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });
});
