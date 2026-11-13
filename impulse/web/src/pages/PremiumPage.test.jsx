// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, signInWithGoogle, loadPremiumCatalog } = vi.hoisted(() => ({
  rpc: vi.fn(),
  signInWithGoogle: vi.fn(),
  loadPremiumCatalog: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc },
}));
vi.mock('@/lib/premiumCatalog', () => ({
  formatPriceInr: (amount) => `₹${Number(amount).toLocaleString('en-IN')}`,
  loadPremiumCatalog,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'student-1',
      email: 'student@example.com',
      user_metadata: { full_name: 'Student Example' },
    },
    profile: null,
    signInWithGoogle,
  }),
}));
vi.mock('@/components/Header.jsx', () => ({ default: () => null }));
vi.mock('@/components/Footer.jsx', () => ({ default: () => null }));

import PremiumPage from './PremiumPage';

describe('Pro application', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    loadPremiumCatalog.mockReset();
    loadPremiumCatalog.mockResolvedValue([{
      plan_code: 'pro',
      prices: [{ duration_months: 12, price_inr: 999 }],
    }]);
  });

  it('shows the two plans and submits the applicant details', async () => {
    render(<PremiumPage />);

    expect(await screen.findByText('₹999 / year')).toBeInTheDocument();
    expect(screen.getByText('2 previous papers per day')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Student Example' },
    });
    fireEvent.change(screen.getByLabelText('Indian mobile number'), {
      target: { value: '9876543210' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Pro application' }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('submit_pro_application', {
        p_full_name: 'Student Example',
        p_phone_number: '9876543210',
      });
    });
    expect(await screen.findByText('Application received. We will contact you to arrange checkout.')).toBeInTheDocument();
  });
});
