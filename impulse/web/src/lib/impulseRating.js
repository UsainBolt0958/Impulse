export const SUBJECT_BASE_POINTS = Object.freeze({
  Biology: 2,
  Chemistry: 5,
  Physics: 10,
  Math: 20,
});

export const DIFFICULTY_REWARD_MULTIPLIER = Object.freeze({
  Easy: 1,
  Medium: 1.5,
  Hard: 2,
});

export const DIFFICULTY_PENALTY_MULTIPLIER = Object.freeze({
  Easy: 1.5,
  Medium: 1,
  Hard: 0.5,
});

export const INITIAL_RATING = 1000;
export const MIN_RATING = 0;

export const RATING_LEVELS = Object.freeze([
  Object.freeze({ level: 1, name: 'Impulse Learner', minRating: MIN_RATING }),
  Object.freeze({ level: 2, name: 'Curious Mind', minRating: 1_400 }),
  Object.freeze({ level: 3, name: 'Quick Starter', minRating: 3_000 }),
  Object.freeze({ level: 4, name: 'Steady Starter', minRating: 8_000 }),
  Object.freeze({ level: 5, name: 'Momentum Builder', minRating: 20_000 }),
  Object.freeze({ level: 6, name: 'Consistent Solver', minRating: 45_000 }),
  Object.freeze({ level: 7, name: 'Focused Thinker', minRating: 90_000 }),
  Object.freeze({ level: 8, name: 'Problem Solver', minRating: 160_000 }),
  Object.freeze({ level: 9, name: 'Skilled Solver', minRating: 260_000 }),
  Object.freeze({ level: 10, name: 'Sharp Thinker', minRating: 400_000 }),
  Object.freeze({ level: 11, name: 'Strategist', minRating: 580_000 }),
  Object.freeze({ level: 12, name: 'Expert Solver', minRating: 800_000 }),
  Object.freeze({ level: 13, name: 'Mastermind', minRating: 1_050_000 }),
  Object.freeze({ level: 14, name: 'Elite Contender', minRating: 1_350_000 }),
  Object.freeze({ level: 15, name: 'Grandmaster', minRating: 1_700_000 }),
  Object.freeze({ level: 16, name: 'Legendary Mind', minRating: 2_000_000 }),
  Object.freeze({ level: 17, name: 'Impulse Champion', minRating: 2_250_000 }),
  Object.freeze({ level: 18, name: 'Impulse Elite', minRating: 2_500_000 }),
]);

export function getRatingLevel(rating) {
  if (!Number.isFinite(rating) || rating < MIN_RATING) {
    throw new RangeError(`Rating must be a finite number greater than or equal to ${MIN_RATING}.`);
  }

  let currentIndex = 0;
  RATING_LEVELS.forEach((level, index) => {
    if (rating >= level.minRating) currentIndex = index;
  });

  const current = RATING_LEVELS[currentIndex];
  const next = RATING_LEVELS[currentIndex + 1] || null;
  const progress = next
    ? ((rating - current.minRating) / (next.minRating - current.minRating)) * 100
    : 100;

  return { ...current, next, progress: Math.min(100, Math.max(0, progress)) };
}

function normalizeSubject(subject) {
  const normalized = String(subject || '').trim().toLowerCase();
  if (normalized === 'math' || normalized === 'mathematics' || normalized === 'maths') return 'Math';

  return Object.keys(SUBJECT_BASE_POINTS).find(
    (name) => name.toLowerCase() === normalized,
  );
}

function normalizeDifficulty(difficulty) {
  const normalized = String(difficulty || '').trim().toLowerCase();
  return Object.keys(DIFFICULTY_REWARD_MULTIPLIER).find(
    (name) => name.toLowerCase() === normalized,
  );
}

export function calculateRatingChange(playerRating, subject, difficulty, isCorrect) {
  if (!Number.isInteger(playerRating) || playerRating < MIN_RATING) {
    throw new RangeError(`Player rating must be an integer greater than or equal to ${MIN_RATING}.`);
  }

  const normalizedSubject = normalizeSubject(subject);
  if (!normalizedSubject) {
    throw new RangeError(`Unsupported rating subject: ${subject}`);
  }

  const normalizedDifficulty = normalizeDifficulty(difficulty);
  if (!normalizedDifficulty) {
    throw new RangeError(`Unsupported rating difficulty: ${difficulty}`);
  }

  if (typeof isCorrect !== 'boolean') {
    throw new TypeError('Question correctness must be a boolean.');
  }

  let pointsChanged;
  if (isCorrect) {
    pointsChanged = Math.round(
      SUBJECT_BASE_POINTS[normalizedSubject] * DIFFICULTY_REWARD_MULTIPLIER[normalizedDifficulty],
    );
  } else {
    const ratingScaleFactor = 1 + (playerRating / 2000);
    const baseLoss = SUBJECT_BASE_POINTS[normalizedSubject] * DIFFICULTY_PENALTY_MULTIPLIER[normalizedDifficulty];
    pointsChanged = -Math.round(baseLoss * ratingScaleFactor);
  }

  const newRating = Math.max(MIN_RATING, playerRating + pointsChanged);
  pointsChanged = newRating - playerRating;

  return { new_rating: newRating, points_changed: pointsChanged, is_correct: isCorrect };
}

