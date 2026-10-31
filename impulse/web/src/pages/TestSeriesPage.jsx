import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Target } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import { toast } from 'sonner';
import {
  establishExamSession,
  getSeriesBillingAccess,
  loadPublicSeries,
  loadTests,
} from '@/lib/portalServer';
import { formatPriceInr, loadTestSeriesPriceMap } from '@/lib/premiumCatalog';
import CheckoutControl from '@/components/CheckoutControl.jsx';
import { FREE_ACCESS_END_LABEL, useFreeAccessActive } from '@/lib/freeAccess';

export function getTestSeriesDashboardUrl(testId, seriesId) {
  return `/test-series/${encodeURIComponent(seriesId)}/${encodeURIComponent(testId)}`;
}

function TestSeriesPage() {
  const freeAccessActive = useFreeAccessActive();
  const [seriesList, setSeriesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceLoadError, setPriceLoadError] = useState(false);
  const [accessLoadError, setAccessLoadError] = useState(false);

  useEffect(() => {
    const fetchSeries = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [series, tests] = await Promise.all([loadPublicSeries(), loadTests()]);
        let pricesBySeries = new Map();
        let pricingFailed = false;
        let accessFailed = false;
        try {
          pricesBySeries = await loadTestSeriesPriceMap();
        } catch (priceError) {
          console.error('Could not load test-series prices from Supabase.', priceError);
          pricingFailed = true;
        }
        const accessBySeries = new Map();
        if (!pricingFailed && !freeAccessActive) {
          const paidSeries = series.filter((item) => Number(pricesBySeries.get(item.id)?.price_inr) > 0);
          const accessResults = await Promise.allSettled(
            paidSeries.map((item) => getSeriesBillingAccess(item.id))
          );
          accessResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              accessBySeries.set(paidSeries[index].id, result.value);
            } else {
              console.error(`Could not check access for test series ${paidSeries[index].id}.`, result.reason);
              accessFailed = true;
            }
          });
        }
        setPriceLoadError(pricingFailed);
        setAccessLoadError(accessFailed);
        const publishedSeries = series
          .filter(s => s.published && s.meta?.kind !== 'previous-papers') // Previous papers have their own library.
          .map((item) => ({
            ...item,
            priceConfig: pricesBySeries.get(item.id) || null,
            price: pricesBySeries.get(item.id)?.enabled ? pricesBySeries.get(item.id).price_inr : null,
            access: accessBySeries.get(item.id) || null,
            tests: tests
              .filter((test) => test.seriesId === item.id && test.published) // Only published tests
              .map((test) => {
                const durationMinutes = Number(test.durationMinutes) || Number(item.durationMinutes) || (Number(test.durationSec) ? Math.round(Number(test.durationSec) / 60) : 0);
                return {
                  ...test,
                  questions: Number(test.questionCount) || (test.sections || []).reduce(
                    (count, section) => count + (section.questions || []).length,
                    0
                  ),
                  duration: durationMinutes,
                  subjects: Array.from(new Set((test.sections || []).map((section) => section.subject).filter(Boolean))),
                };
              }),
          }));
        setSeriesList(publishedSeries);
      } catch (fetchError) {
        setError('Unable to load published test series.');
        console.error(fetchError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeries();
  }, [freeAccessActive]);

  const handleStartTest = async (testId, seriesId) => {
    try {
      await establishExamSession(seriesId);
      window.location.assign(getTestSeriesDashboardUrl(testId, seriesId));
    } catch (startError) {
      console.error('Could not authorize starting this test.', startError);
      toast.error(startError.message || 'This test is not available to your account.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Test Series - Impulse</title>
        <meta name="description" content="Take full-length mock tests for JEE, NEET, and other competitive exams" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="text-5xl font-black uppercase tracking-tight mb-2">Test Series</h1>
            </div>

            {isLoading ? (
              <div className="text-center py-20 text-muted-foreground">Loading published test series...</div>
            ) : error ? (
              <div className="text-center py-20 text-destructive">{error}</div>
            ) : seriesList.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">No published test series are available yet.</div>
            ) : (
              <div className="space-y-12">
                {seriesList.map((series) => (
                  <div key={series.id}>
                    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight">{series.title}</h2>
                        {series.description ? (
                          <p className="text-sm text-muted-foreground mt-2">{series.description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default">{series.tests?.length ?? 0} tests</Badge>
                        <Badge variant="secondary">Published</Badge>
                        {series.price !== null && (
                          <Badge variant="outline">
                            {formatPriceInr(series.price)}
                            {freeAccessActive ? ` · free through ${FREE_ACCESS_END_LABEL}` : ' · sold separately'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(series.tests || []).map((test) => (
                        <Card key={test.id} className="border-border">
                          <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">{test.title || test.name || 'Untitled Test'}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <ColoredIcon icon={Target} name="target" size={4} />
                                <span className="font-medium">{test.questions} Questions</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <ColoredIcon icon={Clock} name="clock" size={4} />
                                <span className="font-medium">{test.duration} Minutes</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <ColoredIcon icon={FileText} name="filetext" size={4} />
                                <span className="font-medium">{(test.subjects || []).join(', ') || 'Mixed subjects'}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(test.subjects || []).length > 0 ? (
                                test.subjects.map((subject) => (
                                  <Badge key={subject} variant="outline" className="font-bold text-xs uppercase tracking-wide">
                                    {subject}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
                                  Mixed
                                </Badge>
                              )}
                            </div>

                            {!freeAccessActive && (priceLoadError || accessLoadError) ? (
                              <Button className="w-full font-bold" disabled>
                                Access unavailable
                              </Button>
                            ) : freeAccessActive || series.access?.allowed || !series.priceConfig || Number(series.priceConfig.price_inr) === 0 ? (
                              <Button onClick={() => handleStartTest(test.id, series.id)} className="w-full font-bold">
                                Start Test
                              </Button>
                            ) : series.priceConfig.enabled && Number(series.priceConfig.price_inr) > 0 ? (
                              <CheckoutControl
                                productType="test_series"
                                seriesId={series.id}
                                priceInr={series.priceConfig.price_inr}
                              />
                            ) : (
                              <Button className="w-full font-bold" disabled>
                                Not available for purchase
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {priceLoadError && (
              <p role="status" className="mt-4 text-center text-xs text-muted-foreground">
                {freeAccessActive
                  ? 'Test-series prices could not be loaded. Free test access remains available during this offer.'
                  : 'Test-series pricing could not be verified. Test access is temporarily unavailable.'}
              </p>
            )}
            {accessLoadError && !priceLoadError ? (
              <p role="status" className="mt-4 text-center text-xs text-muted-foreground">
                Test-series access could not be verified. Please refresh and try again.
              </p>
            ) : null}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default TestSeriesPage;