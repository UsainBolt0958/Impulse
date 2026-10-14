import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import PerformanceChart from '@/components/PerformanceChart.jsx';
import StatsCard from '@/components/StatsCard.jsx';
import { useMetrics } from '@/hooks/useMetrics';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { useQuestions } from '@/hooks/useQuestions';
import { TrendingUp, Target, Clock, Award, BarChart3, ChevronDown } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PERIOD_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'yearly', label: 'Yearly' },
];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildPeriodSeries(solvedQuestions, period) {
  const now = new Date();
  const today = startOfDay(now);

  if (period === 'daily') {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - index));
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const solved = solvedQuestions.filter((entry) => {
        const solvedAt = new Date(entry.timestamp);
        return solvedAt >= date && solvedAt < nextDate;
      });
      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: new Set(solved.map((entry) => entry.question_id)).size,
      };
    });
  }

  if (period === 'weekly') {
    return Array.from({ length: 8 }, (_, index) => {
      const end = new Date(today);
      end.setDate(end.getDate() - (index * 7));
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const solved = solvedQuestions.filter((entry) => {
        const solvedAt = new Date(entry.timestamp);
        return solvedAt >= start && solvedAt < new Date(end.getTime() + 24 * 60 * 60 * 1000);
      });
      return {
        label: `W${8 - index}`,
        value: new Set(solved.map((entry) => entry.question_id)).size,
      };
    }).reverse();
  }

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today);
    date.setMonth(date.getMonth() - (11 - index));
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const solved = solvedQuestions.filter((entry) => {
      const solvedAt = new Date(entry.timestamp);
      return solvedAt >= monthStart && solvedAt < monthEnd;
    });
    return {
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      value: new Set(solved.map((entry) => entry.question_id)).size,
    };
  });
}

