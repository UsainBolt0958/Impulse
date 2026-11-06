// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadPublicTestSummary } from '@/lib/portalServer';
import TestSeriesExamPage, {
  getTestSeriesExamUrl,
  getUnsubmittedTestSession,
} from './TestSeriesExamPage';

vi.mock('@/lib/portalServer', () => ({
  loadPublicTestSummary: vi.fn(),
}));

vi.mock('@/components/Header.jsx', () => ({ default: () => null }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => null }));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('test_analytics_history', JSON.stringify({
    attempts: [
      {
        attemptId: 'attempt-one',
        testId: 'test-one',
        seriesId: 'series-one',
        timestamp: '2025-01-22T12:00:00.000Z',
        rawPaper1: { total: 120 },
      },
      {
        attemptId: 'other-test-attempt',
        testId: 'test-two',
        seriesId: 'series-two',
        timestamp: '2024-04-09T12:00:00.000Z',
        rawPaper1: { total: 90 },
      },
    ],
  }));
  loadPublicTestSummary.mockResolvedValue({
    series: { id: 'series-one', title: 'JEE Mock Series', published: true, durationMinutes: 180 },
    test: {
      id: 'test-one',
      seriesId: 'series-one',
      title: 'Mock Test One',
      published: true,
      questionCount: 1,
      subjects: ['Physics'],
    },
  });
});

describe('TestSeriesExamPage', () => {
  it('shows only this test’s attempts and links back to the dashboard for review', async () => {
    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Mock Test One', level: 1 })).toBeInTheDocument();
    expect(loadPublicTestSummary).toHaveBeenCalledWith('series-one', 'test-one');
    expect(await screen.findByText('Score: 120')).toBeInTheDocument();
    expect(screen.queryByText('Score: 90')).not.toBeInTheDocument();

    const startUrl = new URL(screen.getByRole('link', { name: 'Start a new attempt' }).getAttribute('href'), window.location.origin);
    expect(startUrl.searchParams.get('testId')).toBe('test-one');
    expect(startUrl.searchParams.get('seriesId')).toBe('series-one');
    expect(startUrl.searchParams.has('forceNewAttempt')).toBe(false);
    expect(startUrl.searchParams.has('resume')).toBe(false);
    expect(startUrl.searchParams.get('returnTo')).toBe('/test-series/series-one/test-one');

    const reviewUrl = new URL(screen.getByRole('link', { name: 'Review attempt' }).getAttribute('href'), window.location.origin);
    expect(reviewUrl.searchParams.get('attemptId')).toBe('attempt-one');
    expect(reviewUrl.searchParams.get('returnTo')).toBe('/test-series/series-one/test-one');
  });

  it('explains when a test is no longer published', async () => {
    loadPublicTestSummary.mockRejectedValueOnce(new Error('Test series test not found.'));

    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('This test series test is no longer available.')).toBeInTheDocument();
  });

  it('builds a review URL scoped to the selected test attempt', () => {
    const url = new URL(getTestSeriesExamUrl('test-one', 'series-one', 'attempt-one'), window.location.origin);
    expect(url.searchParams.get('testId')).toBe('test-one');
    expect(url.searchParams.get('seriesId')).toBe('series-one');
    expect(url.searchParams.get('attemptId')).toBe('attempt-one');
    expect(url.searchParams.get('returnTo')).toBe('/test-series/series-one/test-one');
    expect(url.searchParams.has('forceNewAttempt')).toBe(false);
  });

  it('resumes an unsubmitted session instead of requesting a fresh attempt', async () => {
    window.localStorage.setItem('test_series_test-one_sess_v1', JSON.stringify({
      paper: 2,
      sub: false,
      cur: { s: 'Physics', sec: 'A', i: 4 },
    }));

    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    const resumeLink = await screen.findByRole('link', { name: 'Resume Test' });
    const url = new URL(resumeLink.getAttribute('href'), window.location.origin);
    expect(url.searchParams.get('paper')).toBe('2');
    expect(url.searchParams.get('resume')).toBe('true');
    expect(url.searchParams.has('forceNewAttempt')).toBe(false);
  });

  it('does not present a submitted session as resumable', async () => {
    window.localStorage.setItem('test_series_test-one_sess_v1', JSON.stringify({
      paper: 1,
      sub: true,
    }));

    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('link', { name: 'Start a new attempt' })).toBeInTheDocument();
  });

  it('does not present a saved question-review session as resumable', async () => {
    window.localStorage.setItem('test_series_test-one_sess_v1', JSON.stringify({
      paper: 1,
      sub: false,
      data: { Physics: { A: [{ id: 1, reviewResultId: 'question-1' }] } },
    }));

    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('link', { name: 'Start a new attempt' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Resume Test' })).not.toBeInTheDocument();
    expect(getUnsubmittedTestSession('test-one')).toBeNull();
  });

  it('blocks starting a new attempt when an unfinished session cannot be read', async () => {
    window.localStorage.setItem('test_series_test-one_sess_v1', '{invalid');

    render(
      <MemoryRouter initialEntries={['/test-series/series-one/test-one']}>
        <Routes>
          <Route path="/test-series/:seriesId/:testId" element={<TestSeriesExamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Test session unavailable')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not inspect the saved test session');
  });
});
