import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Target } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import { toast } from 'sonner';
import { loadPublicSeries, loadTests } from '@/lib/portalServer';

function TestSeriesPage() {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSeries = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [series, tests] = await Promise.all([loadPublicSeries(), loadTests()]);
        const publishedSeries = series
          .filter(s => s.published && s.meta?.kind !== 'previous-papers') // Previous papers have their own library.
          .map((item) => ({
            ...item,
            tests: tests
              .filter((test) => test.seriesId === item.id && test.published) // Only published tests
              .map((test) => {
                const durationMinutes = Number(test.durationMinutes) || Number(item.durationMinutes) || (Number(test.durationSec) ? Math.round(Number(test.durationSec) / 60) : 0);
                return {
                  ...test,
                  questions: (test.sections || []).reduce((count, section) => count + ((section.questions || []).length), 0),
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
  }, []);

  const handleStartTest = (testId, seriesId) => {
    const examUrl = `/jee2025/exam/index.html?testId=${encodeURIComponent(testId)}&seriesId=${encodeURIComponent(seriesId)}&paper=1`;
    window.location.href = examUrl;
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

                            <Button onClick={() => handleStartTest(test.id, series.id)} className="w-full font-bold">
                              Start Test
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default TestSeriesPage;