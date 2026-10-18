const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Math'];

function getSubject(subject) {
  const normalized = String(subject || '').trim().toLowerCase();
  if (normalized === 'math' || normalized === 'mathematics' || normalized === 'maths') return 'Math';
  return SUBJECTS.find((name) => name.toLowerCase() === normalized);
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLongestStreak(dates) {
  let longest = 0;
  let current = 0;
  let previousDay = null;

  dates.forEach((date) => {
    const calendarDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    current = previousDay !== null && calendarDay === previousDay + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDay = calendarDay;
  });

  return longest;
}

function getStreakAchievementDate(dates, target) {
  let streak = 0;
  let previousDay = null;

  for (const date of dates) {
    const calendarDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    streak = previousDay !== null && calendarDay === previousDay + 1 ? streak + 1 : 1;
    if (streak === target) return date;
    previousDay = calendarDay;
  }

  return null;
}

function getSolveAchievementDate(attempts, questionById, target, subject) {
  const solved = new Set();
  for (const attempt of attempts) {
    if (!attempt.is_correct || !attempt.question_id) continue;
    const attemptSubject = getSubject(attempt.subject || questionById.get(attempt.question_id)?.subject);
    if (subject && attemptSubject !== subject) continue;
    solved.add(attempt.question_id);
    if (solved.size >= target) return new Date(attempt.timestamp);
  }
  return null;
}

function makeBadge(id, name, description, tier, earnedAt, icon) {
  if (!earnedAt) return null;
  return {
    id,
    name,
    description,
    tier,
    earnedAt: earnedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    icon,
  };
}

export function getEarnedProfileBadges(solvedQuestions, questions = []) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const orderedAttempts = solvedQuestions
    .map((attempt, index) => ({ ...attempt, index, date: new Date(attempt.timestamp) }))
    .filter(({ date }) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.date - right.date || left.index - right.index);
  const activeDates = new Map();
  orderedAttempts.forEach(({ date }) => activeDates.set(localDateKey(date), new Date(date.getFullYear(), date.getMonth(), date.getDate())));
  const dates = [...activeDates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, date]) => date);
  const longestStreak = getLongestStreak(dates);
  const solvedBySubject = new Map(SUBJECTS.map((subject) => [subject, new Set()]));

  orderedAttempts.forEach((attempt) => {
    if (!attempt.is_correct || !attempt.question_id) return;
    const subject = getSubject(attempt.subject || questionById.get(attempt.question_id)?.subject);
    if (subject) solvedBySubject.get(subject).add(attempt.question_id);
  });

  const allSubjectsDate = SUBJECTS.map((subject) => getSolveAchievementDate(orderedAttempts, questionById, 100, subject));
  const earnedAllSubjectsDate = allSubjectsDate.every(Boolean)
    ? new Date(Math.max(...allSubjectsDate.map((date) => date.getTime())))
    : null;

  return [
    makeBadge('monthly-streak', 'Monthly Momentum', '30 consecutive days of practice', 'silver', longestStreak >= 30 ? getStreakAchievementDate(dates, 30) : null, 'Flame'),
    makeBadge('quarter-streak', 'Unstoppable', '90 consecutive days of practice', 'gold', longestStreak >= 90 ? getStreakAchievementDate(dates, 90) : null, 'Zap'),
    makeBadge('half-year-streak', 'Iron Discipline', '180 consecutive days of practice', 'platinum', longestStreak >= 180 ? getStreakAchievementDate(dates, 180) : null, 'ShieldCheck'),
    makeBadge('year-streak', 'Year of Focus', '365 consecutive days of practice', 'legendary', longestStreak >= 365 ? getStreakAchievementDate(dates, 365) : null, 'Crown'),
    makeBadge('five-hundred-solves', 'Dedicated Solver', '500 unique questions solved', 'silver', getSolveAchievementDate(orderedAttempts, questionById, 500), 'Target'),
    makeBadge('two-thousand-solves', 'Master Solver', '2,000 unique questions solved', 'gold', getSolveAchievementDate(orderedAttempts, questionById, 2000), 'Trophy'),
    makeBadge('all-subjects', 'Complete Scholar', '100 unique questions solved in every subject', 'legendary', earnedAllSubjectsDate, 'Sparkles'),
  ].filter(Boolean);
}
