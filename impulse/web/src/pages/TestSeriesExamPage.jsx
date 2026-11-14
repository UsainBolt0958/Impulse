import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ColoredIcon from '@/components/ColoredIcon';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { establishExamSession, loadPublicTestSummary } from '@/lib/portalServer';

export function getUnsubmittedTestSession(testId) {
  const rawSession = window.localStorage.getItem(`test_series_${testId}_sess_v1`);
  if (!rawSession) return null;

  const session = JSON.parse(rawSession);
  if (session?.sub === true) return null;
  if (session?.reviewModeSession === true) return null;
  const containsReviewQuestions = Object.values(session?.data || {}).some((sections) => (
    Object.values(sections || {}).some((questions) => (
      Array.isArray(questions) && questions.some((question) => (
        Object.prototype.hasOwnProperty.call(question || {}, 'reviewResultId')
      ))
    ))
  ));
  if (containsReviewQuestions) return null;
  return session;
}

export function getTestSeriesExamUrl(testId, seriesId, attemptId, paper = 1, resume = false) {
  const returnTo = `/test-series/${encodeURIComponent(seriesId)}/${encodeURIComponent(testId)}`;
  const params = new URLSearchParams({
    testId,
    seriesId,
    paper: String(paper),
    returnTo,
  });
  if (attemptId) params.set('attemptId', attemptId);
  else if (resume) params.set('resume', 'true');
  return `/jee2025/exam/index.html?${params}`;
}

