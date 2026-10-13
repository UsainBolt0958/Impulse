import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import QuestionsPanel from './QuestionsPanel';

vi.mock('@/lib/portalServer', () => ({
  getTest: vi.fn(async () => ({
    id: 'test-1',
    sections: [
      {
        id: 'section-physics-a',
        subject: 'Physics',
        sectionName: 'A',
        type: 'MCQ',
        questions: [{ id: 'q1', text: 'Physics Q1' }],
      },
      {
        id: 'section-chemistry-a',
        subject: 'Chemistry',
        sectionName: 'A',
        type: 'MCQ',
        questions: [{ id: 'q2', text: 'Chemistry Q1' }],
      },
    ],
  })),
}));

describe('QuestionsPanel', () => {
  it('loads the correct section questions for the selected subject even when section names repeat', async () => {
    render(
      <QuestionsPanel
        test={{ id: 'test-1' }}
        subject="Chemistry"
        section={{ id: 'section-chemistry-a', name: 'A', type: 'MCQ' }}
        onSelectQuestion={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chemistry Q1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Physics Q1')).not.toBeInTheDocument();
  });
});
