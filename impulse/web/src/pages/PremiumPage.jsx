import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Check, LogIn, Sparkles } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatPriceInr, loadPremiumCatalog } from '@/lib/premiumCatalog';

const BASIC_FEATURES = [
  'Unlimited PYQ practice',
  '2 previous papers per day',
  '5 custom tests per day',
  'Up to 3 friends',
];

const PRO_FEATURES = [
  'Complete access to all practice and test-series content',
  'Unlimited previous papers and custom tests',
  'Unlimited friends',
  'No usage restrictions',
];

function PremiumPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [application, setApplication] = useState(null);
  const [proAnnualPrice, setProAnnualPrice] = useState(null);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const metadata = user?.user_metadata || {};
    setFullName(profile?.display_name || metadata.full_name || metadata.name || '');
  }, [profile?.display_name, user?.id]);

  useEffect(() => {
    let active = true;
    setIsPriceLoading(true);
    setPriceError('');
    loadPremiumCatalog()
      .then((plans) => {
        const price = plans
          .find((plan) => plan.plan_code === 'pro')
          ?.prices.find((item) => item.duration_months === 12)?.price_inr;
        if (!Number.isSafeInteger(price) || price < 0) {
          throw new Error('The Pro annual price is not available.');
        }
        if (active) setProAnnualPrice(price);
      })
      .catch((catalogError) => {
        console.error('Could not load the current Pro price.', catalogError);
        if (active) setPriceError(catalogError.message || 'Could not load the current Pro price.');
      })
      .finally(() => {
        if (active) setIsPriceLoading(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      setApplication(null);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError('');
    supabase.rpc('get_my_pro_application_status')
      .then(({ data, error: statusError }) => {
        if (statusError) throw statusError;
        if (active) setApplication(data);
      })
      .catch((statusError) => {
        console.error('Could not load Pro application status.', statusError);
        if (active) setError(statusError.message || 'Could not load your Pro application status.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  const handleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (signInError) {
      console.error('Could not start Google sign-in for a Pro application.', signInError);
      setError(signInError.message || 'Google sign-in could not be started.');
    }
  };

  const handleApplicationSubmit = async (event) => {
    event.preventDefault();
    if (!user || !supabase) {
      setError('Sign in with Google before applying for Pro.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { data, error: submitError } = await supabase.rpc('submit_pro_application', {
        p_full_name: fullName.trim(),
        p_phone_number: phoneNumber.trim(),
      });
      if (submitError) throw submitError;
      setApplication(data);
      setNotice('Application received. We will contact you to arrange checkout.');
    } catch (submitError) {
      console.error('Could not submit the Pro application.', submitError);
      setError(submitError.message || 'Your application could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = application?.status;
  const activeMembership = currentStatus === 'approved'
    && application?.expires_at
    && new Date(application.expires_at) > new Date();
  const canApply = !application || ['rejected', 'removed', 'expired'].includes(currentStatus);

  return (
    <>
      <Helmet>
        <title>Basic and Pro plans - Impulse</title>
        <meta name="description" content="Compare Basic and Pro access on Impulse." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <Sparkles className="mx-auto mb-3 h-7 w-7 text-primary" />
              <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Choose your plan</h1>
              <p className="mt-4 text-muted-foreground">
                Pro is an annual membership. Apply here and we will contact you to arrange checkout.
              </p>
            </div>

            <div className="grid items-stretch gap-5 md:grid-cols-2">
              {[
                { title: 'Basic', price: 'Free', features: BASIC_FEATURES },
                {
                  title: 'Pro',
                  price: proAnnualPrice === null
                    ? (isPriceLoading ? 'Loading price…' : 'Price unavailable')
                    : `${formatPriceInr(proAnnualPrice)} / year`,
                  features: PRO_FEATURES,
                },
              ].map((plan) => (
                <Card key={plan.title} className={`flex flex-col border-border ${plan.title === 'Pro' ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-2xl font-black">{plan.title}</CardTitle>
                    <p className="text-3xl font-black">{plan.price}</p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
            {priceError ? <p role="alert" className="mt-4 text-center text-sm text-destructive">{priceError}</p> : null}

            <Card className="mx-auto mt-8 max-w-2xl border-border">
              <CardHeader>
                <CardTitle>Apply for Pro</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Submit your name and phone number. We will contact you to arrange checkout.
                  Pro access starts after payment is confirmed and an administrator approves the application.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <p className="break-all text-sm text-muted-foreground">
                    Google account: {user.email || 'Email unavailable'}
                  </p>
                ) : (
                  <Button type="button" onClick={handleSignIn} disabled={!supabase}>
                    <LogIn className="h-4 w-4" /> Sign in with Google to apply
                  </Button>
                )}

                {isLoading ? <p role="status" className="text-sm text-muted-foreground">Checking application status…</p> : null}
                {activeMembership ? (
                  <p role="status" className="rounded-lg border border-primary/40 p-3 text-sm">
                    Pro is active until {new Date(application.expires_at).toLocaleDateString()}.
                  </p>
                ) : null}
                {currentStatus === 'pending' ? (
                  <p role="status" className="rounded-lg border border-border p-3 text-sm">
                    Your application is pending. We will contact you using the phone number you provided.
                  </p>
                ) : null}
                {currentStatus === 'suspended' ? (
                  <p role="status" className="rounded-lg border border-destructive/40 p-3 text-sm">
                    Your Pro membership is suspended. Contact support if you think this is a mistake.
                  </p>
                ) : null}
                {notice ? <p role="status" className="text-sm text-primary">{notice}</p> : null}
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

                {user && canApply ? (
                  <form className="space-y-4" onSubmit={handleApplicationSubmit}>
                    <label className="block space-y-1 text-sm font-medium">
                      Full name
                      <input
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3"
                      />
                    </label>
                    <label className="block space-y-1 text-sm font-medium">
                      Indian mobile number
                      <input
                        autoComplete="tel-national"
                        type="tel"
                        inputMode="numeric"
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        required
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="h-10 w-full rounded-md border border-input bg-background px-3"
                      />
                    </label>
                    <Button type="submit" disabled={isSubmitting || isLoading}>
                      {isSubmitting ? 'Submitting…' : 'Submit Pro application'}
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default PremiumPage;
