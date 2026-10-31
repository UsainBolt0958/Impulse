// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadPublicSeries, loadTests } from '@/lib/portalServer';
import PreviousPapersExamPage from './PreviousPapersExamPage';

vi.mock('@/lib/portalServer', () => ({
  loadPublicSeries: vi.fn(),
  loadTests: vi.fn(),
}));

vi.mock('@/components/Header.jsx', () => ({ default: () => null }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('test_analytics_history', JSON.stringify({
    attempts: [
      {
        attemptId: 'attempt-one',
        testId: 'paper-one',
        seriesId: 'series-paper-one',
        timestamp: '2025-01-22T12:00:00.000Z',
        rawPaper1: { total: 120 },
      },
      {
        attemptId: 'other-paper-attempt',
        testId: 'paper-two',
        seriesId: 'series-paper-two',
        timestamp: '2024-04-09T12:00:00.000Z',
        rawPaper1: { total: 90 },
      },
    ],
  }));
  loadPublicSeries.mockResolvedValue([
    {
      id: 'series-paper-one',
      durationMinutes: 180,
      meta: { kind: 'previous-papers', examKey: 'jee-mains' },
    },
    {
      id: 'series-paper-two',
      durationMinutes: 180,
      meta: { kind: 'previous-papers', examKey: 'jee-mains' },
    },
  ]);
  loadTests.mockResolvedValue([
    {
      id: 'paper-one',
      seriesId: 'series-paper-one',
      published: true,
      sections: [{ questions: [{ id: 'q1' }] }],
      meta: {
        kind: 'previous-paper',
        examKey: 'jee-mains',
        year: 2025,
        shiftName: 'January Shift 1',
      },
    },
    {
      id: 'paper-two',
      seriesId: 'series-paper-two',
      published: true,
      sections: [{ questions: [{ id: 'q2' }] }],
      meta: {
        kind: 'previous-paper',
        examKey: 'jee-mains',
        year: 2024,
        shiftName: 'April Shift 2',
      },
    },
  ]);
});

describe('PreviousPapersExamPage', () => {
  it('opens one paper on its own page and returns to that page from the exam', async () => {
    render(
      <MemoryRouter initialEntries={['/previous-papers/jee-mains']}>
        <Routes>
          <Route path="/previous-papers/:examKey/year/:year" element={<PreviousPapersExamPage />} />
          <Route path="/previous-papers/:examKey" element={<PreviousPapersExamPage />} />
          <Route path="/previous-papers/:examKey/:paperId" element={<PreviousPapersExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    const yearCard = await screen.findByRole('link', { name: /2025 1 paper/i });
    expect(yearCard).toHaveAttribute('href', '/previous-papers/jee-mains/year/2025');
    expect(screen.queryByRole('link', { name: /2025 · january shift 1/i })).not.toBeInTheDocument();

    fireEvent.click(yearCard);
    const firstPaperLink = await screen.findByRole('link', { name: /2025 · january shift 1/i });
    expect(firstPaperLink).toHaveAttribute('href', '/previous-papers/jee-mains/paper-one');
    expect(screen.queryByRole('heading', { name: 'Papers by year' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /2024 · april shift 2/i })).not.toBeInTheDocument();

    fireEvent.click(firstPaperLink);

    expect(await screen.findByText(/2025 · january shift 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/2024 · april shift 2/i)).not.toBeInTheDocument();

    const startLink = screen.getByRole('link', { name: 'Start a new attempt' });
    const examUrl = new URL(startLink.getAttribute('href'), window.location.origin);
    expect(examUrl.searchParams.get('testId')).toBe('paper-one');
    expect(examUrl.searchParams.get('seriesId')).toBe('series-paper-one');
    expect(examUrl.searchParams.get('forceNewAttempt')).toBe('true');
    expect(examUrl.searchParams.get('returnTo')).toBe('/previous-papers/jee-mains/paper-one');

    const reviewLink = screen.getByRole('link', { name: 'Review attempt' });
    const reviewUrl = new URL(reviewLink.getAttribute('href'), window.location.origin);
    expect(reviewUrl.searchParams.get('attemptId')).toBe('attempt-one');
    expect(reviewUrl.searchParams.get('testId')).toBe('paper-one');
    expect(reviewUrl.searchParams.get('returnTo')).toBe('/previous-papers/jee-mains/paper-one');
    expect(screen.getByText('Score: 120')).toBeInTheDocument();
    expect(screen.queryByText('Score: 90')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /back to 2025 jee mains papers/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '2025 papers' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /2025 · january shift 1/i })).toBeInTheDocument();
    });
  });

  it.each(['jee-mains', 'neet', 'mht-cet', 'comedk'])(
    'groups %s uploaded papers by their JSON year metadata',
    async (examKey) => {
      loadPublicSeries.mockResolvedValue([{
        id: `series-${examKey}`,
        durationMinutes: 180,
        meta: { kind: 'previous-papers', examKey },
      }]);
      loadTests.mockResolvedValue([{
        id: `paper-${examKey}`,
        seriesId: `series-${examKey}`,
        published: true,
        sections: [{ questions: [{ id: 'q1' }] }],
        meta: {
          kind: 'previous-paper',
          examKey,
          year: 2023,
          shiftName: 'May Shift 1',
        },
      }]);

      render(
        <MemoryRouter initialEntries={[`/previous-papers/${examKey}`]}>
          <Routes>
            <Route path="/previous-papers/:examKey/year/:year" element={<PreviousPapersExamPage />} />
            <Route path="/previous-papers/:examKey" element={<PreviousPapersExamPage />} />
          </Routes>
        </MemoryRouter>
      );

      const yearLink = await screen.findByRole('link', { name: /2023 1 paper/i });
      expect(yearLink).toHaveAttribute('href', `/previous-papers/${examKey}/year/2023`);
      fireEvent.click(yearLink);
      expect(await screen.findByRole('heading', { name: '2023 papers' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /2023 · may shift 1/i })).toHaveAttribute(
        'href',
        `/previous-papers/${examKey}/paper-${examKey}`
      );
    }
  );
});
