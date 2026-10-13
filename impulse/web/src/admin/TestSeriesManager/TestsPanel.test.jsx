import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import TestsPanel from './TestsPanel';

vi.mock('@/lib/portalServer', () => ({
  getSeriesTests: vi.fn(async () => [
    {
      id: 'test-1',
      title: 'Mock Test',
      published: false,
      sections: [
        { name: 'A', questions: [{ id: 'q1' }, { id: 'q2' }] },
        { name: 'B', questions: [{ id: 'q3' }] },
      ],
    },
  ]),
  createTest: vi.fn(),
  deleteTest: vi.fn(),
  updateTest: vi.fn(),
}));

describe('TestsPanel', () => {
  it('shows the total question count from section data instead of 0', async () => {
    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 questions/i)).toBeInTheDocument();
    });
  });
});
