import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LogIn, RefreshCw, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import {
  formatPriceInr,
  loadPremiumCatalog,
  updateProAnnualPrice,
} from '@/lib/premiumCatalog';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function ProApplicationCard({ application, saving, onAction }) {
  const isPending = application.status === 'pending';
  const isMember = application.status === 'approved'
    && application.expires_at
    && new Date(application.expires_at) > new Date();
  const isSuspended = application.status === 'suspended';

  return (
    <article className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-bold">{application.full_name}</p>
        <p className="break-all text-sm text-muted-foreground">{application.user_email}</p>
        <p className="text-sm">{application.phone_number}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Applied {formatDate(application.submitted_at)}
          {application.expires_at ? ` · Expires ${new Date(application.expires_at).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div>
        <Badge variant={isMember ? 'default' : isPending ? 'secondary' : 'outline'}>
          {isMember ? 'Pro active' : application.status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {isPending ? (
          <>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => onAction(application.id, 'approve')}
              aria-label={`Approve Pro for ${application.user_email}`}
            >
              <UserRoundCheck className="h-4 w-4" /> Approve & activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onAction(application.id, 'reject')}
            >
              Reject
            </Button>
          </>
        ) : null}
        {isMember ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onAction(application.id, 'suspend')}
            >
              Suspend
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={saving}
              onClick={() => onAction(application.id, 'remove')}
            >
              <UserRoundX className="h-4 w-4" /> Remove
            </Button>
          </>
        ) : null}
        {isSuspended ? (
          <>
            <Button
              size="sm"
              disabled={saving || new Date(application.expires_at) <= new Date()}
              onClick={() => onAction(application.id, 'restore')}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={saving}
              onClick={() => onAction(application.id, 'remove')}
            >
              <UserRoundX className="h-4 w-4" /> Remove
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function BillingAdminPanel() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [proAnnualPrice, setProAnnualPrice] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setError('');
    try {
      const { data: adminAccess, error: adminError } = await supabase.rpc('is_billing_admin');
      if (adminError) throw adminError;
      setIsAdmin(Boolean(adminAccess));
      if (!adminAccess) return;

      const [applicationsResult, summaryResult, catalog] = await Promise.all([
        supabase.rpc('get_pro_applications_admin'),
        supabase.rpc('get_billing_admin_summary'),
        loadPremiumCatalog(),
      ]);
      if (applicationsResult.error) throw applicationsResult.error;
      if (summaryResult.error) throw summaryResult.error;
      const annualPrice = catalog
        .find((plan) => plan.plan_code === 'pro')
        ?.prices.find((price) => price.duration_months === 12)?.price_inr;
      if (!Number.isSafeInteger(annualPrice) || annualPrice < 0) {
        throw new Error('The Pro annual price is not configured in Supabase.');
      }
      setApplications(applicationsResult.data || []);
      setSummary(summaryResult.data);
      setProAnnualPrice(annualPrice);
      setPriceDraft(String(annualPrice));
    } catch (loadError) {
      console.error('Could not load Pro admin data.', loadError);
      setError(loadError.message || 'Could not load Pro admin data.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError('Supabase is not configured in this admin build.');
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      if (active) setSession(data.session);
    }).catch((sessionError) => {
      console.error('Could not load admin Supabase session.', sessionError);
      if (active) {
        setError(sessionError.message || 'Could not check the admin sign-in.');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsAdmin(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) loadData();
    else {
      setIsAdmin(false);
      setApplications([]);
      setSummary(null);
      setLoading(false);
    }
  }, [session, loadData]);

  const signIn = async () => {
    if (!supabase) return;
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      if (authError) throw authError;
    } catch (authError) {
      console.error('Could not start Google billing-admin sign-in.', authError);
      setError(authError.message || 'Could not start Google sign-in.');
    }
  };

  const updateApplication = async (id, action) => {
    setSavingId(id);
    setError('');
    setNotice('');
    try {
      const { error: actionError } = await supabase.rpc('admin_update_pro_application', {
        p_application_id: id,
        p_action: action,
      });
      if (actionError) throw actionError;
      setNotice(action === 'approve'
        ? 'Pro activated for one year. Approve only after checkout is confirmed.'
        : `Pro application updated: ${action}.`);
      await loadData();
    } catch (actionError) {
      console.error('Could not update Pro application.', actionError);
      setError(actionError.message || 'Could not update the Pro application.');
    } finally {
      setSavingId('');
    }
  };

  const saveProPrice = async (event) => {
    event.preventDefault();
    setIsSavingPrice(true);
    setError('');
    setNotice('');
    try {
      const updatedPrice = await updateProAnnualPrice(Number(priceDraft));
      setProAnnualPrice(updatedPrice);
      setPriceDraft(String(updatedPrice));
      setNotice('Pro annual price updated. The student-facing plans page will show this amount.');
      await loadData();
    } catch (priceError) {
      console.error('Could not update the Pro annual price.', priceError);
      setError(priceError.message || 'Could not update the Pro annual price.');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const currentApplications = useMemo(() => applications.filter((application) => (
    ['pending', 'approved', 'suspended'].includes(application.status)
  )), [applications]);
  const pendingApplications = currentApplications.filter((application) => application.status === 'pending');
  const proMembers = currentApplications.filter((application) => application.status === 'approved'
    && application.expires_at
    && new Date(application.expires_at) > new Date());
  const suspendedMembers = currentApplications.filter((application) => application.status === 'suspended');
  const historicalApplications = applications.filter((application) => (
    ['rejected', 'removed', 'expired'].includes(application.status)
  ));

  if (!session) {
    return (
      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Pro applications</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in with an admin-approved Google account to review applications.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={signIn} disabled={!supabase}>
            <LogIn className="h-4 w-4" /> Sign in with Google
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <p role="status" className="py-10 text-center text-muted-foreground">Loading Pro applications…</p>;
  }

  if (!isAdmin) {
    return (
      <Card className="rounded-3xl border-border">
        <CardContent className="space-y-4 p-6">
          <p className="font-bold">This Google account is not approved to manage Pro memberships.</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Pro access</h2>
          <p className="text-sm text-muted-foreground">
            {proAnnualPrice === null ? 'Price unavailable' : `${formatPriceInr(proAnnualPrice)} per year`}
            {' · activate only after checkout is confirmed.'}
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
      {notice ? <p role="status" className="rounded-xl border border-primary/40 p-3 text-sm">{notice}</p> : null}

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Pro annual price</CardTitle>
          <p className="text-sm text-muted-foreground">
            This whole-rupee amount is shown on the student plans page. Changes are recorded in the billing audit.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Current price: <strong>{proAnnualPrice === null ? 'Unavailable' : `${formatPriceInr(proAnnualPrice)} / year`}</strong></p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={saveProPrice}>
            <label className="block space-y-1 text-sm font-medium">
              New Pro price (INR per year)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={priceDraft}
                onChange={(event) => setPriceDraft(event.target.value)}
                className="h-10 w-48 rounded-md border border-input bg-background px-3"
              />
            </label>
            <Button type="submit" disabled={isSavingPrice || Number(priceDraft) === proAnnualPrice}>
              {isSavingPrice ? 'Saving…' : 'Save Pro price'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Applications ({pendingApplications.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review the Google email and phone number. Approving grants one year of Pro access.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingApplications.length ? pendingApplications.map((application) => (
            <ProApplicationCard
              key={application.id}
              application={application}
              saving={savingId === application.id}
              onAction={updateApplication}
            />
          )) : <p className="text-sm text-muted-foreground">No pending Pro applications.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Pro users ({proMembers.length})</CardTitle>
          <p className="text-sm text-muted-foreground">Active members may be suspended or removed at any time.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {proMembers.length ? proMembers.map((application) => (
            <ProApplicationCard
              key={application.id}
              application={application}
              saving={savingId === application.id}
              onAction={updateApplication}
            />
          )) : <p className="text-sm text-muted-foreground">No active Pro users.</p>}
        </CardContent>
      </Card>

      {suspendedMembers.length ? (
        <Card className="rounded-3xl border-border">
          <CardHeader><CardTitle>Suspended Pro memberships ({suspendedMembers.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {suspendedMembers.map((application) => (
              <ProApplicationCard
                key={application.id}
                application={application}
                saving={savingId === application.id}
                onAction={updateApplication}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-3xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-black">Archive · legacy UPI payment records and reports</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Historical payment data is retained for reference. Checkout and payment-approval links are disconnected.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Archived gross receipts', `₹${Number(summary?.gross_collected_inr || 0).toLocaleString('en-IN')}`],
            ['Archived successful payments', summary?.successful_payments || 0],
            ['Legacy subscription records', summary?.subscription_records || 0],
            ['Legacy payment provider', 'UPI Gateway'],
          ].map(([label, value]) => (
            <Card key={label} className="border-border">
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-black">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 font-bold">Archived subscriptions</h3>
            {summary?.recent_subscriptions?.length ? (
              <div className="space-y-2">
                {summary.recent_subscriptions.map((item) => (
                  <div key={item.id} className="grid gap-1 rounded-xl border border-border p-3 text-sm sm:grid-cols-3">
                    <span className="font-bold">{item.plan_code} · {item.duration_months} months</span>
                    <span>{item.status} · ₹{Number(item.paid_inr || 0).toLocaleString('en-IN')} paid</span>
                    <span className="truncate text-muted-foreground" title={item.user_id}>
                      {item.user_email || item.user_id}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No archived subscriptions.</p>}
          </section>
          <section>
            <h3 className="mb-2 font-bold">Archived payment transactions</h3>
            {summary?.recent_payments?.length ? (
              <div className="space-y-2">
                {summary.recent_payments.map((item) => (
                  <div key={item.id} className="grid gap-1 rounded-xl border border-border p-3 text-sm sm:grid-cols-3">
                    <span className="font-bold">₹{Number(item.amount_inr || 0).toLocaleString('en-IN')}</span>
                    <span>{item.provider} · {item.status}</span>
                    <span className="truncate text-muted-foreground" title={item.user_id}>
                      {item.user_email || item.user_id}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No archived payment transactions.</p>}
          </section>
        </div>
      </details>

      {historicalApplications.length ? (
        <details className="rounded-3xl border border-border bg-card p-5">
          <summary className="cursor-pointer font-black">Past Pro applications ({historicalApplications.length})</summary>
          <div className="mt-4 space-y-3">
            {historicalApplications.map((application) => (
              <ProApplicationCard
                key={application.id}
                application={application}
                saving={savingId === application.id}
                onAction={updateApplication}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default BillingAdminPanel;
