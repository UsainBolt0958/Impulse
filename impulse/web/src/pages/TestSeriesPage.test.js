// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSeriesBillingAccessBatch, loadPublicTestCatalog } = vi.hoisted(() => ({
  getSeriesBillingAccessBatch: vi.fn(),
  loadPublicTestCatalog: vi.fn(),
}));

vi.mock('@/lib/portalServer', () => ({
  establishExamSession: vi.fn(),
  getSeriesBillingAccessBatch,
  loadPublicTestCatalog,
}));
vi.mock('@/components/Header.jsx', () => ({ default: () => null }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => null }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'student-1' } }),
}));

import TestSeriesPage, { getTestSeriesDashboardUrl } from './TestSeriesPage';

describe('test series dashboard entry', () => {
  beforeEach(() => {
    loadPublicTestCatalog.mockReset();
    getSeriesBillingAccessBatch.mockReset();
    getSeriesBillingAccessBatch.mockResolvedValue({
      'series-one': { allowed: true, reason: 'purchased' },
    });
  });

  it('opens the selected test in its attempt dashboard route', () => {
    expect(getTestSeriesDashboardUrl('jee-mains-paper/one', 'series one')).toBe(
      '/test-series/series%20one/jee-mains-paper%2Fone'
    );
  });

  it('loads more test summaries without losing series totals', async () => {
    loadPublicTestCatalog
      .mockResolvedValueOnce({
        series: [{
          id: 'series-one',
          title: 'JEE Series',
          published: true,
          meta: { kind: 'test-series' },
        }],
        tests: [{
          id: 'test-one',
          seriesId: 'series-one',
          title: 'Test One',
          published: true,
          questionCount: 20,
        }],
        testCountsBySeries: { 'series-one': 2 },
        pageInfo: { page: 1, limit: 18, total: 2, hasMore: true },
      })
      .mockResolvedValueOnce({
        series: [],
        tests: [{
          id: 'test-two',
          seriesId: 'series-one',
          title: 'Test Two',
          published: true,
          questionCount: 25,
        }],
        testCountsBySeries: { 'series-one': 2 },
        pageInfo: { page: 2, limit: 18, total: 2, hasMore: false },
      });

    render(React.createElement(
      MemoryRouter,
      null,
      React.createElement(TestSeriesPage)
    ));

    expect(await screen.findByText('Test One')).toBeInTheDocument();
    expect(screen.getByText('2 tests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more tests' }));

    expect(await screen.findByText('Test Two')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load more tests' })).not.toBeInTheDocument();
    });
    expect(loadPublicTestCatalog).toHaveBeenNthCalledWith(1, {
      kind: 'test-series',
      page: 1,
      limit: 18,
    });
    expect(loadPublicTestCatalog).toHaveBeenNthCalledWith(2, {
      kind: 'test-series',
      page: 2,
      limit: 18,
    });
    expect(getSeriesBillingAccessBatch).toHaveBeenCalledOnce();
    expect(getSeriesBillingAccessBatch).toHaveBeenCalledWith(['series-one']);
  });
});
