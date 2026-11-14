import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Check, Crown, Sparkles } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import ProStatusBadge, { formatProExpiry } from '@/components/ProStatusBadge';
import {
  loadProBatches,
  loadProOffer,
  formatPriceInr,
  getPlanLimitText,
} from '@/lib/premiumCatalog';
import { supabase } from '@/lib/supabase';

const BASIC_PLAN = { plan_code: 'basic', name: 'Basic' };
const PRO_PLAN = { plan_code: 'pro', name: 'Pro' };

function PremiumPage() {
  const { user, profile, authLoading, proAccess, refreshProAccess } = useAuth();
  const [offer, setOffer] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadProOffer(), loadProBatches()])
      .then(([settings, availableBatches]) => {
        if (active) {
          setOffer(settings);
          setBatches(availableBatches);
          setSelectedBatchId((current) => current || availableBatches[0]?.id || '');
        }
      })
      .catch((loadError) => {
        console.error('Could not load Pro offer settings.', loadError);
        if (active) setError('Pro details could not be loaded. Please try again later.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshProAccess().catch((statusError) => {
      console.error('Could not refresh Pro access for the plans page.', statusError);
    });
  }, [user?.id, refreshProAccess]);

  const cardStyle = useMemo(() => {
    const colorOne = offer?.color_one || '#302770';
    const colorTwo = offer?.color_two || '#7C3AED';
    const background = offer?.card_style === 'solid'
      ? colorOne
      : `linear-gradient(130deg, ${colorOne}, ${colorTwo})`;
    return { background, color: '#ffffff' };
  }, [offer]);

  const openRequestForm = () => {
    setFormOpen(true);
    setRequestSent(false);
    setError('');
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!supabase || !user) {
      setError('Sign in before requesting Pro access.');
      return;
    }
    if (!selectedBatchId) {
      setError('Choose an available Pro batch.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const { error: submitError } = await supabase.rpc('submit_pro_access_request', {
        p_full_name: fullName,
        p_phone: phone.replace(/\D/g, ''),
        p_batch_id: selectedBatchId,
        p_description: description,
      });
      if (submitError) throw submitError;
      setRequestSent(true);
      setFullName('');
      setPhone('');
      setDescription('');
    } catch (submitError) {
      console.error('Could not submit the Pro access request.', submitError);
      setError(submitError.message || 'Your request could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountName = profile?.display_name || user?.email || 'Signed-in account';
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || null;
  const hasBatchDiscount = selectedBatch?.discounted_price_inr != null
    && selectedBatch.discounted_price_inr < selectedBatch.regular_price_inr;

  return (
    <>
      <Helmet>
        <title>Impulse Plans - Impulse</title>
        <meta name="description" content="Compare Basic and Pro access on Impulse." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">
          <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
            <header className="mx-auto max-w-3xl text-center">
              <Badge variant="outline" className="mb-4 gap-2 rounded-full px-4 py-2">
                <Sparkles className="h-4 w-4" /> Impulse plans
              </Badge>
              <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">Choose your pace</h1>
              <p className="mt-4 text-muted-foreground">
                Basic gives you daily practice limits. Request Pro and we will contact you to arrange checkout.
              </p>
            </header>

            {isLoading ? (
              <p role="status" className="py-12 text-center text-muted-foreground">Loading plans…</p>
            ) : error && !offer ? (
              <p role="alert" className="py-12 text-center text-destructive">{error}</p>
            ) : (
              <div className="grid items-stretch gap-5 md:grid-cols-2">
                <Card className="flex flex-col border-border">
                  <CardHeader>
                    <CardTitle className="text-3xl font-black">{BASIC_PLAN.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">Your everyday study plan.</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="space-y-4">
                      {getPlanLimitText(BASIC_PLAN).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card
                  className={`pro-offer-card flex flex-col overflow-hidden border-0 shadow-xl ${offer?.card_style === 'animated' ? 'pro-offer-card--animated' : ''}`}
                  style={cardStyle}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-3xl font-black text-white">
                        <Crown className="h-6 w-6" aria-hidden="true" /> {PRO_PLAN.name}
                      </CardTitle>
                      <Badge className="border-white/30 bg-white/15 text-white">Unlimited</Badge>
                    </div>
                    <p className="text-sm text-white/80">Unlimited access to every Pro feature.</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="mb-6 space-y-4">
                      {getPlanLimitText(PRO_PLAN).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {!proAccess?.hasAccess && (
                      <div className="mb-5 space-y-3">
                        {batches.length > 0 ? (
                          <>
                            <label className="block space-y-1 text-sm font-semibold">
                              <span>Choose your batch</span>
                              <select
                                aria-label="Pro batch"
                                value={selectedBatchId}
                                onChange={(event) => setSelectedBatchId(event.target.value)}
                                className="h-10 w-full rounded-md border border-white/40 bg-white px-3 text-sm text-slate-950"
                              >
                                {batches.map((batch) => (
                                  <option key={batch.id} value={batch.id}>{batch.batch_name}</option>
                                ))}
                              </select>
                            </label>
                            {selectedBatch && (
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                {hasBatchDiscount && (
                                  <span className="text-lg text-white/70 line-through">
                                    {formatPriceInr(selectedBatch.regular_price_inr)}
                                  </span>
                                )}
                                <span className="text-3xl font-black">
                                  {formatPriceInr(selectedBatch.discounted_price_inr ?? selectedBatch.regular_price_inr)}
                                </span>
                                <span className="text-sm text-white/80">
                                  Expires {formatProExpiry(selectedBatch.expires_on)}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p role="status" className="rounded-xl bg-white/15 p-3 text-sm">
                            No upcoming Pro batches are available right now.
                          </p>
                        )}
                      </div>
                    )}

                    {authLoading ? (
                      <p role="status" className="mt-auto rounded-xl bg-white/15 p-4 text-sm">Checking your account…</p>
                    ) : !user ? (
                      <div className="mt-auto space-y-3 rounded-xl bg-white/15 p-4 text-sm">
                        <p>Sign in to attach your request to an account.</p>
                        <Button asChild className="bg-white font-bold text-black hover:bg-white/90">
                          <Link to="/account">Sign in</Link>
                        </Button>
                      </div>
                    ) : proAccess?.loading ? (
                      <p role="status" className="mt-auto rounded-xl bg-white/15 p-4 text-sm">Checking your Pro access…</p>
                    ) : proAccess?.error ? (
                      <div className="mt-auto space-y-3 rounded-xl bg-white/15 p-4 text-sm">
                        <p role="alert">Your Pro status could not be verified, so a new request is unavailable.</p>
                        <Button
                          type="button"
                          onClick={() => refreshProAccess().catch((statusError) => {
                            console.error('Could not retry Pro status verification.', statusError);
                          })}
                          className="bg-white font-bold text-black hover:bg-white/90"
                        >
                          Check again
                        </Button>
                      </div>
                    ) : proAccess?.hasAccess ? (
                      <div role="status" className="mt-auto flex flex-wrap items-center gap-4 rounded-xl bg-white/10 p-4">
                        <ProStatusBadge expiresAt={proAccess.expiresAt} />
                        <div>
                          <p className="font-black">
                            Your {proAccess.batchName ? `${proAccess.batchName} ` : ''}Pro benefits are active.
                          </p>
                          <p className="mt-1 text-sm text-white/80">
                            Your access expires {formatProExpiry(proAccess.expiresAt)}.
                          </p>
                        </div>
                      </div>
                    ) : !formOpen ? (
                      <Button
                        type="button"
                        onClick={openRequestForm}
                        disabled={!selectedBatch}
                        className="mt-auto bg-white font-black text-black hover:bg-white/90"
                      >
                        Buy Pro
                      </Button>
                    ) : requestSent ? (
                      <div role="status" className="mt-auto rounded-xl bg-white/15 p-4 text-sm">
                        <p className="font-bold">Request received.</p>
                        <p className="mt-1 text-white/80">We will get back to you for checkout.</p>
                      </div>
                    ) : (
                      <form onSubmit={submitRequest} className="mt-auto space-y-3 rounded-xl bg-white/10 p-4">
                        <p className="text-sm text-white/85">
                          Account: <span className="font-bold text-white">{accountName}</span>
                        </p>
                        <label className="block space-y-1 text-sm font-semibold">
                          <span>Full name</span>
                          <Input
                            required
                            minLength={2}
                            maxLength={120}
                            autoComplete="off"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            className="bg-white text-slate-950 placeholder:text-slate-500"
                          />
                        </label>
                        <label className="block space-y-1 text-sm font-semibold">
                          <span>Phone number</span>
                          <Input
                            required
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            pattern="[6-9][0-9]{9}"
                            maxLength={10}
                            placeholder="10-digit Indian number"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="bg-white text-slate-950 placeholder:text-slate-500"
                          />
                        </label>
                        <label className="block space-y-1 text-sm font-semibold">
                          <span>Description <span className="font-normal text-white/70">(optional)</span></span>
                          <Textarea
                            maxLength={1000}
                            rows={3}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Anything you would like us to know?"
                            className="bg-white text-slate-950 placeholder:text-slate-500"
                          />
                        </label>
                        {error && <p role="alert" className="text-sm font-semibold text-white">{error}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={isSubmitting} className="bg-white font-black text-black hover:bg-white/90">
                            {isSubmitting ? 'Sending…' : 'Send request'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} className="text-white hover:bg-white/15 hover:text-white">
                            Cancel
                          </Button>
                        </div>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Requests are linked to your signed-in account. Submitting a request does not charge you or activate Pro.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default PremiumPage;
