// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const { signInWithGoogle } = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    authLoading: false,
    authError: '',
    profileError: '',
    profileLoading: false,
    isSupabaseConfigured: true,
    signInWithGoogle,
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

afterEach(() => {
  cleanup();
  signInWithGoogle.mockClear();
});

describe('LoginPage legal acceptance', () => {
  it('requires acceptance before starting Google sign-in', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const acceptCheckbox = screen.getByRole('checkbox');
    const signInButton = screen.getByRole('button', { name: /continue with google/i });
    const acceptanceLabel = within(acceptCheckbox.parentElement);

    expect(acceptCheckbox).not.toBeChecked();
    expect(signInButton).toBeDisabled();
    expect(acceptanceLabel.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute('href', '/terms');
    expect(acceptanceLabel.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');

    fireEvent.click(acceptCheckbox);
    expect(signInButton).toBeEnabled();

    fireEvent.click(signInButton);
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });
});
