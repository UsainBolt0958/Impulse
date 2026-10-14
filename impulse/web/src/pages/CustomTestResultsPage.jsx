import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import RichText from '@/components/RichText.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  Layers3,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { CUSTOM_TEST_RESULTS_KEY } from '@/lib/customTest';

const PIE_COLORS = ['#10b981', '#f59e0b', '#cbd5e1'];

function readResults() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CUSTOM_TEST_RESULTS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error('Could not read custom test results', error);
    return [];
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remaining = Math.max(0, seconds) % 60;
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

function buildBreakdown(results, key) {
  const grouped = new Map();
  results.forEach((result) => {
    const label = result[key] || 'Unspecified';
    const current = grouped.get(label) || {
      name: label,
      total: 0,
      attempted: 0,
      correct: 0,
      score: 0,
      time: 0,
    };
    current.total += 1;
    current.time += result.timeSpent || 0;
    current.score += result.marks || 0;
    if (result.hasAnswer) {
      current.attempted += 1;
      if (result.isCorrect) current.correct += 1;
    }
    grouped.set(label, current);
  });

  return [...grouped.values()].map((item) => ({
    ...item,
    accuracy: item.attempted ? Number(((item.correct / item.attempted) * 100).toFixed(1)) : 0,
    averageTime: item.total ? Number((item.time / item.total).toFixed(1)) : 0,
  }));
}

