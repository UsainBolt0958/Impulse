import { describe, expect, it } from 'vitest';
import {
  buildRatingHistory,
  buildRatingPeriodHistory,
  calculateRatingChange,
  DIFFICULTY_PENALTY_MULTIPLIER,
  DIFFICULTY_REWARD_MULTIPLIER,
  getRatingLevel,
  INITIAL_RATING,
  MIN_RATING,
  RATING_LEVELS,
  SUBJECT_BASE_POINTS,
} from './impulseRating';

describe('calculateRatingChange', () => {
  it('uses the requested base points and multipliers', () => {
    expect(SUBJECT_BASE_POINTS).toEqual({ Biology: 2, Chemistry: 5, Physics: 10, Math: 20 });
    expect(DIFFICULTY_REWARD_MULTIPLIER).toEqual({ Easy: 1, Medium: 1.5, Hard: 2 });
    expect(DIFFICULTY_PENALTY_MULTIPLIER).toEqual({ Easy: 1.5, Medium: 1, Hard: 0.5 });
  });

  it('awards static points for a correct hard Math question', () => {
    expect(calculateRatingChange(2400, 'Mathematics', 'Hard', true)).toEqual({
      new_rating: 2440,
      points_changed: 40,
      is_correct: true,
    });
  });

  it('scales and rounds an incorrect answer loss', () => {
    expect(calculateRatingChange(1000, 'Chemistry', 'Medium', false)).toEqual({
      new_rating: 992,
      points_changed: -8,
      is_correct: false,
    });
  });

  it('does not reduce rating below the configured floor', () => {
    expect(calculateRatingChange(2, 'Biology', 'Easy', false)).toEqual({
      new_rating: MIN_RATING,
      points_changed: -2,
      is_correct: false,
    });
  });

  it('rejects unsupported subjects, difficulties, and invalid ratings', () => {
    expect(() => calculateRatingChange(1000, 'English', 'Easy', true)).toThrow(RangeError);
    expect(() => calculateRatingChange(1000, 'Math', 'Impossible', true)).toThrow(RangeError);
    expect(() => calculateRatingChange(Number.NaN, 'Math', 'Easy', true)).toThrow(RangeError);
    expect(() => calculateRatingChange(1000.5, 'Math', 'Easy', true)).toThrow(RangeError);
  });
});

describe('getRatingLevel', () => {
  it('assigns the right title and progress at level thresholds', () => {
    expect(getRatingLevel(1000)).toMatchObject({
      level: 1,
      name: 'Impulse Learner',
      next: { name: 'Curious Mind', minRating: 1_400 },
    });
    expect(getRatingLevel(1_400)).toMatchObject({
      level: 2,
      name: 'Curious Mind',
      next: { name: 'Quick Starter', minRating: 3_000 },
      progress: 0,
    });
    expect(getRatingLevel(2_500_000)).toMatchObject({
      level: 18,
      name: 'Impulse Elite',
      next: null,
      progress: 100,
    });
    expect(RATING_LEVELS).toHaveLength(18);
  });

  it('sets level two at two typical days of selected rating gains', () => {
    const typicalDailyGain = 10 * 20;
    const levelTwoThreshold = INITIAL_RATING + typicalDailyGain * 2;

    expect(levelTwoThreshold).toBe(1_400);
    expect(RATING_LEVELS[1].minRating).toBe(levelTwoThreshold);
    expect(getRatingLevel(levelTwoThreshold - 1).level).toBe(1);
    expect(getRatingLevel(levelTwoThreshold).level).toBe(2);
  });

  it('keeps Elite beyond eight months of 200 maximum-point solves per day', () => {
    const eightMonthsOfMaxPoints = INITIAL_RATING + (200 * 40 * 8 * 31);

    expect(eightMonthsOfMaxPoints).toBeLessThan(RATING_LEVELS.at(-1).minRating);
    expect(getRatingLevel(eightMonthsOfMaxPoints).name).toBe('Grandmaster');
  });

  it('rejects invalid rating values', () => {
    expect(() => getRatingLevel(-1)).toThrow(RangeError);
    expect(() => getRatingLevel(Number.NaN)).toThrow(RangeError);
  });
});

