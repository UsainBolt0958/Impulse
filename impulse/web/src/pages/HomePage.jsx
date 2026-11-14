import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import StatsCard from '@/components/StatsCard.jsx';
import ActivityCalendar from '@/components/ActivityCalendar.jsx';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { useMarkedQuestions } from '@/hooks/useMarkedQuestions';
import { useMetrics } from '@/hooks/useMetrics';
import { Target, TrendingUp, Flame, BookMarked, Clock, Award, BookOpen } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProStatusBadge from '@/components/ProStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Cell, Tooltip } from 'recharts';

function HomePage() {
  const { proAccess } = useAuth();
  const {
    getUniqueAttemptedCount,
    getTotalAttempts,
    getUniqueSolvedCount,
    getAccuracy,
    getCurrentStreak,
    solvedQuestions,
  } = useSolvedQuestions();
  const { getMarkedCount } = useMarkedQuestions();
  const { periodCounts } = useMetrics();

  const weeklyAttemptData = useMemo(() => {
    const days = [];
    const today = new Date();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const solvedOnDay = new Set();

      solvedQuestions.forEach((entry) => {
        const solvedAt = new Date(entry.timestamp);
        if (entry.question_id && solvedAt >= date && solvedAt < nextDate) {
          solvedOnDay.add(entry.question_id);
        }
      });

      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        attempted: solvedOnDay.size
      });
    }

    return days;
  }, [solvedQuestions]);

  const weeklyChartPalette = ['#0f172a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  const WeeklyTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload;

    return (
      <div className="rounded-2xl border border-border bg-card px-3 py-2 shadow-lg">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.day}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{item.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {item.attempted} unique questions attempted
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - Impulse</title>
        <meta name="description" content="Track your exam preparation progress with Impulse dashboard" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">Dashboard</h1>
              <p className="text-lg text-muted-foreground">Track your progress and performance</p>
              {proAccess?.hasAccess && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ProStatusBadge expiresAt={proAccess.expiresAt} />
                  <p className="text-sm font-semibold text-violet-500">Your Pro benefits are active.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              <StatsCard
                label="Unique Questions Attempted"
                value={getUniqueAttemptedCount()}
                trend="Each question counts once, including reattempts"
                icon={(props) => <ColoredIcon icon={Target} name="target" size={6} {...props} />}
              />
              <StatsCard
                label="Total Attempts"
                value={getTotalAttempts()}
                trend="Includes every reattempt"
                icon={(props) => <ColoredIcon icon={BookOpen} name="bookopen" size={6} {...props} />}
              />
              <StatsCard
                label="Unique Questions Solved"
                value={getUniqueSolvedCount()}
                trend="Answered correctly at least once"
                icon={(props) => <ColoredIcon icon={Award} name="award" size={6} {...props} />}
              />
              <StatsCard
                label="Attempt Accuracy"
                value={`${getAccuracy()}%`}
                icon={(props) => <ColoredIcon icon={TrendingUp} name="trendingup" size={6} {...props} />}
              />
              <StatsCard
                label="Current Streak"
                value={`${getCurrentStreak()} days`}
                icon={(props) => <ColoredIcon icon={Flame} name="flame" size={6} {...props} />}
              />
              <StatsCard
                label="Marked Questions"
                value={getMarkedCount()}
                icon={(props) => <ColoredIcon icon={BookMarked} name="bookmark" size={6} {...props} />}
              />
              <StatsCard
                label="Unique Questions Attempted Today"
                value={periodCounts.daily}
                icon={(props) => <ColoredIcon icon={Clock} name="clock" size={6} {...props} />}
              />
              <StatsCard
                label="Unique Questions Attempted This Week"
                value={periodCounts.weekly}
                icon={(props) => <ColoredIcon icon={Award} name="award" size={6} {...props} />}
              />
            </div>

            <div className="mb-12">
              <div className="mb-4">
                <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Mini Calendar</h2>
                <p className="text-sm text-muted-foreground">Click any date to view the same breakdown popup used in the full calendar.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.35fr)] gap-6 items-start">
                <div className="w-full">
                  <ActivityCalendar compact />
                </div>

                <Card className="w-full border-border bg-card/90 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Questions Attempted This Week</CardTitle>
                    <p className="text-sm text-muted-foreground">Unique questions attempted each day over the last 7 days.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyAttemptData} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <Tooltip content={<WeeklyTooltip />} cursor={{ fill: 'hsl(var(--foreground) / 0.06)' }} />
                          <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }}
                          />
                          <Bar dataKey="attempted" radius={[12, 12, 4, 4]}>
                            {weeklyAttemptData.map((entry, index) => (
                              <Cell
                                key={`${entry.day}-${entry.label}`}
                                fill={weeklyChartPalette[index % weeklyChartPalette.length]}
                                fillOpacity={0.78}
                                stroke="hsl(var(--background))"
                                strokeWidth={1}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link to="/practice">
                <Card className="border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-8 text-center">
                    <ColoredIcon icon={Target} name="target" size={12} className="mx-auto mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Practice</h3>
                    <p className="text-sm text-muted-foreground">Solve previous year questions</p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/tests">
                <Card className="border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-8 text-center">
                    <ColoredIcon icon={Award} name="award" size={12} className="mx-auto mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Tests</h3>
                    <p className="text-sm text-muted-foreground">Take full-length mock tests</p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/analysis">
                <Card className="border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-8 text-center">
                    <ColoredIcon icon={TrendingUp} name="trendingup" size={12} className="mx-auto mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Analysis</h3>
                    <p className="text-sm text-muted-foreground">View detailed performance metrics</p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/previous-papers">
                <Card className="border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-8 text-center">
                    <ColoredIcon icon={BookOpen} name="previous-papers" size={12} className="mx-auto mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Previous Papers</h3>
                    <p className="text-sm text-muted-foreground">Browse past year papers</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default HomePage;