function CustomTestResultsPage() {
  const { resultId } = useParams();
  const [section, setSection] = React.useState('overview');
  const results = useMemo(() => readResults(), []);
  const result = results.find((item) => item.id === decodeURIComponent(resultId || ''));
  const subjectBreakdown = useMemo(
    () => buildBreakdown(result?.questionResults || [], 'subject'),
    [result],
  );
  const difficultyBreakdown = useMemo(
    () => buildBreakdown(result?.questionResults || [], 'difficulty'),
    [result],
  );
  const attemptsData = result ? [
    { name: 'Correct', value: result.correctCount },
    { name: 'Wrong', value: result.wrongCount },
    { name: 'Unattempted', value: result.unattemptedCount },
  ] : [];
  const scoreProgress = result?.maxScore > 0
    ? Math.min(100, Math.max(0, (result.score / result.maxScore) * 100))
    : 0;

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">Scorecard not found</h1>
          <p className="mt-3 text-muted-foreground">This result may have been cleared from this browser.</p>
          <Button asChild className="mt-6 rounded-xl font-black uppercase tracking-wide">
            <Link to="/custom-test">Build another test</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Custom Test Scorecard - Impulse</title>
        <meta name="description" content="Detailed analysis of your custom PYQ test." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full font-black uppercase">{result.exam}</Badge>
                <Badge variant="outline" className="rounded-full">{result.difficulty}</Badge>
                <Badge variant="outline" className="rounded-full">{new Date(result.submittedAt).toLocaleString()}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Back to custom test history">
                  <Link to="/custom-test">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Test scorecard</h1>
              </div>
              <p className="mt-2 text-muted-foreground">Question-by-question feedback and performance analysis.</p>
            </div>
            <Button asChild className="rounded-xl font-black uppercase tracking-wide">
              <Link to="/custom-test">Build another test</Link>
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-24 lg:h-fit lg:flex-col" aria-label="Test analysis sections">
              {[
                { id: 'overview', label: 'Overview', icon: Target },
                { id: 'time', label: 'Time', icon: Clock3 },
                { id: 'responses', label: 'Responses', icon: CheckCircle2 },
                { id: 'subjects', label: 'Subjects', icon: BookOpen },
                { id: 'chapters', label: 'Chapters', icon: Layers3 },
                { id: 'difficulty', label: 'Difficulty', icon: Gauge },
                { id: 'questions', label: 'Questions', icon: ClipboardList },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={section === item.id}
                    onClick={() => setSection(item.id)}
                    className={`flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-black uppercase tracking-widest transition-colors lg:w-full ${section === item.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 space-y-6">
              {section === 'overview' && (
                <section className="space-y-7 rounded-[2rem] border border-border bg-gradient-to-b from-secondary/40 to-background px-5 py-8 text-center sm:px-8 sm:py-10" aria-label="Your test score">
                  <div
                    role="img"
                    aria-label={`Your score is ${result.score} out of ${result.maxScore}`}
                    className="mx-auto flex h-56 w-56 items-center justify-center rounded-full p-3 shadow-lg sm:h-64 sm:w-64"
                    style={{
                      background: `conic-gradient(hsl(var(--primary)) ${scoreProgress}%, hsl(var(--border)) ${scoreProgress}% 100%)`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-border bg-background shadow-inner">
                      <span className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">Your score</span>
                      <span className="mt-2 text-6xl font-black leading-none tabular-nums tracking-tight sm:text-7xl">{result.score}</span>
                      <span className="mt-2 text-sm font-bold text-muted-foreground">out of {result.maxScore}</span>
                    </div>
                  </div>

                  <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="rounded-2xl bg-background/90 text-left">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-black uppercase tracking-widest">Accuracy</span><Target className="h-4 w-4" /></div>
                        <div className="mt-2 text-2xl font-black tabular-nums">{result.accuracy}%</div>
                        <div className="mt-1 text-xs text-muted-foreground">{result.correctCount} correct from {result.attemptedCount} attempted</div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl bg-background/90 text-left">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-black uppercase tracking-widest">Efficiency</span><TrendingUp className="h-4 w-4" /></div>
                        <div className="mt-2 text-2xl font-black tabular-nums">{result.efficiency}%</div>
                        <div className="mt-1 text-xs text-muted-foreground">Of maximum possible marks</div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl bg-background/90 text-left">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-black uppercase tracking-widest">Time used</span><Clock3 className="h-4 w-4" /></div>
                        <div className="mt-2 text-2xl font-black tabular-nums">{formatDuration(result.elapsedSeconds)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{result.averageTimePerQuestion}s average per question</div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl bg-background/90 text-left">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-black uppercase tracking-widest">Marks</span><Award className="h-4 w-4" /></div>
                        <div className="mt-2 text-2xl font-black tabular-nums">{result.positiveMarks} <span className="text-base text-muted-foreground">− {result.negativeMarks}</span></div>
                        <div className="mt-1 text-xs text-muted-foreground">Positive marks − negative marks</div>
                      </CardContent>
                    </Card>
                  </div>
                </section>
              )}

              {section === 'time' && (
                <section className="space-y-5">
                  <Card className="rounded-3xl">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-black uppercase tracking-widest">Time used</span><Clock3 className="h-4 w-4" /></div>
                      <div className="mt-3 text-3xl font-black tabular-nums">{formatDuration(result.elapsedSeconds)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{result.averageTimePerQuestion}s active per question on average</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-3xl">
                    <CardHeader>
                      <CardTitle className="text-base font-black uppercase tracking-wide">Time by question</CardTitle>
                      <p className="text-sm text-muted-foreground">Time spent on every question in this test.</p>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {result.questionResults.map((item) => (
                        <div key={item.questionId} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                          <span className="font-bold">Question {item.index}</span>
                          <span className="font-black tabular-nums">{item.timeSpent}s</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              )}

              {section === 'responses' && (
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-wide">Response breakdown</CardTitle>
                    <p className="text-sm text-muted-foreground">Correct, incorrect, and unanswered.</p>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={attemptsData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={3}>
                          {attemptsData.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '0.75rem',
                            color: 'hsl(var(--popover-foreground))',
                          }}
                          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      {attemptsData.map((item, index) => (
                        <span key={item.name} className="flex items-center gap-1.5">
                          <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} /> {item.name}: {item.value}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {section === 'subjects' && (
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-wide">Subject performance</CardTitle>
                    <p className="text-sm text-muted-foreground">Net marks and accuracy by subject.</p>
                  </CardHeader>
                  <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectBreakdown} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '0.75rem',
                            color: 'hsl(var(--popover-foreground))',
                          }}
                          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        />
                        <Bar dataKey="score" name="Net marks" fill="currentColor" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="accuracy" name="Accuracy %" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {section === 'chapters' && (
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-wide">Chapter analysis</CardTitle>
                    <p className="text-sm text-muted-foreground">Accuracy and correct responses for each selected chapter.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-border">
                      {buildBreakdown(result.questionResults, 'chapter')
                        .sort((left, right) => right.total - left.total)
                        .map((item) => (
                          <div key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 text-sm">
                            <span className="font-bold">{item.name}</span>
                            <span className="text-right font-black tabular-nums">{item.accuracy}% <span className="block text-[10px] font-normal text-muted-foreground">{item.correct}/{item.attempted} correct</span></span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {section === 'difficulty' && (
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-wide">Difficulty analysis</CardTitle>
                    <p className="text-sm text-muted-foreground">Accuracy, question count, and net score by source difficulty.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {difficultyBreakdown.map((item) => (
                      <div key={item.name} className="rounded-2xl border border-border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-black">{item.name}</span>
                          <span className="text-sm font-black">{item.accuracy}% accuracy</span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                          <span>{item.total} questions · {item.attempted} attempted</span>
                          <span>{item.score} marks · {item.averageTime}s avg</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.accuracy}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {section === 'questions' && (
                <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Question analysis</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review your answer, the answer key, marks, and time spent for each question.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {result.correctCount} correct</span>
                <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-destructive" /> {result.wrongCount} wrong</span>
                <span className="flex items-center gap-1.5"><Bookmark className="h-4 w-4 text-amber-600" /> {(result.markedForReview || []).length} reviewed</span>
              </div>
            </div>
            <div className="space-y-3">
              {result.questionResults.map((item) => (
                <Card key={item.questionId} className="rounded-3xl">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full font-black">Q{item.index}</Badge>
                        <Badge variant="outline" className="rounded-full">{item.subject}</Badge>
                        <Badge variant="outline" className="rounded-full">{item.chapter}</Badge>
                        <Badge variant="outline" className="rounded-full">{item.difficulty}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
                        <span className={item.isCorrect ? 'text-emerald-600' : item.hasAnswer ? 'text-destructive' : 'text-muted-foreground'}>
                          {item.isCorrect ? 'Correct' : item.hasAnswer ? 'Incorrect' : 'Unattempted'}
                        </span>
                        <span className="tabular-nums">{item.marks > 0 ? '+' : ''}{item.marks} marks</span>
                        <span className="tabular-nums">{item.timeSpent}s</span>
                      </div>
                    </div>
                    <div className="mt-4 text-sm leading-7"><RichText>{item.question.question_text || item.question.text || 'Question text is unavailable.'}</RichText></div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-secondary/40 p-3 text-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your answer</div>
                        <div className="mt-1 font-bold">{item.hasAnswer ? String(item.answer) : 'Not attempted'}</div>
                      </div>
                      <div className="rounded-2xl bg-emerald-500/10 p-3 text-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Correct answer</div>
                        <div className="mt-1 font-bold">{String(item.correctAnswer)}</div>
                      </div>
                    </div>
                    {item.question.explanation && (
                      <div className="mt-4 rounded-2xl border border-border p-4">
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Explanation</div>
                        <RichText>{item.question.explanation}</RichText>
                      </div>
                    )}
                    {(result.bookmarked || []).includes(item.questionId) && (
                      <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary"><Bookmark className="h-3.5 w-3.5" /> Bookmarked during test</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default CustomTestResultsPage;
