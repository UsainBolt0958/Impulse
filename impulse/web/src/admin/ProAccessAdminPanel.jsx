import React, { useCallback, useEffect, useState } from 'react';
import { Check, Palette, PauseCircle, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatProExpiry } from '@/components/ProStatusBadge';
import { supabase } from '@/lib/supabase';

const EMPTY_SETTINGS = {
  regular_price_inr: '',
  discounted_price_inr: '',
  card_style: 'gradient',
  color_one: '#302770',
  color_two: '#7C3AED',
};

function ProAccessAdminPanel({ session }) {
  const [overview, setOverview] = useState({ requests: [], users: [] });
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [suspensionDays, setSuspensionDays] = useState({});
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
    setBusyId(request.id);
    setError('');
    setNotice('');
    try {
      const { error: actionError } = await supabase.rpc('decide_pro_access_request', {
        p_request_id: request.id,
        p_approve: approve,
      });
      if (actionError) throw actionError;
      setNotice(approve ? 'Pro access granted for 12 months.' : 'The request was rejected.');
      await loadOverview();
    } catch (actionError) {
      console.error('Could not review the Pro access request.', actionError);
      setError(actionError.message || 'The request could not be updated.');
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
    const regular = settings.regular_price_inr === '' ? null : Number(settings.regular_price_inr);
    const discounted = settings.discounted_price_inr === '' ? null : Number(settings.discounted_price_inr);
    if (
      (regular !== null && (!Number.isInteger(regular) || regular < 0))
      || (discounted !== null && (!Number.isInteger(discounted) || discounted < 0))
      || (regular !== null && discounted !== null && discounted > regular)
    ) {
      setError('Prices must be whole rupee amounts, and the discounted price cannot exceed the regular price.');
      return;
    }

    setBusyId('settings');
    setError('');
    setNotice('');
    const { error: saveError } = await supabase
      .from('pro_offer_settings')
      .update({
        regular_price_inr: regular,
        discounted_price_inr: discounted,
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
    setNotice('Pro offer and card appearance saved.');
    await loadOverview();
  };

  const updateSetting = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
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
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Pro applications</CardTitle>
          <p className="text-sm text-muted-foreground">Approving a request grants 12 months of unlimited Pro access.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading requests…</p>
          ) : overview.requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pro requests are waiting for review.</p>
          ) : overview.requests.map((request) => (
            <article key={request.id} className="grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Account</span><br /><span className="font-semibold">{request.account_name}</span></p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Form name</span><br /><span className="font-semibold">{request.full_name}</span></p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Phone</span><br /><a className="font-semibold underline" href={`tel:${request.phone}`}>{request.phone}</a></p>
                <p><span className="text-xs font-bold uppercase text-muted-foreground">Description</span><br /><span className="whitespace-pre-wrap">{request.description || '—'}</span></p>
                <p className="text-xs text-muted-foreground sm:col-span-2">Submitted {new Date(request.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-start gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => decideRequest(request, true)}
                  disabled={busyId === request.id}
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
            </article>
          ))}
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
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Pro card and displayed price</CardTitle>
          <p className="text-sm text-muted-foreground">These prices are informational; Pro access is granted only after you approve an application.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold text-muted-foreground">
              Regular price (₹)
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Not shown"
                value={settings.regular_price_inr ?? ''}
                onChange={(event) => updateSetting('regular_price_inr', event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-muted-foreground">
              Discounted price (₹)
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Not shown"
                value={settings.discounted_price_inr ?? ''}
                onChange={(event) => updateSetting('discounted_price_inr', event.target.value)}
              />
            </label>
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