function TestSeriesExamPage() {
  const { seriesId, testId } = useParams();
  const [test, setTest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previousAttempts, setPreviousAttempts] = useState([]);
  const [attemptLoadError, setAttemptLoadError] = useState('');
  const [unsubmittedSession, setUnsubmittedSession] = useState(null);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [launchError, setLaunchError] = useState('');

  const handleLaunchExam = async (event, currentSeriesId, examUrl) => {
    event.preventDefault();
    setLaunchError('');
    try {
      await establishExamSession(currentSeriesId);
      window.location.assign(examUrl);
    } catch (error) {
      console.error('Could not authorize the test session.', error);
      setLaunchError(error.message || 'This test is not available to your account.');
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setTest(null);
    setIsLoading(true);
    setLoadError('');

    loadPublicTestSummary(seriesId, testId)
      .then(({ series: selectedSeries, test: selectedTest }) => {
        if (!isCurrent) return;
        if (selectedSeries.meta?.kind === 'previous-papers' || selectedTest.meta?.kind === 'previous-paper') {
          setLoadError('This test series test is no longer available.');
          return;
        }
        setTest({
          ...selectedTest,
          series: selectedSeries,
          questionCount: Number(selectedTest.questionCount) || 0,
          duration: Number(selectedTest.durationMinutes)
            || Number(selectedSeries.durationMinutes)
            || (Number(selectedTest.durationSec) ? Math.round(Number(selectedTest.durationSec) / 60) : 0),
        });
      })
      .catch((error) => {
        if (!isCurrent) return;
        console.error('Could not load test-series test:', error);
        setLoadError(error.message === 'Test series test not found.'
          ? 'This test series test is no longer available.'
          : 'Could not load this test-series test.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [seriesId, testId]);

  useEffect(() => {
    setPreviousAttempts([]);
    setAttemptLoadError('');
    if (!test) return;

    try {
      const savedHistory = window.localStorage.getItem('test_analytics_history');
      if (!savedHistory) return;
      const history = JSON.parse(savedHistory);
      if (!Array.isArray(history?.attempts)) {
        throw new Error('Saved attempt history has an invalid format.');
      }

      setPreviousAttempts(history.attempts
        .filter((attempt) => (
          Boolean(attempt.attemptId)
          && attempt.testId === test.id
          && attempt.seriesId === test.seriesId
          && (attempt.rawPaper1 || attempt.paper1)
        ))
        .sort((left, right) => (
          String(right.timestamp || '').localeCompare(String(left.timestamp || ''))
        )));
    } catch (error) {
      console.error('Could not load test-series attempts:', error);
      setAttemptLoadError('Could not load previous attempts from this browser.');
    }
  }, [test]);

  useEffect(() => {
    if (!test) {
      setUnsubmittedSession(null);
      setSessionLoadError('');
      return;
    }
    setSessionLoadError('');
    try {
      setUnsubmittedSession(getUnsubmittedTestSession(test.id));
    } catch (error) {
      console.error('Could not inspect the saved test session:', error);
      setUnsubmittedSession(null);
      setSessionLoadError('Could not inspect the saved test session in this browser.');
    }
  }, [test]);

  return (
    <>
      <Helmet>
        <title>{test?.title || test?.name || 'Test'} - Test Series</title>
        <meta name="description" content="Test details and previous attempts" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-6 sm:py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                  {test?.title || test?.name || 'Test'}
                </h1>
                <p className="text-sm text-muted-foreground">Review your previous attempts or start this test.</p>
              </div>
              <Link
                to="/test-series"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/10"
                aria-label="Back to test series"
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>

            {isLoading ? (
              <p className="py-4 text-sm text-muted-foreground">Loading test...</p>
            ) : loadError ? (
              <p role="alert" className="py-4 text-sm text-destructive">{loadError}</p>
            ) : test ? (
              <div className="space-y-5">
                <Card className="w-full border-border overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-3 text-xl font-black uppercase tracking-tight">
                      <ColoredIcon icon={BookOpen} name="test-series" size={7} />
                      <span>{test.title || test.name || 'Untitled Test'}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-5 text-sm text-muted-foreground">
                    {test.questionCount} questions · {test.duration} minutes
                  </CardContent>
                </Card>

                <a
                  href={sessionLoadError
                    ? undefined
                    : getTestSeriesExamUrl(
                        test.id,
                        test.seriesId,
                        undefined,
                        unsubmittedSession?.paper === 2 ? 2 : 1,
                        Boolean(unsubmittedSession)
                      )}
                  onClick={sessionLoadError ? (event) => event.preventDefault() : (event) => handleLaunchExam(
                    event,
                    test.seriesId,
                    getTestSeriesExamUrl(
                      test.id,
                      test.seriesId,
                      undefined,
                      unsubmittedSession?.paper === 2 ? 2 : 1,
                      Boolean(unsubmittedSession)
                    )
                  )}
                  aria-disabled={Boolean(sessionLoadError)}
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground no-underline"
                >
                  {sessionLoadError
                    ? 'Test session unavailable'
                    : unsubmittedSession
                    ? 'Resume Test'
                    : previousAttempts.length
                      ? 'Start a new attempt'
                      : 'Start this test'}
                </a>
                {sessionLoadError ? <p role="alert" className="text-sm text-destructive">{sessionLoadError}</p> : null}
                {launchError ? <p role="alert" className="text-sm text-destructive">{launchError}</p> : null}

                <section className="space-y-3" aria-labelledby="test-series-attempts-heading">
                  <h2 id="test-series-attempts-heading" className="text-lg font-black uppercase tracking-tight">
                    Previous attempts
                  </h2>
                  {attemptLoadError ? (
                    <p role="alert" className="text-sm text-destructive">{attemptLoadError}</p>
                  ) : previousAttempts.length ? (
                    <div className="space-y-2">
                      {previousAttempts.map((attempt, index) => {
                        const score = attempt.paper1?.subjects?.total ?? attempt.rawPaper1?.total;
                        const date = attempt.timestamp ? new Date(attempt.timestamp) : null;
                        const dateLabel = date && !Number.isNaN(date.getTime())
                          ? date.toLocaleString()
                          : `Attempt ${previousAttempts.length - index}`;
                        return (
                          <div
                            key={attempt.attemptId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                          >
                            <div className="text-sm">
                              <p className="font-semibold">{dateLabel}</p>
                              <p className="text-muted-foreground">
                                {score == null ? 'Score unavailable' : `Score: ${score}`}
                              </p>
                            </div>
                            <a
                              href={getTestSeriesExamUrl(test.id, test.seriesId, attempt.attemptId)}
                              onClick={(event) => handleLaunchExam(
                                event,
                                test.seriesId,
                                getTestSeriesExamUrl(test.id, test.seriesId, attempt.attemptId)
                              )}
                              className="text-sm font-bold text-primary underline underline-offset-4"
                            >
                              Review attempt
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No previous attempts for this test in this browser.</p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default TestSeriesExamPage;
