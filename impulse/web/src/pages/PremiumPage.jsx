import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Check, Crown, Sparkles } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CheckoutControl from '@/components/CheckoutControl.jsx';
import { loadPremiumCatalog, formatPriceInr, getPlanLimitText } from '@/lib/premiumCatalog';
import { FREE_ACCESS_END_LABEL, useFreeAccessActive } from '@/lib/freeAccess';

function PremiumPage() {
  const freeAccessActive = useFreeAccessActive();
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadPremiumCatalog()
      .then((catalog) => {
        if (active) setPlans(catalog);
      })
      .catch((loadError) => {
        console.error('Could not load subscription pricing.', loadError);
        if (active) setError('Subscription plans could not be loaded. Please try again later.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <>
      <Helmet>
        <title>Impulse Premium - Impulse</title>
        <meta name="description" content="Compare Impulse subscription plans and features." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <Badge variant="outline" className="mb-4 gap-2 rounded-full px-4 py-2">
                <Sparkles className="h-4 w-4" /> Impulse subscriptions
              </Badge>
              <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Choose your pace</h1>
              <p className="mt-4 text-muted-foreground">
                {freeAccessActive
                  ? `All subscription plans and test series are free through ${FREE_ACCESS_END_LABEL}. Listed prices are unchanged.`
                  : 'PYQ practice is available on every plan. Test series are separate purchases and are not included.'}
              </p>
            </div>

            {isLoading ? (
              <p className="py-16 text-center text-muted-foreground">Loading plans…</p>
            ) : error ? (
              <p role="alert" className="py-16 text-center text-destructive">{error}</p>
            ) : (
              <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
                {plans.map((plan) => (
                  <Card key={plan.plan_code} className={`flex flex-col border-border ${plan.plan_code === 'gold' ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-2xl font-black">{plan.name}</CardTitle>
                        {plan.plan_code === 'gold' && <Badge>Popular</Badge>}
                        {plan.plan_code === 'ultimate' && <Crown className="h-5 w-5 text-primary" aria-label="Ultimate" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <ul className="mb-6 space-y-3">
                        {getPlanLimitText(plan).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {(plan.features || []).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto space-y-2 border-t border-border pt-4">
                        {plan.prices.map((price) => (
                          <div key={price.duration_months} className="space-y-2 rounded-md border border-border p-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span>{price.duration_months === 0 ? 'Free' : `${price.duration_months} months`}</span>
                              <span className={freeAccessActive && price.price_inr > 0 ? 'font-bold line-through text-muted-foreground' : 'font-bold'}>
                                {formatPriceInr(price.price_inr)}
                              </span>
                            </div>
                            {freeAccessActive && plan.plan_code !== 'free' && price.price_inr > 0 ? (
                              <p className="text-right text-xs font-semibold text-primary">
                                Free through {FREE_ACCESS_END_LABEL}
                              </p>
                            ) : null}
                            {plan.plan_code !== 'free' && price.price_inr > 0 ? (
                              freeAccessActive ? null : (
                                <CheckoutControl
                                  productType="subscription"
                                  planCode={plan.plan_code}
                                  durationMonths={price.duration_months}
                                  priceInr={price.price_inr}
                                />
                              )
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="mt-8 text-center text-xs text-muted-foreground">
              {freeAccessActive
                ? `No payment is required through ${FREE_ACCESS_END_LABEL}; listed prices are retained for reference.`
                : 'Checkout uses the current server-side catalog price. Enter your Indian mobile number to continue with UPI.'}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default PremiumPage;