describe('buildRatingHistory', () => {
  it('replays dated attempts in order and resolves legacy subject data from questions', () => {
    const result = buildRatingHistory(
      [
        { question_id: 'q2', is_correct: false, timestamp: '2026-06-02T10:00:00.000Z' },
        { question_id: 'q1', is_correct: true, timestamp: '2026-06-01T10:00:00.000Z' },
      ],
      [
        { id: 'q1', subject: 'Physics', difficulty: 'Hard' },
        { id: 'q2', subject: 'Math', difficulty: 'Hard' },
      ],
      new Date(2026, 6, 15),
    );

    expect(result.currentRating).toBe(1005);
    expect(result.yearly).toEqual([
      { timestamp: new Date(2026, 0, 1).getTime(), rating: INITIAL_RATING },
      { timestamp: new Date('2026-06-01T10:00:00.000Z').getTime(), rating: 1020 },
      { timestamp: new Date('2026-06-02T10:00:00.000Z').getTime(), rating: 1005 },
      { timestamp: new Date(2026, 6, 15).getTime(), rating: 1005 },
    ]);
    expect(result.yearly.at(-1).rating).toBe(result.currentRating);
  });

  it('starts a new profile at the configured initial rating', () => {
    const result = buildRatingHistory([], [], new Date(2026, 0, 15));
    expect(result.currentRating).toBe(INITIAL_RATING);
    expect(result.yearly).toEqual([
      { timestamp: new Date(2026, 0, 1).getTime(), rating: INITIAL_RATING },
      { timestamp: new Date(2026, 0, 15).getTime(), rating: INITIAL_RATING },
    ]);
  });

  it('starts this year at the rating earned before January and includes each change this year', () => {
    const result = buildRatingHistory(
      [
        { question_id: 'q1', subject: 'Physics', difficulty: 'Hard', is_correct: true, timestamp: '2025-12-15T10:00:00.000Z' },
        { question_id: 'q2', subject: 'Math', difficulty: 'Hard', is_correct: true, timestamp: '2026-03-12T10:00:00.000Z' },
      ],
      [],
      new Date(2026, 5, 1),
    );

    expect(result.currentRating).toBe(1060);
    expect(result.yearly[0]).toEqual({ timestamp: new Date(2026, 0, 1).getTime(), rating: 1020 });
    expect(result.yearly[1]).toEqual({ timestamp: new Date('2026-03-12T10:00:00.000Z').getTime(), rating: 1060 });
    expect(result.yearly.at(-1)).toEqual({ timestamp: new Date(2026, 5, 1).getTime(), rating: 1060 });
    expect(result.yearly.at(-1).rating).toBe(result.currentRating);
  });

  it('returns each rating change with its time for today view', () => {
    const now = new Date(2026, 9, 17, 14);
    const result = buildRatingPeriodHistory(
      [
        { question_id: 'q1', subject: 'Physics', difficulty: 'Medium', is_correct: true, timestamp: new Date(2026, 9, 17, 9).toISOString() },
        { question_id: 'q2', subject: 'Physics', difficulty: 'Medium', is_correct: false, timestamp: new Date(2026, 9, 17, 11).toISOString() },
      ],
      [],
      'today',
      now,
    );

    expect(result.currentRating).toBe(1000);
    expect(result.history).toEqual([
      { timestamp: new Date(2026, 9, 17, 9).getTime(), rating: 1000 },
      { timestamp: new Date(2026, 9, 17, 9).getTime(), rating: 1015 },
      { timestamp: new Date(2026, 9, 17, 11).getTime(), rating: 1000 },
      { timestamp: now.getTime(), rating: 1000 },
    ]);
    expect(result.chartStart).toEqual(new Date(2026, 9, 17, 9));
  });

  it('uses a flat line for today when there are no rating changes today', () => {
    const now = new Date(2026, 9, 17, 14);
    const result = buildRatingPeriodHistory([], [], 'today', now);

    expect(result.currentRating).toBe(INITIAL_RATING);
    expect(result.chartStart).toEqual(new Date(2026, 9, 17, 0));
    expect(result.history).toEqual([
      { timestamp: new Date(2026, 9, 17, 0).getTime(), rating: INITIAL_RATING },
      { timestamp: now.getTime(), rating: INITIAL_RATING },
    ]);
  });

  it('returns daily closing ratings for this week', () => {
    const now = new Date(2026, 9, 15, 14);
    const result = buildRatingPeriodHistory(
      [
        { question_id: 'q1', subject: 'Physics', difficulty: 'Medium', is_correct: true, timestamp: new Date(2026, 9, 13, 10).toISOString() },
        { question_id: 'q2', subject: 'Physics', difficulty: 'Medium', is_correct: false, timestamp: new Date(2026, 9, 15, 10).toISOString() },
      ],
      [],
      'week',
      now,
    );

    expect(result.currentRating).toBe(1000);
    expect(result.history.map((point) => point.rating)).toEqual([1000, 1000, 1015, 1015, 1000]);
    expect(result.history.at(-1).timestamp).toBe(now.getTime());
  });

  it('rejects unsupported rating graph periods', () => {
    expect(() => buildRatingPeriodHistory([], [], 'month')).toThrow(RangeError);
  });
});
