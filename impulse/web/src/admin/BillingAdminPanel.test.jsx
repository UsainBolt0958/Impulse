// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { proPrice: 799 };
  return {
    state,
    rpc: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    loadPremiumCatalog: vi.fn(async () => [{
      plan_code: 'pro',
      prices: [{ duration_months: 12, price_inr: state.proPrice }],
    }]),
    updateProAnnualPrice: vi.fn(async (price) => {
      state.proPrice = price;
      return price;
    }),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));
vi.mock('@/lib/premiumCatalog', () => ({
  formatPriceInr: (amount) => `₹${Number(amount).toLocaleString('en-IN')}`,
  loadPremiumCatalog: mocks.loadPremiumCatalog,
  updateProAnnualPrice: mocks.updateProAnnualPrice,
}));

import BillingAdminPanel from './BillingAdminPanel';

afterEach(() => cleanup());

beforeEach(() => {
  mocks.state.proPrice = 799;
  mocks.rpc.mockImplementation(async (name) => {
    if (name === 'is_billing_admin') return { data: true, error: null };
    if (name === 'get_pro_applications_admin') return { data: [], error: null };
    if (name === 'get_billing_admin_summary') return { data: {}, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'admin-1' } } },
    error: null,
  });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.loadPremiumCatalog.mockClear();
  mocks.updateProAnnualPrice.mockClear();
});

describe('BillingAdminPanel Pro price', () => {
  it('lets an approved admin update the annual amount shown to students', async () => {
    render(<BillingAdminPanel />);

    await screen.findByText('Current price:');
    expect(screen.getByText('Current price:').textContent).toContain('₹799 / year');
    fireEvent.change(screen.getByLabelText('New Pro price (INR per year)'), {
      target: { value: '1299' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pro price' }));

    await waitFor(() => {
      expect(mocks.updateProAnnualPrice).toHaveBeenCalledWith(1299);
    });
    await waitFor(() => {
      expect(screen.getByText('Current price:').textContent).toContain('₹1,299 / year');
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The student-facing plans page will show this amount.'
    );
  });
});
