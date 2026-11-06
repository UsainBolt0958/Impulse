// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { loadPublicQuestionCatalog, loadPublicQuestionsPage } = vi.hoisted(() => ({
  loadPublicQuestionCatalog: vi.fn(),
  loadPublicQuestionsPage: vi.fn(),
}));

vi.mock('@/lib/portalServer', () => ({
  loadPublicQuestionCatalog,
  loadPublicQuestionsPage,
}));

vi.mock('@/hooks/useSolvedQuestions', () => ({
  useSolvedQuestions: () => ({ isQuestionSolved: () => false }),
}));

vi.mock('@/components/Header.jsx', () => ({ default: () => <header /> }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => <footer /> }));
vi.mock('@/components/QuestionCard.jsx', () => ({
  default: ({ question }) => <article>{question.question_text}</article>,
}));

import PYQPracticePage from './PYQPracticePage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PYQPracticePage', () => {
  it('loads the selected chapter in pages and lets the student load more', async () => {
    loadPublicQuestionCatalog.mockResolvedValue([
      { chapter: 'Thermodynamics', count: 21, years: ['2025'] },
    ]);
    loadPublicQuestionsPage
      .mockResolvedValueOnce({
        questions: Array.from({ length: 20 }, (_, index) => ({
          id: `question-${index + 1}`,
          question_text: `Question ${index + 1}`,
        })),
        total: 21,
        page: 1,
        limit: 20,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        questions: [{ id: 'question-21', question_text: 'Question 21' }],
        total: 21,
        page: 2,
        limit: 20,
        hasMore: false,
      });

    render(
      <MemoryRouter initialEntries={['/pyq-practice']}>
        <Routes>
          <Route path="/pyq-practice" element={<PYQPracticePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('JEE MAINS'));
    fireEvent.click(screen.getByText('Physics'));
    const chapter = await screen.findByRole('button', { name: /Thermodynamics/ });
    expect(chapter).toHaveTextContent('21 questions available');
    fireEvent.click(chapter);

    expect(await screen.findByText('Showing 20 of 21 questions')).toBeInTheDocument();
    expect(screen.getByText('Question 20')).toBeInTheDocument();
    expect(screen.queryByText('Question 21')).not.toBeInTheDocument();
    expect(loadPublicQuestionsPage).toHaveBeenNthCalledWith(1, {
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      difficulty: [],
      year: [],
    }, 1, 20);

    fireEvent.click(screen.getByRole('button', { name: 'Load more questions' }));
    await waitFor(() => expect(screen.getByText('Question 21')).toBeInTheDocument());
    expect(screen.getByText('Showing 21 of 21 questions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more questions' })).not.toBeInTheDocument();
  });
});
