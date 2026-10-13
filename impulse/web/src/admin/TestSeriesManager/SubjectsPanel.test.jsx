import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import SubjectPanel from './SubjectsPanel';

const renderPanel = (props = {}) => {
  const defaultProps = {
    series: { subjects: ['Physics'] },
    test: { id: 'test-1', title: 'Mock Test', subjects: ['Physics'] },
    onSelectSubject: vi.fn(),
    onBack: vi.fn(),
    onUpdateTest: vi.fn(async (updated) => updated),
    ...props,
  };

  return render(<SubjectPanel {...defaultProps} />);
};

describe('SubjectsPanel', () => {
  it('shows a dark-theme compatible subject input and allows deleting a saved subject', async () => {
    const onUpdateTest = vi.fn(async (updated) => updated);
    renderPanel({
      test: { id: 'test-1', title: 'Mock Test', subjects: ['Physics', 'Chemistry'] },
      onUpdateTest,
    });

    fireEvent.click(screen.getByRole('button', { name: /add subject/i }));

    const input = screen.getByLabelText('Subject Name');
    expect(input).toHaveClass('bg-background');
    expect(input).toHaveClass('text-foreground');

    const deleteTrigger = screen.getAllByRole('button', { name: /^Delete$/i })[0];
    fireEvent.click(deleteTrigger);

    const confirmDelete = screen.getAllByRole('button', { name: /^Delete$/i }).at(-1);
    fireEvent.click(confirmDelete);

    await waitFor(() => {
      expect(onUpdateTest).toHaveBeenCalled();
    });
  });
});