function groupByChapter(solvedQuestions, questions) {
  const totals = new Map();
  solvedQuestions.forEach((entry) => {
    const question = questions.find((item) => item.id === entry.question_id);
    const chapter = question?.chapter || 'Unspecified';
    const current = totals.get(chapter) || { solved: 0, correct: 0, totalTime: 0, attempts: 0 };
    current.attempts += 1;
    current.solved += 1;
    current.totalTime += Number(entry.time_taken) || 0;
    if (entry.is_correct) current.correct += 1;
    totals.set(chapter, current);
  });

  return [...totals.entries()]
    .map(([chapter, data]) => ({
      chapter,
      solved: data.solved,
      accuracy: data.attempts ? Number(((data.correct / data.attempts) * 100).toFixed(1)) : 0,
      avgTime: data.attempts ? Number((data.totalTime / data.attempts).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.solved - left.solved)
    .slice(0, 12);
}

function AnalysisPage() {
  const { periodCounts, difficultyBreakdown, chapterMetrics, subjectMetrics, examMetrics, accuracyTrends } = useMetrics();
  const { getTotalSolved, getAccuracy, solvedQuestions } = useSolvedQuestions();
  const { questions } = useQuestions();
  const [period, setPeriod] = React.useState('daily');

  const periodSeries = React.useMemo(() => buildPeriodSeries(solvedQuestions, period), [solvedQuestions, period]);
  const chapterSnapshot = React.useMemo(() => groupByChapter(solvedQuestions, questions || []), [solvedQuestions, questions]);

  const difficultyData = Object.entries(difficultyBreakdown).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <>
      <Helmet>
        <title>Analysis - Impulse</title>
        <meta name="description" content="Analyze your performance with detailed metrics and insights" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="text-5xl font-black uppercase tracking-tight mb-2">Performance Analysis</h1>
              <p className="text-lg text-muted-foreground">Detailed insights into your preparation</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
              <StatsCard
                label="Total Solved"
                value={getTotalSolved()}
                icon={(props) => <ColoredIcon icon={Target} name="target" size={6} {...props} />}
              />
              <StatsCard
                label="Overall Accuracy"
                value={`${getAccuracy()}%`}
                icon={(props) => <ColoredIcon icon={TrendingUp} name="trendingup" size={6} {...props} />}
              />
              <StatsCard
                label="This Week"
                value={periodCounts.weekly}
                icon={(props) => <ColoredIcon icon={Clock} name="clock" size={6} {...props} />}
              />
              <StatsCard
                label="This Year"
                value={periodCounts.yearly}
                icon={(props) => <ColoredIcon icon={Award} name="award" size={6} {...props} />}
              />
            </div>

            <Card className="mb-8 rounded-3xl border-border/80">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                    <BarChart3 className="h-5 w-5" />
                    User analytics
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Switch between daily, weekly, and yearly stats.</p>
                </div>
                <div className="relative min-w-[220px] rounded-[1.5rem] border border-border/80 bg-gradient-to-b from-background to-secondary/30 px-4 py-3 shadow-sm">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Period</label>
                  <div className="relative">
                    <select
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      className="h-11 w-full appearance-none rounded-2xl border border-border/70 bg-background px-4 pr-11 text-sm font-black uppercase tracking-[0.18em] text-foreground shadow-inner outline-none transition-colors focus:border-foreground"
                    >
                      {PERIOD_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                      <BarChart3 className="h-4 w-4 opacity-0" />
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Current window</p>
                  <p className="mt-1 text-3xl font-black uppercase">{periodCounts[period]}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Solved total</p>
                  <p className="mt-1 text-3xl font-black uppercase">{getTotalSolved()}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Accuracy</p>
                  <p className="mt-1 text-3xl font-black uppercase">{getAccuracy()}%</p>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="space-y-8">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                <TabsTrigger value="overview" className="font-bold uppercase text-xs">Overview</TabsTrigger>
                <TabsTrigger value="chapters" className="font-bold uppercase text-xs">Chapters</TabsTrigger>
                <TabsTrigger value="subjects" className="font-bold uppercase text-xs">Subjects</TabsTrigger>
                <TabsTrigger value="exams" className="font-bold uppercase text-xs">Exams</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <PerformanceChart
                    type="line"
                    data={periodSeries.map((item) => ({ label: item.label, value: item.value }))}
                    title={`Solved Questions (${period.charAt(0).toUpperCase() + period.slice(1)})`}
                    dataKey="value"
                    xKey="label"
                  />
                  <PerformanceChart
                    type="pie"
                    data={difficultyData}
                    title="Difficulty Breakdown"
                    dataKey="value"
                  />
                </div>
              </TabsContent>

              <TabsContent value="chapters" className="space-y-8">
                <PerformanceChart
                  type="bar"
                  data={chapterSnapshot.length ? chapterSnapshot : chapterMetrics}
                  title="Questions Solved by Chapter"
                  dataKey="solved"
                  xKey="chapter"
                />
                <PerformanceChart
                  type="bar"
                  data={chapterSnapshot.length ? chapterSnapshot : chapterMetrics}
                  title="Accuracy by Chapter (%)"
                  dataKey="accuracy"
                  xKey="chapter"
                />
                <PerformanceChart
                  type="bar"
                  data={chapterSnapshot.length ? chapterSnapshot : chapterMetrics}
                  title="Average Time by Chapter (seconds)"
                  dataKey="avgTime"
                  xKey="chapter"
                />
              </TabsContent>

              <TabsContent value="subjects" className="space-y-8">
                <PerformanceChart type="bar" data={subjectMetrics} title="Questions Solved by Subject" dataKey="solved" xKey="subject" />
                <PerformanceChart type="bar" data={subjectMetrics} title="Accuracy by Subject (%)" dataKey="accuracy" xKey="subject" />
                <PerformanceChart type="bar" data={subjectMetrics} title="Average Time by Subject (seconds)" dataKey="avgTime" xKey="subject" />
              </TabsContent>

              <TabsContent value="exams" className="space-y-8">
                <PerformanceChart type="bar" data={examMetrics} title="Questions Solved by Exam" dataKey="solved" xKey="exam" />
                <PerformanceChart type="bar" data={examMetrics} title="Accuracy by Exam (%)" dataKey="accuracy" xKey="exam" />
                <PerformanceChart type="bar" data={examMetrics} title="Average Time by Exam (seconds)" dataKey="avgTime" xKey="exam" />
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default AnalysisPage;