function getAttemptDetails(attempt, questionById) {
  const question = questionById.get(attempt.question_id);
  return {
    subject: attempt.subject || question?.subject,
    difficulty: attempt.difficulty || question?.difficulty,
  };
}

function getOrderedRatingAttempts(solvedQuestions, questions) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  return solvedQuestions
    .map((attempt, index) => ({
      ...attempt,
      originalIndex: index,
      timestamp: new Date(attempt.timestamp),
    }))
    .filter((attempt) => Number.isFinite(attempt.timestamp.getTime()))
    .sort((left, right) => left.timestamp - right.timestamp || left.originalIndex - right.originalIndex);
}

function applyRatingAttempt(rating, attempt, questionById) {
  const { subject, difficulty } = getAttemptDetails(attempt, questionById);
  if (!subject || !difficulty || typeof attempt.is_correct !== 'boolean') return rating;
  return calculateRatingChange(rating, subject, difficulty, attempt.is_correct).new_rating;
}

export function buildRatingHistory(solvedQuestions, questions = [], now = new Date()) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const attempts = getOrderedRatingAttempts(solvedQuestions, questions);

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getTime() + 1);
  let rating = INITIAL_RATING;
  let ratingAtYearStart = INITIAL_RATING;
  const ratingChanges = [];

  attempts.forEach((attempt) => {
    if (attempt.timestamp >= yearEnd) return;

    const nextRating = applyRatingAttempt(rating, attempt, questionById);
    if (nextRating === rating) return;
    rating = nextRating;
    if (attempt.timestamp < yearStart) {
      ratingAtYearStart = rating;
    } else {
      ratingChanges.push({
        timestamp: attempt.timestamp.getTime(),
        rating,
      });
    }
  });

  const currentRating = rating;
  const yearly = [
    { timestamp: yearStart.getTime(), rating: ratingAtYearStart },
    ...ratingChanges,
  ];
  if (yearEnd.getTime() > yearly[yearly.length - 1].timestamp) {
    yearly.push({ timestamp: now.getTime(), rating: currentRating });
  } else if (yearly[yearly.length - 1].rating !== currentRating) {
    yearly.push({ timestamp: now.getTime(), rating: currentRating });
  }

  return { currentRating, yearly };
}

export function buildRatingPeriodHistory(solvedQuestions, questions = [], period, now = new Date()) {
  if (period !== 'today' && period !== 'week') {
    throw new RangeError(`Unsupported rating history period: ${period}`);
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const attempts = getOrderedRatingAttempts(solvedQuestions, questions)
    .filter((attempt) => attempt.timestamp <= now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }

  let rating = INITIAL_RATING;
  let cursor = 0;
  while (cursor < attempts.length && attempts[cursor].timestamp < start) {
    rating = applyRatingAttempt(rating, attempts[cursor], questionById);
    cursor += 1;
  }

  let chartStart = start;
  const history = [{ timestamp: start.getTime(), rating }];
  if (period === 'today') {
    const todayChanges = [];
    let ratingBeforeFirstChange = rating;
    while (cursor < attempts.length) {
      const attempt = attempts[cursor];
      const nextRating = applyRatingAttempt(rating, attempt, questionById);
      if (nextRating !== rating) {
        if (todayChanges.length === 0) ratingBeforeFirstChange = rating;
        rating = nextRating;
        todayChanges.push({ timestamp: attempt.timestamp.getTime(), rating });
      }
      cursor += 1;
    }

    if (todayChanges.length) {
      chartStart = new Date(todayChanges[0].timestamp);
      chartStart.setMinutes(0, 0, 0);
      history[0] = { timestamp: chartStart.getTime(), rating: ratingBeforeFirstChange };
      history.push(...todayChanges);
    }
  } else {
    for (let day = 0; day < 7; day += 1) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + day);
      const nextDay = new Date(dayStart);
      nextDay.setDate(dayStart.getDate() + 1);

      while (cursor < attempts.length && attempts[cursor].timestamp < nextDay) {
        rating = applyRatingAttempt(rating, attempts[cursor], questionById);
        cursor += 1;
      }
      if (dayStart <= now) {
        history.push({
          timestamp: Math.min(nextDay.getTime(), now.getTime()),
          rating,
        });
      }
    }
  }

  if (history[history.length - 1].timestamp < now.getTime()) {
    history.push({ timestamp: now.getTime(), rating });
  }

  return { currentRating: rating, history, chartStart };
}
