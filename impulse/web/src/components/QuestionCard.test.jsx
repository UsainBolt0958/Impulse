// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import QuestionCard from './QuestionCard';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('QuestionCard', () => {
  it('shows the provided sequence number', () => {
    render(
      <MemoryRouter>
        <QuestionCard
          question={{ id: 'question-1', question_text: 'Sample PYQ' }}
          questionNumber={3}
          isSolved={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Question 3')).toBeInTheDocument();
  });

  it('does not show a sequence number when one is not provided', () => {
    render(
      <MemoryRouter>
        <QuestionCard
          question={{ id: 'question-1', question_text: 'Sample notebook question' }}
          isSolved={false}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText(/^Question \d+$/)).not.toBeInTheDocument();
  });

  it('creates a notebook and saves the question from a question card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuestionCard
          question={{ id: 'question-1', question_text: 'Sample PYQ' }}
          isSolved={false}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Bookmark question' }));
    await user.type(screen.getByRole('textbox', { name: 'Notebook name' }), 'Physics');
    await user.click(screen.getByRole('button', { name: 'Create and save' }));

    const notebooks = JSON.parse(window.localStorage.getItem('impulse_notebooks'));
    const markedQuestions = JSON.parse(window.localStorage.getItem('impulse_marked'));
    expect(notebooks[0]).toEqual(expect.objectContaining({
      name: 'Physics',
      questionIds: ['question-1'],
    }));
    expect(markedQuestions).toContain('question-1');
  });
});
