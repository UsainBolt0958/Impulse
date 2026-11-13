// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    profile: null,
    authLoading: false,
    profileLoading: false,
    syncStatus: 'idle',
  }),
}));

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ScrollToTop', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('public information pages', () => {
  it.each([
    ['/about', /Prepare with purpose/],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms & Conditions'],
  ])('renders %s without requiring sign-in', async (path, title) => {
    window.history.replaceState({}, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    const themeToggle = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(themeToggle);
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');

    if (path === '/about') {
      expect(screen.getByRole('heading', { name: 'More than a score: understand your whole attempt' }))
        .toBeInTheDocument();
      expect(screen.getByText('Subject and section report')).toBeInTheDocument();
      expect(screen.getByText('Marking impact')).toBeInTheDocument();
      expect(screen.getByText('Solutions and review')).toBeInTheDocument();
    }
    if (path === '/privacy') {
      expect(screen.getByRole('link', { name: 'Email to request account deletion' }))
        .toHaveAttribute('href', 'mailto:impulsepreps@gmail.com?subject=Delete%20my%20Impulse%20account%20and%20data');
    }
    expect(screen.queryByRole('heading', { name: 'Sign in to get started' })).not.toBeInTheDocument();
  });
});
