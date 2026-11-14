// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

afterEach(cleanup);

describe('Sidebar mobile navigation', () => {
  it('shows four primary links and opens the remaining sections from More', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
      </MemoryRouter>
    );

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(4);
    expect(within(navigation).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'PYQ Practice' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Previous Papers' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Test Series' })).toBeInTheDocument();

    await user.click(within(navigation).getByRole('button', { name: 'More navigation' }));

    expect(within(navigation).getByRole('link', { name: 'Custom Test' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Analysis' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Friends' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Premium' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Notebook' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Calendar' })).toBeInTheDocument();
  });
});
