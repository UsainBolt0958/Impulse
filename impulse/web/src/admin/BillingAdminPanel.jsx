import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LogIn, RefreshCw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { loadPublicSeries } from '@/lib/portalServer';
import { formatPriceInr } from '@/lib/premiumCatalog';
import { supabase } from '@/lib/supabase';

const DURATIONS = [3, 6, 12];

function BillingAdminPanel() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [plans, setPlans] = useState([]);
  const [prices, setPrices] = useState([]);
  const [series, setSeries] = useState([]);
  const [seriesPrices, setSeriesPrices] = useState({});
  const [referralSettings, setReferralSettings] = useState(null);
  const [summary, setSummary] = useState(null);

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setError('');
    try {
      const { data: adminAccess, error: adminError } = await supabase.rpc('is_billing_admin');
      if (adminError) throw adminError;
      setIsAdmin(Boolean(adminAccess));
      if (!adminAccess) return;

      const [plansResult, pricesResult, settingsResult, summaryResult] = await Promise.all([
        supabase.from('premium_plans').select('plan_code,name,description,enabled,sort_order').order('sort_order'),
        supabase.from('premium_plan_prices').select('plan_code,duration_months,price_inr').order('plan_code').order('duration_months'),
        supabase.from('referral_settings').select('enabled,inviter_discount_percent,invitee_discount_percent,max_combined_discount_percent,reward_expiry_days').eq('singleton', true).single(),
        supabase.rpc('get_billing_admin_summary'),
      ]);
      if (plansResult.error) throw plansResult.error;
      if (pricesResult.error) throw pricesResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (summaryResult.error) throw summaryResult.error;

      setPlans(plansResult.data || []);
      setPrices(pricesResult.data || []);
      setReferralSettings(settingsResult.data);
      setSummary(summaryResult.data);
      try {
        setSeries(await loadPublicSeries());
      } catch (seriesError) {
        console.error('Could not load published test series for billing prices.', seriesError);
        setSeries([]);
      }

      const { data: seriesPriceRows, error: seriesPriceError } = await supabase
        .from('test_series_prices')
        .select('series_id,price_inr,enabled');
      if (seriesPriceError) throw seriesPriceError;
      setSeriesPrices(Object.fromEntries((seriesPriceRows || []).map((row) => [row.series_id, {
        price: String(row.price_inr),
        enabled: row.enabled,
      }])));
    } catch (loadError) {
      console.error('Could not load premium billing settings.', loadError);
      setError(loadError.message || 'Could not load billing data from Supabase.');
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
      setLoading(false);
    }
  }, [session, loadData]);

  const signIn = async () => {
    if (!supabase) return;
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/billing` },
    });
    if (authError) setError(authError.message);
  };

  const savePlanPrice = async (planCode, durationMonths, amount) => {
    if (String(amount).trim() === '') {
      setError('Enter a whole-number price in rupees (zero or more).');
      return;
    }
    const price = Number(amount);
    if (!Number.isInteger(price) || price < 0) {
      setError('Enter a whole-number price in rupees (zero or more).');
      return;
    }
    const key = `${planCode}-${durationMonths}`;
    setSavingKey(key);
    setError('');
    setNotice('');
    const { error: saveError } = await supabase
      .from('premium_plan_prices')
      .upsert({
        plan_code: planCode,
        duration_months: durationMonths,
        price_inr: price,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_code,duration_months' });
    setSavingKey('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setPrices((current) => current.map((item) => (
      item.plan_code === planCode && item.duration_months === durationMonths
        ? { ...item, price_inr: price }
        : item
    )));
    setNotice(`${planCode} ${durationMonths}-month price saved.`);
  };

  const saveSeriesPrice = async (item) => {
    if (String(seriesPrices[item.id]?.price ?? '').trim() === '') {
      setError(`Enter a whole-number rupee price for ${item.title || item.name || item.id}.`);
      return;
    }
    const price = Number(seriesPrices[item.id]?.price);
    if (!Number.isInteger(price) || price < 0) {
      setError(`Enter a whole-number rupee price for ${item.title || item.name || item.id}.`);
      return;
    }
    setSavingKey(`series-${item.id}`);
    setError('');
    setNotice('');
    const { error: saveError } = await supabase
      .from('test_series_prices')
      .upsert({
        series_id: item.id,
        price_inr: price,
        enabled: seriesPrices[item.id]?.enabled !== false,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'series_id' });
    setSavingKey('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setNotice(`Price saved for ${item.title || item.name || item.id}.`);
  };

  const saveReferralSettings = async () => {
    const fields = [
      'inviter_discount_percent',
      'invitee_discount_percent',
      'max_combined_discount_percent',
      'reward_expiry_days',
    ];
    const normalized = Object.fromEntries(fields.map((field) => [field, Number(referralSettings[field])]));
    if (
      fields.some((field) => !Number.isInteger(normalized[field]))
      || normalized.inviter_discount_percent < 0 || normalized.inviter_discount_percent > 100
      || normalized.invitee_discount_percent < 0 || normalized.invitee_discount_percent > 100
      || normalized.max_combined_discount_percent < 0 || normalized.max_combined_discount_percent > 100
      || normalized.reward_expiry_days < 1 || normalized.reward_expiry_days > 365
    ) {
      setError('Discounts must be 0–100 percent, and reward expiry must be 1–365 days.');
      return;
    }
    if (normalized.inviter_discount_percent + normalized.invitee_discount_percent < normalized.max_combined_discount_percent) {
      setError('The combined discount cap cannot exceed the sum of inviter and invitee discounts.');
      return;
    }

    setSavingKey('referral-settings');
    setError('');
    setNotice('');
    const { error: saveError } = await supabase
      .from('referral_settings')
      .update({
        ...normalized,
        enabled: referralSettings.enabled,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('singleton', true);
    setSavingKey('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setNotice('Referral discount settings saved. Referral checkout/reward issuance is not active until payment integration is added.');
  };

  const updateReferralField = (field, value) => {
    setReferralSettings((current) => ({ ...current, [field]: value }));
  };

  if (!session) {
    return (
      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Billing access</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with an admin-approved Google account to manage prices and view billing records.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button onClick={signIn}><LogIn className="h-4 w-4" /> Sign in with Google</Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <p role="status" className="py-10 text-center text-muted-foreground">Loading billing settings…</p>;
  }

  if (!isAdmin) {
    return (
      <Card className="rounded-3xl border-border">
        <CardContent className="space-y-4 p-6">
          <p className="font-bold">This Google account is not approved to manage billing.</p>
          <p className="text-sm text-muted-foreground">Use one of the Google accounts approved in the admin access migration.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const priceValue = (planCode, months) => (
    prices.find((price) => price.plan_code === planCode && price.duration_months === months)?.price_inr ?? ''
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Premium & billing</h2>
          <p className="text-sm text-muted-foreground">Catalog and reports are stored in Supabase.</p>
        </div>
        <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-primary/40 p-3 text-sm">{notice}</p>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Collected payments', formatPriceInr(summary.gross_collected_inr)],
            ['Successful payments', summary.successful_payments],
            ['Active subscriptions', summary.active_subscriptions],
            ['Qualified referrals', summary.qualified_referrals],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-2xl border-border">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Subscription pricing</CardTitle>
          <p className="text-sm text-muted-foreground">Prices are rupees per full subscription term. Free is not editable here.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {plans.filter((plan) => plan.plan_code !== 'free').map((plan) => (
            <section key={plan.plan_code} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-black">{plan.name}</h3>
                <Badge variant="outline">Test series sold separately</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {DURATIONS.map((months) => (
                  <label key={months} className="space-y-1 text-xs font-bold text-muted-foreground">
                    {months} months (₹)
                    <div className="flex gap-2">
                      <Input
                        aria-label={`${plan.name} ${months}-month price in rupees`}
                        type="number"
                        min="0"
                        step="1"
                        value={priceValue(plan.plan_code, months)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPrices((current) => {
                            const exists = current.some((item) => item.plan_code === plan.plan_code && item.duration_months === months);
                            return exists
                              ? current.map((item) => item.plan_code === plan.plan_code && item.duration_months === months ? { ...item, price_inr: value } : item)
                              : [...current, { plan_code: plan.plan_code, duration_months: months, price_inr: value }];
                          });
                        }}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Save ${plan.name} ${months}-month price`}
                        disabled={savingKey === `${plan.plan_code}-${months}`}
                        onClick={() => savePlanPrice(plan.plan_code, months, priceValue(plan.plan_code, months))}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Current: {plan.name} · {DURATIONS.map((months) => `${months}m ${formatPriceInr(priceValue(plan.plan_code, months))}`).join(' · ')}</p>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Test-series prices</CardTitle>
          <p className="text-sm text-muted-foreground">A price is saved per series, not included in any subscription plan.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test series loaded from the admin API. Check the API connection and try refresh.</p>
          ) : series.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_180px_auto] sm:items-center">
              <div>
                <p className="font-bold">{item.title || item.name || 'Untitled series'}</p>
                <p className="text-xs text-muted-foreground">ID: {item.id}</p>
              </div>
              <label className="space-y-1 text-xs font-bold text-muted-foreground">
                Price (₹)
                <Input
                  type="number"
                  min="0"
                  step="1"
                  aria-label={`${item.title || item.name || item.id} price in rupees`}
                  value={seriesPrices[item.id]?.price ?? ''}
                  placeholder="Not set"
                  onChange={(event) => setSeriesPrices((current) => ({
                    ...current,
                    [item.id]: { ...current[item.id], price: event.target.value },
                  }))}
                />
              </label>
              <Button
                variant="outline"
                disabled={savingKey === `series-${item.id}`}
                onClick={() => saveSeriesPrice(item)}
              >
                <Save className="h-4 w-4" /> Save price
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {referralSettings && (
        <Card className="rounded-3xl border-border">
          <CardHeader>
            <CardTitle>Referral discount controls</CardTitle>
            <p className="text-sm text-muted-foreground">These are configuration only until referrals and checkout are connected to the payment backend.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={referralSettings.enabled}
                onChange={(event) => updateReferralField('enabled', event.target.checked)}
              />
              Enable referral offer configuration
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['inviter_discount_percent', 'Inviter discount (%)'],
                ['invitee_discount_percent', 'Invitee discount (%)'],
                ['max_combined_discount_percent', 'Maximum combined discount (%)'],
                ['reward_expiry_days', 'Reward expiry (days)'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-1 text-xs font-bold text-muted-foreground">
                  {label}
                  <Input
                    type="number"
                    min={field === 'reward_expiry_days' ? 1 : 0}
                    max={field === 'reward_expiry_days' ? 365 : 100}
                    step="1"
                    value={referralSettings[field]}
                    onChange={(event) => updateReferralField(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <Button disabled={savingKey === 'referral-settings'} onClick={saveReferralSettings}>
              <Save className="h-4 w-4" /> Save referral settings
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Latest subscriptions and payments</CardTitle>
          <p className="text-sm text-muted-foreground">No entries are expected until a trusted payment webhook writes verified transactions.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="mb-2 font-bold">Subscriptions</h3>
            {summary?.recent_subscriptions?.length ? (
              <div className="space-y-2">
                {summary.recent_subscriptions.map((item) => (
                  <div key={item.id} className="grid gap-1 rounded-xl border border-border p-3 text-sm sm:grid-cols-4">
                    <span className="font-bold">{item.plan_code} · {item.duration_months} months</span>
                    <span>{item.status}</span>
                    <span>{formatPriceInr(item.paid_inr)} paid</span>
                    <span className="truncate text-muted-foreground" title={item.user_id}>
                      {item.user_display_name || item.user_email || item.user_id}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No subscription records yet.</p>}
          </div>
          <div>
            <h3 className="mb-2 font-bold">Payments</h3>
            {summary?.recent_payments?.length ? (
              <div className="space-y-2">
                {summary.recent_payments.map((item) => (
                  <div key={item.id} className="grid gap-1 rounded-xl border border-border p-3 text-sm sm:grid-cols-4">
                    <span className="font-bold">{formatPriceInr(item.amount_inr)}</span>
                    <span>{item.provider} · {item.status}</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</span>
                    <span className="truncate text-muted-foreground" title={item.user_id}>
                      {item.user_display_name || item.user_email || item.user_id}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No verified payment transactions have been recorded.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border">
        <CardHeader>
          <CardTitle>Recent price and referral changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary?.recent_config_changes?.length ? summary.recent_config_changes.map((change) => (
            <div key={change.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-bold">{change.config_type} · {change.config_key}</span>
                <span className="text-muted-foreground">
                  {change.changed_at ? new Date(change.changed_at).toLocaleString() : '—'}
                </span>
              </div>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {change.old_value ? `${JSON.stringify(change.old_value)} → ` : 'Initial value: '}
                {JSON.stringify(change.new_value)}
              </p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No admin changes recorded yet.</p>}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default BillingAdminPanel;
