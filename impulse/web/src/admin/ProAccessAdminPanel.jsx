import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Palette,
  PauseCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatProExpiry } from '@/components/ProStatusBadge';
import { formatPriceInr } from '@/lib/premiumCatalog';
import { supabase } from '@/lib/supabase';

const EMPTY_SETTINGS = {
  card_style: 'gradient',
  color_one: '#302770',
  color_two: '#7C3AED',
};

const EMPTY_BATCH = {
  batch_name: '',
  expires_on: '',
  regular_price_inr: '',
  discounted_price_inr: '',
  enabled: true,
};

function isAvailableBatch(batch) {
  return batch.enabled
    && new Date(`${batch.expires_on}T23:59:59+05:30`).getTime() >= Date.now();
}

function isUnexpiredBatch(batch) {
  return new Date(`${batch.expires_on}T23:59:59+05:30`).getTime() >= Date.now();
}

function getAccountProLabel(account) {
  if (account.has_pro_access) return 'Pro';
  if (account.pro_status === 'suspended') return 'Suspended';
  if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) return 'Expired Pro';
  if (account.pro_status === 'revoked') return 'Revoked';
  return 'Basic';
}

function ProAccessAdminPanel({ session }) {
  const [overview, setOverview] = useState({ requests: [], users: [], batches: [] });
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [newBatch, setNewBatch] = useState(EMPTY_BATCH);
  const [suspensionDays, setSuspensionDays] = useState({});
  const [legacyBatchIds, setLegacyBatchIds] = useState({});
  const [manualBatchIds, setManualBatchIds] = useState({});
  const [requestSettingsId, setRequestSettingsId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: loadError } = await supabase.rpc('get_pro_admin_overview');
      if (loadError) throw loadError;
      setOverview({
        requests: Array.isArray(data?.requests) ? data.requests : [],
        users: Array.isArray(data?.users) ? data.users : [],
        batches: Array.isArray(data?.batches) ? data.batches : [],
      });
      setSettings({ ...EMPTY_SETTINGS, ...(data?.settings || {}) });
    } catch (loadError) {
      console.error('Could not load Pro access requests and settings.', loadError);
      setError(loadError.message || 'Could not load Pro access management.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const decideRequest = async (request, approve) => {
    const batchId = request.batch_id || legacyBatchIds[request.id] || null;
    if (approve && !batchId) {
      setError('Choose a Pro batch before approving this request.');
      return;
    }
    setBusyId(request.id);
    setError('');
    setNotice('');
    try {
      const { error: actionError } = await supabase.rpc('decide_pro_access_request', {
        p_request_id: request.id,
        p_approve: approve,
        p_batch_id: batchId,
      });
      if (actionError) throw actionError;
      setNotice(approve
        ? 'Pro access granted through the selected batch expiry.'
        : 'The request was rejected.');
      await loadOverview();
    } catch (actionError) {
      console.error('Could not review the Pro access request.', actionError);
      setError(actionError.message || 'The request could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const runUserSearch = async (query = userSearch) => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setUserSearchResults([]);
      setSearchedQuery('');
      setError('Enter at least 2 characters to search accounts.');
      return;
    }

    setSearchLoading(true);
    setError('');
    try {
      const { data, error: searchError } = await supabase.rpc('search_pro_access_accounts', {
        p_query: normalizedQuery,
      });
      if (searchError) throw searchError;
      if (!Array.isArray(data)) throw new Error('The account search returned an invalid response.');
      setUserSearchResults(data);
      setSearchedQuery(normalizedQuery);
    } catch (searchError) {
      setUserSearchResults([]);
      setSearchedQuery('');
      console.error('Could not search user accounts.', searchError);
      setError(searchError.message || 'Account search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const searchUsers = (event) => {
    event.preventDefault();
    runUserSearch();
  };

  const setRequestIgnored = async (userId, shouldIgnore) => {
    setBusyId(`ignore-${userId}`);
    setError('');
    setNotice('');
    try {
      const { error: ignoreError } = await supabase.rpc('set_pro_request_ignored', {
        p_user_id: userId,
        p_ignore: shouldIgnore,
      });
      if (ignoreError) throw ignoreError;
      setNotice(shouldIgnore
        ? 'Future Pro applications from this account are blocked; its current request remains in the queue.'
        : 'This account can submit Pro applications again.');
      await loadOverview();
      if (userSearch.trim().length >= 2) await runUserSearch(userSearch);
    } catch (ignoreError) {
      console.error('Could not update Pro request settings.', ignoreError);
      setError(ignoreError.message || 'The request settings could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const grantManualAccess = async (account) => {
    const grantableBatches = overview.batches.filter(isUnexpiredBatch);
    const batchId = manualBatchIds[account.user_id] || grantableBatches[0]?.id;
    if (!batchId) {
      setError('No unexpired Pro batch is available to grant.');
      return;
    }
    if (account.has_pro_access && !window.confirm(
      `Replace ${account.account_name}'s current Pro batch with the selected batch?`
    )) {
      return;
    }

    setBusyId(`manual-${account.user_id}`);
    setError('');
    setNotice('');
    try {
      const { error: grantError } = await supabase.rpc('grant_manual_pro_access', {
        p_user_id: account.user_id,
        p_batch_id: batchId,
      });
      if (grantError) throw grantError;
      const batch = grantableBatches.find((item) => item.id === batchId);
      setNotice(`Manual Pro access granted to ${account.account_name}${batch ? ` for ${batch.batch_name}` : ''}.`);
      await Promise.all([
        loadOverview(),
        userSearch.trim().length >= 2 ? runUserSearch(userSearch) : Promise.resolve(),
      ]);
    } catch (grantError) {
      console.error('Could not grant manual Pro access.', grantError);
      setError(grantError.message || 'Manual Pro access could not be granted.');
    } finally {
      setBusyId('');
    }
  };

  const manageAccess = async (account, action) => {
    if (action === 'remove' && !window.confirm(`Remove Pro access for ${account.account_name}?`)) {
      return;
    }
    const days = Number(suspensionDays[account.user_id]);
    if (action === 'suspend' && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      setError('Enter a suspension duration between 1 and 3,650 days.');
      return;
    }
    setBusyId(account.user_id);
    setError('');
    setNotice('');
    try {
      const { error: actionError } = await supabase.rpc('manage_pro_access', {
        p_user_id: account.user_id,
        p_action: action,
        p_duration_days: action === 'suspend' ? days : null,
      });
      if (actionError) throw actionError;
      setNotice(action === 'remove'
        ? 'Pro access removed.'
        : action === 'restore' ? 'Pro access restored.' : `Pro access suspended for ${days} days.`);
      await loadOverview();
    } catch (actionError) {
      console.error('Could not update Pro access.', actionError);
      setError(actionError.message || 'Pro access could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const saveSettings = async () => {
    setBusyId('settings');
    setError('');
    setNotice('');
    const { error: saveError } = await supabase
      .from('pro_offer_settings')
      .update({
        card_style: settings.card_style,
        color_one: settings.color_one,
        color_two: settings.color_two,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('singleton', true);
    setBusyId('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setNotice('Pro card appearance saved.');
    await loadOverview();
  };

  const updateSetting = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const updateBatch = (batchId, field, value) => {
    setOverview((current) => ({
      ...current,
      batches: current.batches.map((batch) => (
        batch.id === batchId ? { ...batch, [field]: value } : batch
      )),
    }));
  };

  const validateBatchPrices = (batch) => {
    const regular = Number(batch.regular_price_inr);
    const discounted = batch.discounted_price_inr === '' || batch.discounted_price_inr == null
      ? null
      : Number(batch.discounted_price_inr);
    if (
      batch.regular_price_inr === ''
      || batch.regular_price_inr == null
      || !Number.isInteger(regular)
      || regular < 0
      || (discounted !== null && (!Number.isInteger(discounted) || discounted < 0 || discounted > regular))
    ) {
      setError('Batch prices must be whole rupee amounts; a discounted price cannot exceed the regular price.');
      return null;
    }
    return { regular, discounted };
  };

  const saveBatch = async (batch) => {
    if (!batch.batch_name.trim() || !batch.expires_on) {
      setError('Enter a batch name and expiry date.');
      return;
    }
    const prices = validateBatchPrices(batch);
    if (!prices) return;

    setBusyId(`batch-${batch.id}`);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase
        .from('pro_access_batches')
        .update({
          batch_name: batch.batch_name.trim(),
          expires_on: batch.expires_on,
          regular_price_inr: prices.regular,
          discounted_price_inr: prices.discounted,
          enabled: batch.enabled,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch.id);
      if (saveError) throw saveError;
      setNotice(`${batch.batch_name.trim()} updated. Existing Pro members keep their current expiry.`);
      await loadOverview();
    } catch (saveError) {
      console.error('Could not update the Pro batch.', saveError);
      setError(saveError.message || 'The batch could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const addBatch = async (event) => {
    event.preventDefault();
    if (!newBatch.batch_name.trim() || !newBatch.expires_on) {
      setError('Enter a batch name and expiry date.');
      return;
    }
    const prices = validateBatchPrices(newBatch);
    if (!prices) return;

    setBusyId('new-batch');
    setError('');
    setNotice('');
    try {
      const { error: insertError } = await supabase
        .from('pro_access_batches')
        .insert({
          batch_name: newBatch.batch_name.trim(),
          expires_on: newBatch.expires_on,
          regular_price_inr: prices.regular,
          discounted_price_inr: prices.discounted,
          enabled: newBatch.enabled,
          updated_by: session.user.id,
        });
      if (insertError) throw insertError;
      setNewBatch(EMPTY_BATCH);
      setNotice(`${newBatch.batch_name.trim()} added.`);
      await loadOverview();
    } catch (insertError) {
      console.error('Could not add the Pro batch.', insertError);
      setError(insertError.message || 'The batch could not be added.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">Pro access</h3>
          <p className="text-sm text-muted-foreground">Review access requests, manage Pro accounts, and customize the offer card.</p>
        </div>
        <Button type="button" variant="outline" onClick={loadOverview} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh Pro data
        </Button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-primary/40 p-3 text-sm">{notice}</p>}

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Pro batches</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set each batch price and expiry. Changes apply to new requests and approvals; current members keep their granted expiry.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading Pro batches…</p>
          ) : overview.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pro batches are configured.</p>
          ) : overview.batches.map((batch) => (
            <div key={batch.id} className="space-y-3 rounded-2xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs font-bold text-muted-foreground">
                  Batch name
                  <Input
                    value={batch.batch_name}
                    onChange={(event) => updateBatch(batch.id, 'batch_name', event.target.value)}
                    className="bg-background text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs font-bold text-muted-foreground">
                  Expiry date
                  <Input
                    type="date"
                    value={batch.expires_on}
                    onChange={(event) => updateBatch(batch.id, 'expires_on', event.target.value)}
                    className="bg-background text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs font-bold text-muted-foreground">
                  Regular price (₹)
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={batch.regular_price_inr}
                    onChange={(event) => updateBatch(batch.id, 'regular_price_inr', event.target.value)}
                    className="bg-background text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs font-bold text-muted-foreground">
                  Discounted price (₹)
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="No discount"
                    value={batch.discounted_price_inr ?? ''}
                    onChange={(event) => updateBatch(batch.id, 'discounted_price_inr', event.target.value)}
                    className="bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={batch.enabled}
                    onChange={(event) => updateBatch(batch.id, 'enabled', event.target.checked)}
                  />
                  Accepting new requests
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveBatch(batch)}
                  disabled={busyId === `batch-${batch.id}`}
                >
                  <Save className="h-4 w-4" /> Save {batch.batch_name}
                </Button>
              </div>
            </div>
          ))}

          <form onSubmit={addBatch} className="space-y-3 rounded-2xl border border-dashed border-border p-4">
            <h4 className="font-bold">Add a batch</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs font-bold text-muted-foreground">
                Batch name
                <Input
                  required
                  maxLength={80}
                  placeholder="Batch 2029"
                  value={newBatch.batch_name}
                  onChange={(event) => setNewBatch((current) => ({ ...current, batch_name: event.target.value }))}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-muted-foreground">
                Expiry date
                <Input
                  required
                  type="date"
                  value={newBatch.expires_on}
                  onChange={(event) => setNewBatch((current) => ({ ...current, expires_on: event.target.value }))}
                  className="bg-background text-foreground"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-muted-foreground">
                Regular price (₹)
                <Input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={newBatch.regular_price_inr}
                  onChange={(event) => setNewBatch((current) => ({ ...current, regular_price_inr: event.target.value }))}
                  className="bg-background text-foreground"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-muted-foreground">
                Discounted price (₹)
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="No discount"
                  value={newBatch.discounted_price_inr}
                  onChange={(event) => setNewBatch((current) => ({ ...current, discounted_price_inr: event.target.value }))}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </label>
            </div>
            <Button type="submit" disabled={busyId === 'new-batch'}>
              <Save className="h-4 w-4" /> Add batch
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Pro applications</CardTitle>
          <p className="text-sm text-muted-foreground">Approving a request grants unlimited Pro access through that batch’s expiry date.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading requests…</p>
          ) : overview.requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pro requests are waiting for review.</p>
          ) : overview.requests.map((request) => (
            <article key={request.id} className="grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <p>
                  <span className="text-xs font-bold uppercase text-muted-foreground">Account</span><br />
                  <span className="font-semibold">{request.account_name}</span>
                  {request.requests_ignored && <Badge className="ml-2" variant="outline">Future requests blocked</Badge>}
                </p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Form name</span><br /><span className="font-semibold">{request.full_name}</span></p>
                <p>
                  <span className="text-xs font-bold uppercase text-muted-foreground">Requested batch</span><br />
                  <span className="font-semibold">{request.batch_name || 'Not selected (older request)'}</span>
                  {request.expires_on && <span className="block text-xs text-muted-foreground">Expires {formatProExpiry(request.expires_on)}</span>}
                </p>
                <p>
                  <span className="text-xs font-bold uppercase text-muted-foreground">Quoted price</span><br />
                  <span className="font-semibold">
                    {request.quoted_discounted_price_inr != null
                      ? formatPriceInr(request.quoted_discounted_price_inr)
                      : request.quoted_regular_price_inr != null
                        ? formatPriceInr(request.quoted_regular_price_inr)
                        : '—'}
                  </span>
                </p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Phone</span><br /><a className="font-semibold underline" href={`tel:${request.phone}`}>{request.phone}</a></p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Description</span><br /><span className="whitespace-pre-wrap">{request.description || '—'}</span></p>
                <p className="text-xs text-muted-foreground sm:col-span-2">Submitted {new Date(request.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRequestSettingsId((current) => (
                    current === request.id ? '' : request.id
                  ))}
                  aria-expanded={requestSettingsId === request.id}
                  aria-label={`Request settings for ${request.account_name}`}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Button>
                {!request.batch_id && (
                  <label className="text-xs font-semibold">
                    Assign batch
                    <select
                      aria-label={`Assign batch to ${request.full_name}`}
                      value={legacyBatchIds[request.id] || ''}
                      onChange={(event) => setLegacyBatchIds((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))}
                      className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    >
                      <option value="">Choose batch</option>
                      {overview.batches.filter(isAvailableBatch).map((batch) => (
                        <option key={batch.id} value={batch.id}>{batch.batch_name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => decideRequest(request, true)}
                  disabled={busyId === request.id || (!request.batch_id && !legacyBatchIds[request.id])}
                  aria-label={`Approve Pro request from ${request.full_name}`}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => decideRequest(request, false)}
                  disabled={busyId === request.id}
                  aria-label={`Reject Pro request from ${request.full_name}`}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
              {requestSettingsId === request.id && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3 lg:col-span-2">
                  <p className="text-sm text-muted-foreground">
                    Ignoring blocks future Pro applications from this account. This pending request remains reviewable.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={request.requests_ignored ? 'outline' : 'destructive'}
                    onClick={() => setRequestIgnored(request.user_id, !request.requests_ignored)}
                    disabled={busyId === `ignore-${request.user_id}`}
                  >
                    {request.requests_ignored ? 'Allow future requests' : 'Ignore future requests'}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Find accounts and grant Pro</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search by account name, username, email, or account ID, then grant a batch directly.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={searchUsers} className="flex flex-wrap gap-2">
            <Input
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value);
                setUserSearchResults([]);
                setSearchedQuery('');
              }}
              placeholder="Search accounts"
              aria-label="Search accounts"
              className="min-w-60 flex-1 bg-background text-foreground"
            />
            <Button type="submit" disabled={searchLoading}>
              <Search className="h-4 w-4" /> {searchLoading ? 'Searching…' : 'Search'}
            </Button>
          </form>
          {searchLoading && <p role="status" className="text-sm text-muted-foreground">Searching accounts…</p>}
          {!searchLoading && searchedQuery === userSearch.trim() && searchedQuery && userSearchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No matching accounts found.</p>
          )}
          {userSearchResults.map((account) => {
            const grantableBatches = overview.batches.filter(isUnexpiredBatch);
            return (
              <article key={account.user_id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{account.account_name}</p>
                    <Badge variant={account.has_pro_access ? 'default' : 'outline'}>
                      {getAccountProLabel(account)}
                    </Badge>
                    {account.requests_ignored && <Badge variant="outline">Requests ignored</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.email || account.user_id}{account.username ? ` · @${account.username}` : ''}
                  </p>
                  {account.has_pro_access && (
                    <p className="text-xs text-muted-foreground">
                      {account.batch_name || 'Pro'} · Expires {formatProExpiry(account.expires_at)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Batch to grant to ${account.account_name}`}
                    value={manualBatchIds[account.user_id] || grantableBatches[0]?.id || ''}
                    onChange={(event) => setManualBatchIds((current) => ({
                      ...current,
                      [account.user_id]: event.target.value,
                    }))}
                    disabled={grantableBatches.length === 0}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {grantableBatches.length === 0 ? (
                      <option value="">No unexpired batches</option>
                    ) : grantableBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>{batch.batch_name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => grantManualAccess(account)}
                    disabled={grantableBatches.length === 0 || busyId === `manual-${account.user_id}`}
                  >
                    <UserPlus className="h-4 w-4" /> Grant batch
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRequestIgnored(account.user_id, !account.requests_ignored)}
                    disabled={busyId === `ignore-${account.user_id}`}
                  >
                    {account.requests_ignored ? 'Allow requests' : 'Ignore requests'}
                  </Button>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Pro accounts</CardTitle>
          <p className="text-sm text-muted-foreground">Remove Pro access or suspend an account temporarily.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading Pro accounts…</p>
          ) : overview.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no active or suspended Pro accounts.</p>
          ) : overview.users.map((account) => {
            const suspensionExpired = account.status === 'suspended'
              && account.suspended_until
              && new Date(account.suspended_until) <= new Date();
            const accessExpired = account.expires_at && new Date(account.expires_at) <= new Date();
            return (
              <article key={account.user_id} className="grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{account.account_name}</p>
                    <Badge variant={!accessExpired && (account.status === 'active' || suspensionExpired) ? 'default' : 'outline'}>
                      {accessExpired ? 'expired' : suspensionExpired ? 'Active (suspension ended)' : account.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{account.email || account.user_id}</p>
                  {account.batch_name && (
                    <p className="text-sm text-muted-foreground">Batch: {account.batch_name}</p>
                  )}
                  {(account.full_name || account.phone) && (
                    <p className="text-sm text-muted-foreground">
                      {account.full_name || 'No form name'}{account.phone ? ` · ${account.phone}` : ''}
                    </p>
                  )}
                  {account.expires_at && (
                    <p className="text-xs text-muted-foreground">Pro expires {formatProExpiry(account.expires_at)}</p>
                  )}
                  {account.status === 'suspended' && !suspensionExpired && !accessExpired && (
                    <p className="text-xs text-muted-foreground">
                      Suspended until {new Date(account.suspended_until).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {account.status === 'suspended' && !accessExpired && (
                    <Button type="button" size="sm" variant="outline" onClick={() => manageAccess(account, 'restore')} disabled={busyId === account.user_id}>
                      Restore
                    </Button>
                  )}
                  {!accessExpired && (
                    <>
                      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="sr-only">Suspension duration for {account.account_name}</span>
                        <Input
                          type="number"
                          min="1"
                          max="3650"
                          step="1"
                          placeholder="Days"
                          value={suspensionDays[account.user_id] || ''}
                          onChange={(event) => setSuspensionDays((current) => ({
                            ...current,
                            [account.user_id]: event.target.value,
                          }))}
                          className="w-24"
                        />
                        days
                      </label>
                      <Button type="button" size="sm" variant="outline" onClick={() => manageAccess(account, 'suspend')} disabled={busyId === account.user_id}>
                        <PauseCircle className="h-4 w-4" /> Suspend
                      </Button>
                    </>
                  )}
                  <Button type="button" size="sm" variant="destructive" onClick={() => manageAccess(account, 'remove')} disabled={busyId === account.user_id}>
                    <Trash2 className="h-4 w-4" /> Remove Pro
                  </Button>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Pro card appearance</CardTitle>
          <p className="text-sm text-muted-foreground">Batch pricing is managed separately above. Pro access is granted only after you approve an application.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold text-muted-foreground">
              Card style
              <select
                value={settings.card_style}
                onChange={(event) => updateSetting('card_style', event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="solid">Solid color</option>
                <option value="gradient">Two-color gradient</option>
                <option value="animated">Animated gradient</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-muted-foreground">
              First color
              <Input type="color" value={settings.color_one} onChange={(event) => updateSetting('color_one', event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-bold text-muted-foreground">
              Second color
              <Input type="color" value={settings.color_two} onChange={(event) => updateSetting('color_two', event.target.value)} />
            </label>
          </div>
          <Button type="button" onClick={saveSettings} disabled={busyId === 'settings'}>
            <Save className="h-4 w-4" /> Save Pro offer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProAccessAdminPanel;
