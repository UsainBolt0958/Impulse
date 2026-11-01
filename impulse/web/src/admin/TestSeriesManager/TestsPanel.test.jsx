// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { updateTest } from '@/lib/portalServer';
import TestsPanel from './TestsPanel';

afterEach(() => {
  cleanup();
});

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

  it('keeps duration editing inside the test card instead of opening subjects', async () => {
    const onSelectTest = vi.fn();
    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={onSelectTest}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /edit duration/i }));

    const durationInput = screen.getByPlaceholderText('Duration (min)');
    fireEvent.click(durationInput);

    expect(onSelectTest).not.toHaveBeenCalled();
  });

  it('shows the combined percentile scale from 99.9 down to 90', async () => {
    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));

    expect(screen.getAllByRole('spinbutton').map((input) => input.getAttribute('aria-label'))).toEqual([
      '99.9 percentile marks',
      '99.8 percentile marks',
      '99.7 percentile marks',
      '99.6 percentile marks',
      '99.5 percentile marks',
      '99.4 percentile marks',
      '99.3 percentile marks',
      '99.2 percentile marks',
      '99.1 percentile marks',
      '99 percentile marks',
      '98.5 percentile marks',
      '98 percentile marks',
      '97.5 percentile marks',
      '97 percentile marks',
      '96.5 percentile marks',
      '96 percentile marks',
      '95.5 percentile marks',
      '95 percentile marks',
      '94 percentile marks',
      '93 percentile marks',
      '92 percentile marks',
      '91 percentile marks',
      '90 percentile marks',
    ]);
  });

  it('saves paper-specific percentile marks', async () => {
    updateTest.mockResolvedValue({
      id: 'test-1',
      percentileMarks: { '99.9': 100, '99.6': 90, '90': 50 },
    });

    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));
    fireEvent.change(screen.getByLabelText('99.9 percentile marks'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('99.6 percentile marks'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('90 percentile marks'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /save cutoffs/i }));

    await waitFor(() => {
      expect(updateTest).toHaveBeenCalledWith('test-1', {
        percentileMarks: { '99.9': 100, '99.6': 90, '90': 50 },
      });
    });
  });

  it('requires a 90th-percentile cutoff before saving', async () => {
    updateTest.mockClear();
    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));
    fireEvent.change(screen.getByLabelText('99.9 percentile marks'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('99.6 percentile marks'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: /save cutoffs/i }));

    await waitFor(() => {
      expect(updateTest).not.toHaveBeenCalled();
    });
  });
});
