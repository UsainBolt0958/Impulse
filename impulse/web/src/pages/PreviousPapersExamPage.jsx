import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ColoredIcon from '@/components/ColoredIcon';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { establishExamSession, loadPublicTestCatalog } from '@/lib/portalServer';

function titleCase(value = '') {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PreviousPapersExamPage() {
  const { examKey, paperId, year } = useParams();
  const examTitle = titleCase(examKey);
  const [importedPapers, setImportedPapers] = useState([]);
  const [previousAttempts, setPreviousAttempts] = useState([]);
  const [attemptLoadError, setAttemptLoadError] = useState('');
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [importLoadError, setImportLoadError] = useState('');
  const [launchError, setLaunchError] = useState('');

  const launchPaper = async (event, paper, examUrl) => {
    event.preventDefault();
    setLaunchError('');
    try {
      await establishExamSession(paper.seriesId);
      window.location.assign(examUrl);
    } catch (error) {
      console.error('Could not authorize the previous-paper session.', error);
      setLaunchError(error.message || 'This paper is not available to your account.');
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setImportedPapers([]);
    setIsLoadingImports(true);
    setImportLoadError('');
    loadPublicTestCatalog({ kind: 'previous-papers', examKey })
      .then(({ series, tests }) => {
        if (!isCurrent) return;
        const paperSeries = new Map(series
          .filter((item) => (
            item.meta?.kind === 'previous-papers'
            && item.meta?.examKey === examKey
          ))
          .map((item) => [item.id, item]));
        const papers = tests
          .filter((test) => (
            test.published
            && test.meta?.kind === 'previous-paper'
            && test.meta?.examKey === examKey
            && paperSeries.has(test.seriesId)
          ))
          .map((test) => ({
            ...test,
            series: paperSeries.get(test.seriesId),
            questionCount: Number(test.questionCount) || 0,
          }))
          .sort((left, right) => (
            Number(right.meta.year) - Number(left.meta.year)
            || String(left.meta.shiftName).localeCompare(String(right.meta.shiftName))
          ));
        setImportedPapers(papers);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setImportLoadError(error.message || 'Could not load imported papers.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingImports(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [examKey]);

  const usesYearPages = ['jee-mains', 'neet', 'mht-cet', 'comedk'].includes(examKey);
  const visiblePapers = paperId
    ? importedPapers.filter((paper) => paper.id === paperId)
    : year
      ? importedPapers.filter((paper) => String(paper.meta.year) === year)
      : usesYearPages
        ? []
        : importedPapers;
  const paperListPath = (selectedYear) => (
    usesYearPages
      ? `/previous-papers/${examKey}/year/${encodeURIComponent(selectedYear)}`
      : `/previous-papers/${examKey}`
  );
  const yearGroups = usesYearPages && !paperId && !year
    ? Array.from(importedPapers.reduce((groups, paper) => {
        const key = String(paper.meta.year || 'Unknown year');
        groups.set(key, (groups.get(key) || 0) + 1);
        return groups;
      }, new Map()).entries())
      .sort(([left], [right]) => Number(right) - Number(left))
    : [];

  useEffect(() => {
    setPreviousAttempts([]);
    setAttemptLoadError('');
    if (!paperId) return;

    const paper = importedPapers.find((item) => item.id === paperId);
    if (!paper) return;

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
          && attempt.testId === paper.id
          && attempt.seriesId === paper.seriesId
          && (attempt.rawPaper1 || attempt.paper1)
        ))
        .sort((left, right) => (
          String(right.timestamp || '').localeCompare(String(left.timestamp || ''))
        )));
    } catch (error) {
      console.error('Could not load previous paper attempts:', error);
      setAttemptLoadError('Could not load previous attempts from this browser.');
    }
  }, [paperId, importedPapers]);

  const yearCards = !paperId && !year && examKey === 'jee-advanced'
    ? [
        { year: 2025, href: '/previous-papers/jee-advanced/2025/exam/index.html' },
        { year: 2024, href: '/previous-papers/jee-advanced/2024/index.html' },
        { year: 2023, href: '/previous-papers/jee-advanced/2023/exam/index.html' },
        { year: 2022, href: '/previous-papers/jee-advanced/2022/exam/index.html' },
        { year: 2021, href: '/previous-papers/jee-advanced/2021/exam/index.html' }
      ].map((item) => ({
        ...item,
        label: `${examTitle} ${item.year}`,
        papers: ['Paper 1', 'Paper 2'],
      }))
    : [];
  const startPaper = (paper) => {
    const returnTo = `/previous-papers/${examKey}/${encodeURIComponent(paper.id)}`;
    return `/jee2025/exam/index.html?testId=${encodeURIComponent(paper.id)}&seriesId=${encodeURIComponent(paper.seriesId)}&paper=1&forceNewAttempt=true&returnTo=${encodeURIComponent(returnTo)}`;
  };
  const reviewAttempt = (paper, attempt) => {
    const returnTo = `/previous-papers/${examKey}/${encodeURIComponent(paper.id)}`;
    return `/jee2025/exam/index.html?testId=${encodeURIComponent(paper.id)}&seriesId=${encodeURIComponent(paper.seriesId)}&paper=1&attemptId=${encodeURIComponent(attempt.attemptId)}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <>
      <Helmet>
        <title>{examTitle} - Previous Papers</title>
        <meta name="description" content={`Imported ${examTitle} papers and their individual practice attempts`} />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tight mb-2">{examTitle}</h1>
                <p className="text-sm text-muted-foreground">
                  {paperId
                    ? 'This page is dedicated to this imported paper.'
                    : year
                      ? `Choose a ${examTitle} paper from ${year}.`
                      : usesYearPages
                        ? 'Choose a year to browse its uploaded papers.'
                        : examKey === 'jee-advanced'
                          ? 'Choose an imported paper or browse the available year sets.'
                          : 'Choose one of the imported papers below.'}
                </p>
              </div>

              <Link
                to={paperId
                  ? paperListPath(visiblePapers[0]?.meta.year || '')
                  : year
                    ? `/previous-papers/${examKey}`
                    : '/previous-papers'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/10"
                aria-label={paperId
                  ? `Back to ${visiblePapers[0]?.meta.year || ''} ${examTitle} papers`
                  : year
                    ? `Back to ${examTitle} years`
                    : 'Back to previous papers'}
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>

            <div className="space-y-4">
              {yearGroups.length > 0 ? (
                <section className="space-y-4" aria-labelledby="paper-years-heading">
                  <h2 id="paper-years-heading" className="text-xl font-black uppercase tracking-tight">
                    Papers by year
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {yearGroups.map(([paperYear, paperCount]) => (
                      <Link
                        key={paperYear}
                        to={paperListPath(paperYear)}
                        className="block no-underline"
                      >
                        <Card className="h-full w-full border-border overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                              <ColoredIcon icon={BookOpen} name={examKey} size={7} />
                              <span>{paperYear}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 pb-5 text-sm text-muted-foreground">
                            {paperCount} {paperCount === 1 ? 'paper' : 'papers'}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
              {visiblePapers.length > 0 ? (
                <section className="space-y-4" aria-labelledby="imported-papers-heading">
                  <h2 id="imported-papers-heading" className="text-xl font-black uppercase tracking-tight">
                    {paperId ? 'Paper details' : year ? `${year} papers` : 'Imported papers'}
                  </h2>
                  {visiblePapers.map((paper) => {
                    const paperContent = (
                      <Card className="w-full border-border overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex flex-wrap items-center gap-3 text-xl font-black uppercase tracking-tight">
                            <ColoredIcon icon={BookOpen} name={examKey} size={7} />
                            <span>{paper.meta.year} · {paper.meta.shiftName}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-5 text-sm text-muted-foreground">
                          {paper.questionCount} questions · {paper.durationMinutes || paper.series.durationMinutes || 0} minutes
                        </CardContent>
                      </Card>
                    );
                    return paperId ? (
                      <div key={paper.id} className="space-y-3">
                        {paperContent}
                        <a
                          href={startPaper(paper)}
                          onClick={(event) => launchPaper(event, paper, startPaper(paper))}
                          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground no-underline"
                        >
                          {previousAttempts.length ? 'Start a new attempt' : 'Start this paper'}
                        </a>
                        <section className="space-y-3" aria-labelledby="previous-attempts-heading">
                          <h3 id="previous-attempts-heading" className="text-lg font-black uppercase tracking-tight">
                            Previous attempts
                          </h3>
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
                                      href={reviewAttempt(paper, attempt)}
                                      onClick={(event) => launchPaper(event, paper, reviewAttempt(paper, attempt))}
                                      className="text-sm font-bold text-primary underline underline-offset-4"
                                    >
                                      Review attempt
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No previous attempts for this paper in this browser.</p>
                          )}
                        </section>
                      </div>
                    ) : (
                      <Link
                        key={paper.id}
                        to={`/previous-papers/${examKey}/${encodeURIComponent(paper.id)}`}
                        className="block no-underline"
                      >
                        {paperContent}
                      </Link>
                    );
                  })}
                </section>
              ) : null}
              {paperId && !isLoadingImports && !importLoadError && visiblePapers.length === 0 ? (
                <p role="alert" className="py-4 text-sm text-muted-foreground">This imported paper is no longer available.</p>
              ) : null}
              {!paperId && !year && !isLoadingImports && !importLoadError && importedPapers.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No imported papers are available for this exam yet.</p>
              ) : null}
              {year && !isLoadingImports && !importLoadError && visiblePapers.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No uploaded papers are available for {year}.</p>
              ) : null}
              {isLoadingImports ? (
                <p className="py-4 text-sm text-muted-foreground">Loading imported papers...</p>
              ) : null}
              {importLoadError ? (
                <p role="alert" className="py-4 text-sm text-destructive">{importLoadError}</p>
              ) : null}
              {launchError ? <p role="alert" className="py-4 text-sm text-destructive">{launchError}</p> : null}
              {yearCards.map((item) => {
                const cardBody = (
                  <Card
                    className="w-full border-border overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                        <ColoredIcon icon={BookOpen} name={examKey} size={7} />
                        <span>{item.label}</span>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="pt-0 pb-5">
                      <div className="flex flex-wrap gap-3 text-sm font-semibold text-foreground">
                        {item.papers.map((paper) => (
                          <span key={paper} className="rounded-full border border-border bg-secondary/60 px-3 py-1.5">
                            {paper}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );

                return item.href && item.href !== '#'
                  ? (
                    <a key={item.year} href={item.href} className="block no-underline" target="_self" rel="noreferrer">
                      {cardBody}
                    </a>
                  )
                  : (
                    <div key={item.year}>{cardBody}</div>
                  );
              })}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default PreviousPapersExamPage;
