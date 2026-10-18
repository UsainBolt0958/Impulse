import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ColoredIcon from '@/components/ColoredIcon';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { loadPublicSeries, loadTests } from '@/lib/portalServer';

function titleCase(value = '') {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PreviousPapersExamPage() {
  const { examKey } = useParams();
  const examTitle = titleCase(examKey);
  const [importedPapers, setImportedPapers] = useState([]);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [importLoadError, setImportLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setImportedPapers([]);
    setIsLoadingImports(true);
    setImportLoadError('');
    Promise.all([loadPublicSeries(), loadTests()])
      .then(([series, tests]) => {
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
            questionCount: (test.sections || []).reduce(
              (count, section) => count + (section.questions || []).length,
              0
            ),
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

  const yearCards = examKey === 'jee-advanced'
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
    : [2024, 2023, 2022, 2021].map((year) => ({
        year,
        label: `${examTitle} ${year}`,
        papers: ['Paper 1', 'Paper 2'],
        href: '#',
      }));

  return (
    <>
      <Helmet>
        <title>{examTitle} - Previous Papers</title>
        <meta name="description" content={`Year-wise previous papers for ${examTitle}`} />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tight mb-2">{examTitle}</h1>
                <p className="text-sm text-muted-foreground">Choose an imported paper or browse the available year sets.</p>
              </div>

              <Link
                to="/previous-papers"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/10"
                aria-label="Back to previous papers"
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>

            <div className="space-y-4">
              {importedPapers.length > 0 ? (
                <section className="space-y-4" aria-labelledby="imported-papers-heading">
                  <h2 id="imported-papers-heading" className="text-xl font-black uppercase tracking-tight">
                    Imported papers
                  </h2>
                  {importedPapers.map((paper) => (
                    <a
                      key={paper.id}
                      href={`/jee2025/exam/index.html?testId=${encodeURIComponent(paper.id)}&seriesId=${encodeURIComponent(paper.seriesId)}&paper=1`}
                      className="block no-underline"
                    >
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
                    </a>
                  ))}
                </section>
              ) : null}
              {isLoadingImports ? (
                <p className="py-4 text-sm text-muted-foreground">Loading imported papers...</p>
              ) : null}
              {importLoadError ? (
                <p role="alert" className="py-4 text-sm text-destructive">{importLoadError}</p>
              ) : null}
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
