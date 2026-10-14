import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  Award,
  BookOpen,
  Clock3,
  FilePlus2,
  Play,
  Plus,
  Target,
} from 'lucide-react';
import { CUSTOM_TEST_RESULTS_KEY, CUSTOM_TEST_SESSION_KEY } from '@/lib/customTest';

function readStoredValue(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
    return value;
  } catch (error) {
    console.error(`Could not read ${key}`, error);
    return fallback;
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const remaining = Math.max(0, Number(seconds) || 0) % 60;
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

function CustomTestPage() {
  const navigate = useNavigate();
  const history = useMemo(() => readStoredValue(CUSTOM_TEST_RESULTS_KEY, []), []);
  const activeSession = useMemo(() => readStoredValue(CUSTOM_TEST_SESSION_KEY, null), []);
  const results = Array.isArray(history) ? history : [];

  return (
    <>
      <Helmet>
        <title>Custom Tests - Impulse</title>
        <meta name="description" content="Build custom timed tests from previous year questions and review your test history." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Practice your way</p>
                <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Custom Tests</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">Build timed papers from PYQ chapters, then review your scorecards and question-by-question analysis.</p>
              </div>
              <Button onClick={() => navigate('/custom-test/build')} className="h-12 rounded-2xl px-5 font-black uppercase tracking-wide">
                <Plus className="mr-2 h-5 w-5" /> New test
              </Button>
            </div>

            {activeSession?.questions?.length > 0 && (
              <Card className="rounded-3xl border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black uppercase tracking-wide">Unfinished test</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeSession.exam} · {activeSession.questions.length} questions · timer continues while you are away
                    </p>
                  </div>
                  <Button type="button" onClick={() => navigate('/custom-test/exam')} className="rounded-xl font-black uppercase tracking-wide">
                    <Play className="mr-2 h-4 w-4" /> Resume test
                  </Button>
                </CardContent>
              </Card>
            )}

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Test history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Your completed custom tests are saved in this browser.</p>
                </div>
                <Badge variant="outline" className="rounded-full">{results.length} completed</Badge>
              </div>

              {results.length === 0 ? (
                <Card className="rounded-3xl border-dashed">
                  <CardContent className="flex flex-col items-center px-5 py-12 text-center">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"><FilePlus2 className="h-7 w-7" /></span>
                    <h3 className="text-lg font-black uppercase tracking-wide">No tests yet</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">Create a custom paper from your PYQs. Completed tests and their scorecards will appear here.</p>
                    <Button asChild className="mt-5 rounded-xl font-black uppercase tracking-wide">
                      <Link to="/custom-test/build"><Plus className="mr-2 h-4 w-4" /> Build your first test</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {results.map((result) => (
                    <Card key={result.id} className="rounded-3xl transition-all hover:border-foreground/40 hover:shadow-md">
                      <CardContent className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black uppercase tracking-wide">{result.exam}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{new Date(result.submittedAt).toLocaleString()}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">{result.difficulty}</Badge>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-secondary/40 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Award className="h-3 w-3" /> Score</div>
                            <div className="mt-1 text-lg font-black tabular-nums">{result.score}<span className="ml-1 text-xs text-muted-foreground">/ {result.maxScore}</span></div>
                          </div>
                          <div className="rounded-2xl bg-secondary/40 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Target className="h-3 w-3" /> Accuracy</div>
                            <div className="mt-1 text-lg font-black tabular-nums">{result.accuracy}%</div>
                          </div>
                          <div className="rounded-2xl bg-secondary/40 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><BookOpen className="h-3 w-3" /> Questions</div>
                            <div className="mt-1 text-lg font-black tabular-nums">{result.totalQuestions}</div>
                          </div>
                          <div className="rounded-2xl bg-secondary/40 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Clock3 className="h-3 w-3" /> Time</div>
                            <div className="mt-1 text-lg font-black tabular-nums">{formatDuration(result.elapsedSeconds)}</div>
                          </div>
                        </div>
                        <Button asChild variant="outline" className="mt-4 w-full rounded-xl font-black uppercase tracking-wide">
                          <Link to={`/custom-test/results/${encodeURIComponent(result.id)}`}>View scorecard <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default CustomTestPage;
