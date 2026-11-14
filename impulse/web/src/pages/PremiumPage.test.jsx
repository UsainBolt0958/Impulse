// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PremiumPage from './PremiumPage';
import { loadProBatches, loadProOffer } from '@/lib/premiumCatalog';
import { supabase } from '@/lib/supabase';

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'account@example.com' },
  profile: { display_name: 'Account name' },
  authLoading: false,
  proAccess: { hasAccess: false, expiresAt: null, status: null, loading: false, error: '' },
  refreshProAccess: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('@/components/Header.jsx', () => ({ default: () => null }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => null }));
vi.mock('@/lib/premiumCatalog', () => ({
  loadProBatches: vi.fn(),
  loadProOffer: vi.fn(),
  formatPriceInr: (amount) => `₹${Number(amount).toLocaleString('en-IN')}`,
  getPlanLimitText: (plan) => plan.plan_code === 'basic'
    ? ['Up to 3 friends', 'Up to 5 custom tests per day', 'Up to 3 previous-year papers per day']
    : ['Unlimited friends', 'Unlimited custom tests'],
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

afterEach(() => cleanup());

beforeEach(() => {
  auth.proAccess = { hasAccess: false, expiresAt: null, status: null, loading: false, error: '' };
  auth.refreshProAccess.mockReset().mockResolvedValue(auth.proAccess);
  loadProOffer.mockResolvedValue({
    card_style: 'gradient',
    color_one: '#302770',
    color_two: '#7C3AED',
  });
  loadProBatches.mockResolvedValue([
    {
      id: 'batch-2027',
      batch_name: 'Batch 2027',
      expires_on: '2027-07-31',
      regular_price_inr: 799,
      discounted_price_inr: null,
    },
    {
      id: 'batch-2028',
      batch_name: 'Batch 2028',
      expires_on: '2028-07-31',
      regular_price_inr: 1499,
      discounted_price_inr: null,
    },
  ]);
  supabase.rpc.mockResolvedValue({ data: 'request-1', error: null });
});

describe('PremiumPage Pro request form', () => {
  it('shows active Pro benefits and expiry instead of another Buy Pro action', async () => {
    auth.proAccess = {
      hasAccess: true,
      expiresAt: '2027-11-14T06:30:00.000Z',
      status: 'active',
      loading: false,
      error: '',
    };

    render(
      <MemoryRouter>
        <PremiumPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Your Pro benefits are active.')).toBeInTheDocument();
    expect(screen.getByText('Expires 14 November 2027')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy Pro' })).not.toBeInTheDocument();
  });

  it('opens with a blank name and submits account-linked contact details', async () => {
    render(
      <MemoryRouter>
        <PremiumPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('₹799')).toBeInTheDocument();
    expect(screen.getByText('Expires 31 July 2027')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Buy Pro' }));
    const fullName = screen.getByLabelText('Full name');
    const phone = screen.getByLabelText('Phone number');
    expect(fullName).toHaveValue('');
    expect(fullName).toHaveClass('text-slate-950');
    expect(phone).toHaveValue('');
    expect(screen.getByText('Account name')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Pro batch' }), {
      target: { value: 'batch-2028' },
    });
    expect(screen.getByText('₹1,499')).toBeInTheDocument();
    expect(screen.getByText('Expires 31 July 2028')).toBeInTheDocument();
    fireEvent.change(fullName, { target: { value: 'Riya Sharma' } });
    fireEvent.change(phone, { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Please contact me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('submit_pro_access_request', {
        p_full_name: 'Riya Sharma',
        p_phone: '9876543210',
        p_batch_id: 'batch-2028',
        p_description: 'Please contact me',
      });
    });
    expect(await screen.findByText('Request received.')).toBeInTheDocument();
  });
});
