// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { updateTest } from '@/lib/portalServer';
import { toast } from 'sonner';
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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

  it('reads and saves percentile marks from a JSON file for the selected test', async () => {
    updateTest.mockResolvedValue({
      id: 'test-1',
      percentileMarks: { '99.9': 100, '99.6': 90, '90': 50 },
    });
    const file = new File([
      JSON.stringify({ '99.9': 100, '99.6': 90, '90': 50 }),
    ], 'percentile-marks.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({ '99.9': 100, '99.6': 90, '90': 50 })),
    });

    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));
    fireEvent.change(screen.getByLabelText('Upload marks-vs-percentile JSON'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(updateTest).toHaveBeenCalledWith('test-1', {
        percentileMarks: { '99.9': 100, '99.6': 90, '90': 50 },
      });
    });
  });

  it('shows the JSON format example in the percentile editor', async () => {
    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));
    fireEvent.click(screen.getByText('JSON format and example'));

    expect(screen.getByText(/"99.9": 230/)).toBeInTheDocument();
    expect(screen.getByText(/"90": 120/)).toBeInTheDocument();
  });

  it('rejects percentile JSON with invalid marks without saving', async () => {
    updateTest.mockClear();
    toast.error.mockClear();
    const file = new File(['{}'], 'percentile-marks.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({ '99.9': 100, '99.6': 90 })),
    });

    render(
      <TestsPanel
        series={{ id: 'series-1', title: 'Series 1' }}
        onSelectTest={vi.fn()}
        onBack={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /set percentile marks/i }));
    fireEvent.change(screen.getByLabelText('Upload marks-vs-percentile JSON'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(updateTest).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'Enter the score in marks for the 90th-percentile cutoff and at least one other cutoff.'
      );
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
