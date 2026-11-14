// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProAccessAdminPanel from './ProAccessAdminPanel';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

const batch = {
  id: 'batch-2028',
  batch_name: 'Batch 2028',
  expires_on: '2028-07-31',
  regular_price_inr: 1499,
  discounted_price_inr: null,
  enabled: true,
};

const overview = {
  settings: {
    card_style: 'gradient',
    color_one: '#302770',
    color_two: '#7C3AED',
  },
  batches: [batch],
  requests: [{
    id: 'request-1',
    user_id: 'user-1',
    account_name: 'Request Account',
    full_name: 'Request Name',
    phone: '9876543210',
    batch_id: batch.id,
    batch_name: batch.batch_name,
    expires_on: batch.expires_on,
    quoted_regular_price_inr: 1499,
    quoted_discounted_price_inr: null,
    description: 'Please contact me',
    requests_ignored: false,
    created_at: '2026-11-14T00:00:00.000Z',
  }],
  users: [],
};

describe('ProAccessAdminPanel', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation(async (functionName) => {
      if (functionName === 'get_pro_admin_overview') return { data: overview, error: null };
      if (functionName === 'search_pro_access_accounts') {
        return {
          data: [{
            user_id: 'user-2',
            account_name: 'Search Candidate',
            email: 'candidate@example.com',
            username: 'candidate',
            has_pro_access: false,
            pro_status: null,
            requests_ignored: false,
          }],
          error: null,
        };
      }
      return { data: null, error: null };
    });
  });

  afterEach(() => cleanup());

  it('lets admins ignore future applications while keeping the pending request visible', async () => {
    render(<ProAccessAdminPanel session={{ user: { id: 'admin-1' } }} />);

    await screen.findByText('Request Account');
    fireEvent.click(screen.getByRole('button', { name: 'Request settings for Request Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ignore future requests' }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('set_pro_request_ignored', {
        p_user_id: 'user-1',
        p_ignore: true,
      });
    });
    expect(screen.getByText('Request Account')).toBeInTheDocument();
  });

  it('searches accounts and grants a selected batch manually', async () => {
    render(<ProAccessAdminPanel session={{ user: { id: 'admin-1' } }} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search accounts' }), {
      target: { value: 'candidate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Search Candidate');
    fireEvent.click(screen.getByRole('button', { name: 'Grant batch' }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('grant_manual_pro_access', {
        p_user_id: 'user-2',
        p_batch_id: batch.id,
      });
    });
  });
});
