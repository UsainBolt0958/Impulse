import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Cloud,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuestions } from '@/hooks/useQuestions';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { getEarnedProfileBadges } from '@/lib/profileBadges';
import {
  buildRatingHistory,
  buildRatingPeriodHistory,
  calculateRatingChange,
  getRatingLevel,
  INITIAL_RATING,
} from '@/lib/impulseRating';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
  PROFILE_VISIBILITY_UPDATED_EVENT,
  canShowProfileStatCard,
  readProfileVisibility,
  saveProfileVisibility,
} from '@/lib/profileVisibility';

const DIFFICULTIES = [
  { name: 'Easy', color: 'bg-emerald-500' },
  { name: 'Medium', color: 'bg-amber-400' },
  { name: 'Hard', color: 'bg-rose-500' },
];

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Math'];
const MEDAL_ICONS = { Flame, Zap, ShieldCheck, Crown, Target, Trophy, Sparkles };
const SYNCED_DATA_CATEGORIES = [
  'Google sign-in identity plus profile name, photo, and username',
  'Question attempts and the study calendar derived from them',
  'Bookmarked questions and notebook content',
  'Custom-test progress and results',
  'Test-series and previous-paper progress and results',
  'JEE exam sessions, saved recovery checkpoints, and exam analytics',
  'Profile-stat visibility and appearance/reading preferences',
  'Quiz-challenge player name and ID',
  'Friend requests and accepted connections stored in Supabase',
];

function getDifficulty(question) {
  const difficulty = String(question?.difficulty || '').trim().toLowerCase();
  return DIFFICULTIES.find((entry) => entry.name.toLowerCase() === difficulty)?.name;
}

function getSubject(question) {
  const subject = String(question?.subject || '').trim().toLowerCase();
  if (subject === 'math' || subject === 'mathematics' || subject === 'maths') return 'Math';
  return SUBJECTS.find((entry) => entry.toLowerCase() === subject);
}

export function buildDifficultyStats(attempts, questionById) {
  const attemptedByDifficulty = new Map(DIFFICULTIES.map(({ name }) => [name, new Set()]));
  const correctByDifficulty = new Map(DIFFICULTIES.map(({ name }) => [name, new Set()]));

  attempts.forEach((attempt) => {
    if (!attempt.question_id) return;

    const question = questionById.get(attempt.question_id);
    const difficulty = getDifficulty({ difficulty: attempt.difficulty || question?.difficulty });
    if (!difficulty) return;

    attemptedByDifficulty.get(difficulty).add(attempt.question_id);
    if (attempt.is_correct) correctByDifficulty.get(difficulty).add(attempt.question_id);
  });

  return DIFFICULTIES.map(({ name, color }) => ({
    name,
    color,
    attempted: attemptedByDifficulty.get(name).size,
    solved: correctByDifficulty.get(name).size,
  }));
}

function getActivityData(attempts, now) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const rangeStart = new Date(end);
  rangeStart.setDate(rangeStart.getDate() - 364);
  rangeStart.setHours(0, 0, 0, 0);
  const start = new Date(rangeStart);
  start.setDate(start.getDate() - start.getDay());

  const counts = new Map();
  attempts.forEach((attempt) => {
    const date = new Date(attempt.timestamp);
    if (!Number.isFinite(date.getTime()) || date < rangeStart || date > end) return;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const daily = counts.get(key) || { attempts: 0, solved: new Set() };
    daily.attempts += 1;
    if (attempt.is_correct && attempt.question_id) daily.solved.add(attempt.question_id);
    counts.set(key, daily);
  });

  const weeks = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(cursor);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const daily = counts.get(key) || { attempts: 0, solved: new Set() };
      week.push({
        key,
        count: daily.attempts,
        solved: daily.solved.size,
        date,
        inRange: date >= rangeStart && date <= end,
        dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels = [];
  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((day) => day.inRange);
    if (firstDay) {
      const date = firstDay.date;
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      if (!monthLabels.some((item) => item.label === label && item.month === date.getMonth())) {
        monthLabels.push({ label, month: date.getMonth(), weekIndex });
      }
    }
  });

  const activeDays = counts.size;
  let longestStreak = 0;
  let streak = 0;
  const dayCursor = new Date(start);
  while (dayCursor <= end) {
    const key = `${dayCursor.getFullYear()}-${dayCursor.getMonth()}-${dayCursor.getDate()}`;
    if ((counts.get(key)?.attempts || 0) > 0) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return {
    weeks,
    monthLabels,
    activeDays,
    longestStreak,
    attempts: [...counts.values()].reduce((sum, daily) => sum + daily.attempts, 0),
  };
}

function RatingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-muted-foreground">
        {new Date(Number(label)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <p className="mt-1 text-sm font-black text-foreground">{payload[0].value.toLocaleString()} rating</p>
    </div>
  );
}

function activityColor(solved) {
  if (solved <= 0) return 'bg-secondary';
  if (solved < 25) return 'bg-emerald-800';
  if (solved < 50) return 'bg-emerald-700';
  if (solved < 75) return 'bg-emerald-600';
  if (solved < 100) return 'bg-emerald-500';
  return 'bg-emerald-300';
}

function ProfilePage({ profile = null }) {
  const { user, profile: accountProfile, syncStatus, syncError } = useAuth();
  const { solvedQuestions: ownSolvedQuestions } = useSolvedQuestions();
  const { questions: ownQuestions } = useQuestions();
  const solvedQuestions = profile?.solvedQuestions || ownSolvedQuestions;
  const questions = profile?.questions || ownQuestions;
  const now = useMemo(() => new Date(), []);
  const [ratingPeriod, setRatingPeriod] = useState('today');
  const [selectedActivityDay, setSelectedActivityDay] = useState(null);
  const [profileVisibility, setProfileVisibility] = useState(() => readProfileVisibility());
  const isOwnProfile = !profile;
  const visibleStats = profile?.visibleStats || profileVisibility;
  const profileName = profile?.name || accountProfile?.display_name || user?.user_metadata?.full_name || 'You';

  useEffect(() => {
    if (!isOwnProfile) return undefined;
    const refreshVisibility = () => setProfileVisibility(readProfileVisibility());
    window.addEventListener(PROFILE_VISIBILITY_UPDATED_EVENT, refreshVisibility);
    window.addEventListener('storage', refreshVisibility);
    return () => {
      window.removeEventListener(PROFILE_VISIBILITY_UPDATED_EVENT, refreshVisibility);
      window.removeEventListener('storage', refreshVisibility);
    };
  }, [isOwnProfile]);

  const toggleStatVisibility = (statId) => {
    const updated = saveProfileVisibility({
      ...profileVisibility,
      [statId]: !profileVisibility[statId],
    });
    setProfileVisibility(updated);
  };

  const visibilityButton = (sectionId, label) => isOwnProfile && (
    <button
      type="button"
      onClick={() => toggleStatVisibility(sectionId)}
      aria-label={`${profileVisibility[sectionId] ? 'Hide' : 'Show'} ${label} ${profileVisibility[sectionId] ? 'from' : 'to'} friends`}
      aria-pressed={profileVisibility[sectionId]}
      title={`${profileVisibility[sectionId] ? 'Visible' : 'Hidden'} to friends`}
      className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
    >
      {profileVisibility[sectionId]
        ? <Eye className="h-4 w-4" aria-hidden="true" />
        : <EyeOff className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const ratingHistory = useMemo(
    () => buildRatingHistory(solvedQuestions, questions, now),
    [solvedQuestions, questions, now],
  );
  const selectedRatingHistory = useMemo(() => {
    if (ratingPeriod === 'year') {
      return { history: ratingHistory.yearly, currentRating: ratingHistory.currentRating };
    }
    return buildRatingPeriodHistory(solvedQuestions, questions, ratingPeriod, now);
  }, [ratingPeriod, ratingHistory, solvedQuestions, questions, now]);
  const periodRatingChange = selectedRatingHistory.history.length > 0
    ? selectedRatingHistory.history.at(-1).rating - selectedRatingHistory.history[0].rating
    : 0;
  const activity = useMemo(() => getActivityData(solvedQuestions, now), [solvedQuestions, now]);
  const earnedBadges = useMemo(
    () => getEarnedProfileBadges(solvedQuestions, questions),
    [solvedQuestions, questions],
  );

  const profileStats = useMemo(() => {
    const subjectPoints = new Map(SUBJECTS.map((subject) => [subject, 0]));
    let correctAttempts = 0;
    let incorrectAttempts = 0;
    let rating = INITIAL_RATING;
    const orderedAttempts = solvedQuestions
      .map((attempt, index) => ({ attempt, index, date: new Date(attempt.timestamp) }))
      .filter(({ date }) => Number.isFinite(date.getTime()))
      .sort((left, right) => left.date - right.date || left.index - right.index);

    orderedAttempts.forEach(({ attempt }) => {
      const question = questionById.get(attempt.question_id);
      const subject = getSubject({ subject: attempt.subject || question?.subject });
      const difficulty = getDifficulty({ difficulty: attempt.difficulty || question?.difficulty });
      if (attempt.is_correct) {
        correctAttempts += 1;
      } else {
        incorrectAttempts += 1;
      }

      if (!subject || !difficulty || typeof attempt.is_correct !== 'boolean') return;
      const result = calculateRatingChange(rating, subject, difficulty, attempt.is_correct);
      subjectPoints.set(subject, subjectPoints.get(subject) + result.points_changed);
      rating = result.new_rating;
    });

    const solved = new Set(
      solvedQuestions
        .filter((attempt) => attempt.is_correct && attempt.question_id)
        .map((attempt) => attempt.question_id),
    ).size;
    const byDifficulty = buildDifficultyStats(solvedQuestions, questionById);
    const bySubject = SUBJECTS.map((subject) => ({
      subject: subject === 'Math' ? 'Mathematics' : subject,
      points: subjectPoints.get(subject),
    }));

    return { solved, correctAttempts, incorrectAttempts, byDifficulty, bySubject };
  }, [solvedQuestions, questionById]);

  const ratingDelta = ratingHistory.currentRating - INITIAL_RATING;
  const positiveDelta = ratingDelta >= 0;
  const subjectPointMax = Math.max(1, ...profileStats.bySubject.map((item) => Math.abs(item.points)));
  const ratingLevel = getRatingLevel(ratingHistory.currentRating);
  const chartStart = ratingPeriod === 'year'
    ? new Date(now.getFullYear(), 0, 1)
    : selectedRatingHistory.chartStart;
  const chartTicks = ratingPeriod === 'today'
    ? (() => {
      const rangeHours = Math.max(1, Math.ceil((now.getTime() - chartStart.getTime()) / (60 * 60 * 1000)));
      const tickInterval = Math.max(1, Math.ceil(rangeHours / 6));
      return Array.from({ length: Math.floor(rangeHours / tickInterval) + 1 }, (_, index) => {
        const tick = new Date(chartStart);
        tick.setHours(chartStart.getHours() + index * tickInterval, 0, 0, 0);
        return tick.getTime();
      });
    })()
    : ratingPeriod === 'week'
      ? selectedRatingHistory.history.map((point) => point.timestamp)
      : Array.from({ length: now.getMonth() + 1 }, (_, month) => new Date(now.getFullYear(), month, 1).getTime());

  return (
    <>
      <Helmet>
        <title>{profile ? `${profileName} - Impulse` : 'Profile - Impulse'}</title>
        <meta name="description" content={`${profileName}'s Impulse rating, problem-solving history, and yearly activity.`} />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-8 sm:py-12">
          <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
            <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">
                  {isOwnProfile ? 'Your progress, in focus' : `${profileName}'s progress`}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-5xl font-black uppercase tracking-tight">{isOwnProfile ? 'Profile' : profileName}</h1>
                  {(profile?.username || accountProfile?.username) && (
                    <span className="text-base font-semibold text-muted-foreground">
                      @{profile?.username || accountProfile?.username}
                    </span>
                  )}
                </div>
              </div>
              {isOwnProfile ? (
                <Link
                  to="/analysis"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-sm font-bold transition-colors hover:bg-secondary"
                >
                  <BarChart3 className="h-4 w-4" />
                  Full analysis
                </Link>
              ) : (
                <Link
                  to="/friends"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-sm font-bold transition-colors hover:bg-secondary"
                >
                  <UsersRound className="h-4 w-4" />
                  Back to friends
                </Link>
              )}
            </section>

            {isOwnProfile && (
              <Card className="border-border">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Cloud className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <CardTitle>Your data across devices</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {syncStatus === 'synced' && 'Your supported data has finished syncing to your account.'}
                        {syncStatus === 'syncing' && 'Merging this browser’s saved data with your account…'}
                        {syncStatus === 'error' && 'Some data could not sync. Your browser copy is still saved.'}
                        {syncStatus === 'idle' && 'Sign in to sync your study data to your account.'}
                      </p>
                      {syncStatus === 'error' && syncError && (
                        <p role="alert" className="mt-2 text-sm text-destructive">{syncError}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {SYNCED_DATA_CATEGORIES.map((category) => (
                      <li key={category} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{category}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Full-screen exam progress syncs after you return to the main app. Shared question content,
                    admin data, and private quiz-challenge access tokens are intentionally excluded.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.4fr)]">
              <Card className="overflow-hidden border-border">
                <CardContent className="flex h-full min-h-[220px] flex-col justify-between p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center bg-foreground text-xl font-black text-background">
                        {profileName.split(' ').map((part) => part[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                          {profile?.username ? `${profile.username} · ` : ''}Level {ratingLevel.level} · {ratingLevel.name}
                        </p>
                      </div>
                    </div>
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="mt-8 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Impulse rating</p>
                      <p className="mt-1 font-mono text-5xl font-bold tracking-tight">{ratingHistory.currentRating.toLocaleString()}</p>
                    </div>
                    <div className={`mb-1 inline-flex items-center gap-1 text-sm font-bold ${positiveDelta ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {positiveDelta ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {positiveDelta ? '+' : ''}{ratingDelta.toLocaleString()} overall
                    </div>
                  </div>
                  <div className="mt-4">
                    {ratingLevel.next ? (
                      <>
                        <div className="mb-1 flex justify-between gap-3 text-xs text-muted-foreground">
                          <span>Next: {ratingLevel.next.name}</span>
                          <span>{ratingHistory.currentRating.toLocaleString()} / {ratingLevel.next.minRating.toLocaleString()}</span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden bg-secondary"
                          role="progressbar"
                          aria-label={`Progress to ${ratingLevel.next.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(ratingLevel.progress)}
                        >
                          <div className="h-full bg-amber-500" style={{ width: `${ratingLevel.progress}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-amber-500">Maximum level reached</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">
                      {ratingPeriod === 'today' ? 'Rating today' : ratingPeriod === 'week' ? 'Rating this week' : 'Rating this year'}
                    </CardTitle>
                    <span
                      className={`rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${
                        periodRatingChange > 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : periodRatingChange < 0
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'border-border bg-secondary/50 text-muted-foreground'
                      }`}
                      aria-label={`Net rating change ${
                        periodRatingChange > 0 ? 'plus ' : periodRatingChange < 0 ? 'minus ' : ''
                      }${Math.abs(periodRatingChange)} this ${
                        ratingPeriod === 'today' ? 'day' : ratingPeriod
                      }`}
                    >
                      Net {periodRatingChange > 0 ? '+' : ''}{periodRatingChange.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={ratingPeriod} onValueChange={setRatingPeriod}>
                      <SelectTrigger aria-label="Rating graph period" className="w-[130px] bg-background text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This week</SelectItem>
                        <SelectItem value="year">This year</SelectItem>
                      </SelectContent>
                    </Select>
                    <Activity className="hidden h-5 w-5 shrink-0 text-amber-500 sm:block" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="h-[180px] w-full"
                    role="img"
                    aria-label={`${ratingPeriod === 'year' ? 'This year' : ratingPeriod === 'week' ? 'This week' : 'Today'} Impulse rating history, ending at ${selectedRatingHistory.currentRating}`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedRatingHistory.history} margin={{ top: 14, right: 12, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 5" />
                        <XAxis
                          type="number"
                          dataKey="timestamp"
                          scale="time"
                          domain={[chartStart.getTime(), Math.max(now.getTime(), chartStart.getTime() + 60 * 60 * 1000)]}
                          ticks={chartTicks}
                          tickFormatter={(timestamp) => ratingPeriod === 'today'
                            ? new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric' })
                            : new Date(timestamp).toLocaleDateString('en-US', {
                              ...(ratingPeriod === 'week' ? { weekday: 'short' } : { month: 'short' }),
                            })}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        />
                        <YAxis
                          domain={[
                            (dataMin) => Math.max(0, dataMin - 30),
                            (dataMax) => dataMax + 30,
                          ]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        />
                        <Tooltip content={<RatingTooltip />} />
                        <Line
                          type="stepAfter"
                          dataKey="rating"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={{ r: 2, fill: '#f59e0b', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#f59e0b', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {isOwnProfile && (
              <p className="text-xs font-semibold text-muted-foreground">
                Use the eye buttons to choose which stats and sections friends can see.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { id: 'problemsSolved', label: 'Problems solved', value: profileStats.solved, icon: Target, caption: 'Unique questions answered correctly' },
                { id: 'activeDays', label: 'Active days', value: activity.activeDays, icon: CalendarDays, caption: 'This year' },
                { id: 'longestStreak', label: 'Longest streak', value: `${activity.longestStreak} ${activity.longestStreak === 1 ? 'day' : 'days'}`, icon: Flame, caption: 'This year' },
                { id: 'attemptsThisYear', label: 'Attempts this year', value: activity.attempts, icon: BookOpen, caption: `${activity.activeDays} days in the arena` },
              ]
                .filter(({ id }) => canShowProfileStatCard(id, visibleStats, isOwnProfile))
                .map(({ id, label, value, icon: Icon, caption }) => (
                <Card key={id} className="border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-amber-500" />
                        {isOwnProfile && (
                          <button
                            type="button"
                            onClick={() => toggleStatVisibility(id)}
                            aria-label={`${profileVisibility[id] ? 'Hide' : 'Show'} ${label} ${profileVisibility[id] ? 'from' : 'to'} friends`}
                            aria-pressed={profileVisibility[id]}
                            title={`${profileVisibility[id] ? 'Visible' : 'Hidden'} to friends`}
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                          >
                            {profileVisibility[id]
                              ? <Eye className="h-4 w-4" aria-hidden="true" />
                              : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 font-mono text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className={`grid gap-6 ${canShowProfileStatCard('difficultyStats', visibleStats, isOwnProfile) ? 'lg:grid-cols-2' : ''}`}>
              {canShowProfileStatCard('difficultyStats', visibleStats, isOwnProfile) && (
              <Card className="border-border">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Solved by difficulty</CardTitle>
                    {visibilityButton('difficultyStats', 'Solved by difficulty')}
                  </div>
                  <p className="text-sm text-muted-foreground">Unique questions answered correctly / unique questions attempted</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {profileStats.byDifficulty.map(({ name, color, solved, attempted }) => (
                    <div key={name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="font-mono font-bold">{solved.toLocaleString()} <span className="font-sans font-medium text-muted-foreground">/ {attempted.toLocaleString()}</span></span>
                      </div>
                      <div className="h-2 overflow-hidden bg-secondary">
                        <div className={`h-full ${color}`} style={{ width: `${attempted ? (solved / attempted) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                    {profileStats.correctAttempts.toLocaleString()} correct attempts · {profileStats.incorrectAttempts.toLocaleString()} incorrect attempts
                  </p>
                </CardContent>
              </Card>
              )}

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Medal showcase</CardTitle>
                </CardHeader>
                <CardContent>
                  {earnedBadges.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {earnedBadges.map(({ id, name, description, tier, earnedAt, icon }) => {
                        const Icon = MEDAL_ICONS[icon];
                        const tierStyle = {
                          silver: 'border-slate-400/50 bg-slate-400/10 text-slate-500 dark:text-slate-300',
                          gold: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          platinum: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
                          legendary: 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300',
                        }[tier];

                        return (
                          <div key={id} className={`group relative flex min-h-40 flex-col items-center justify-center overflow-hidden border p-4 text-center transition-transform hover:-translate-y-1 ${tierStyle}`}>
                            <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full border border-current opacity-10" />
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-current bg-background/70 shadow-sm">
                              <Icon className="h-6 w-6" strokeWidth={1.8} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wide text-foreground">{name}</p>
                            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
                            <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] opacity-75">Earned {earnedAt}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center border border-dashed border-border bg-secondary/20 px-4 text-center">
                      <Medal className="mb-2 h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-bold">No medals earned yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {canShowProfileStatCard('subjectRating', visibleStats, isOwnProfile) && (
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Rating by subject</CardTitle>
                  {visibilityButton('subjectRating', 'Rating by subject')}
                </div>
                <p className="text-sm text-muted-foreground">Net Impulse rating points earned or lost</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileStats.bySubject.map(({ subject, points }) => (
                  <div key={subject} className="grid grid-cols-[100px_minmax(0,1fr)_72px] items-center gap-3">
                    <span className="text-sm font-semibold">{subject}</span>
                    <div className="h-2 overflow-hidden bg-secondary">
                      <div
                        className={`h-full ${points >= 0 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${(Math.abs(points) / subjectPointMax) * 100}%` }}
                      />
                    </div>
                    <span className={`text-right font-mono text-sm font-bold ${points < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                      {points > 0 ? '+' : ''}{points.toLocaleString()}
                    </span>
                  </div>
                ))}
                <p className="border-t border-border pt-4 text-xs text-muted-foreground">Correct answers add fixed points; incorrect answers use your current rating in the penalty calculation.</p>
              </CardContent>
            </Card>
            )}

            {canShowProfileStatCard('yearlyActivity', visibleStats, isOwnProfile) && (
            <Card className="border-border">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Problem solving this year</CardTitle>
                    {visibilityButton('yearlyActivity', 'Problem solving this year')}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Every square is one day. More green means more questions solved.</p>
                </div>
                <p className="font-mono text-sm font-bold">{activity.attempts.toLocaleString()} <span className="font-sans font-medium text-muted-foreground">attempts</span></p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[760px]">
                    <div className="mb-2 grid gap-[3px] pl-8" style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, minmax(0, 1fr))` }}>
                      {activity.weeks.map((_, index) => {
                        const month = activity.monthLabels.find((item) => item.weekIndex === index);
                        return <span key={index} className="h-4 text-[10px] font-semibold text-muted-foreground">{month?.label || ''}</span>;
                      })}
                    </div>
                    <div className="grid grid-cols-[26px_minmax(0,1fr)] gap-2">
                      <div className="grid grid-rows-7 gap-[3px] text-[9px] text-muted-foreground">
                        <span>Sun</span><span /><span>Tue</span><span /><span>Thu</span><span /><span>Sat</span>
                      </div>
                      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, minmax(0, 1fr))` }}>
                        {activity.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
                            {week.map((day) => (
                              <div
                                key={day.key}
                                role="gridcell"
                                aria-selected={selectedActivityDay?.key === day.key}
                                className={`${day.inRange ? '' : 'invisible'} aspect-square w-full min-w-[9px]`}
                              >
                                <button
                                  type="button"
                                  onClick={() => day.inRange && setSelectedActivityDay(day)}
                                  disabled={!day.inRange}
                                  title={`${day.solved} ${day.solved === 1 ? 'question solved' : 'questions solved'} on ${day.dateLabel}`}
                                  aria-label={`${day.dateLabel}: ${day.solved} ${day.solved === 1 ? 'question solved' : 'questions solved'}, ${day.count} ${day.count === 1 ? 'attempt' : 'attempts'}`}
                                  aria-pressed={selectedActivityDay?.key === day.key}
                                  className={`h-full w-full ${activityColor(day.solved)} transition hover:ring-2 hover:ring-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${selectedActivityDay?.key === day.key ? 'ring-2 ring-foreground' : ''}`}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {selectedActivityDay && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-border bg-secondary/40 px-4 py-3"
                  >
                    <p className="text-sm font-semibold">{selectedActivityDay.dateLabel}</p>
                    <p className="font-mono text-sm font-bold">
                      {selectedActivityDay.count} {selectedActivityDay.count === 1 ? 'question attempted' : 'questions attempted'}
                      <span className="ml-2 font-sans font-medium text-muted-foreground">
                        · {selectedActivityDay.solved} solved correctly
                      </span>
                    </p>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{activity.activeDays} active days · {activity.longestStreak} day longest streak</span>
                  <span className="flex items-center gap-1.5">
                    Less <i className="h-3 w-3 bg-secondary" />
                    {['bg-emerald-800', 'bg-emerald-700', 'bg-emerald-600', 'bg-emerald-500', 'bg-emerald-300'].map((color) => (
                      <i key={color} className={`h-3 w-3 ${color}`} />
                    ))}
                    More
                  </span>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default ProfilePage;
