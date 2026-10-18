import { describe, expect, it } from 'vitest';
import { getEarnedProfileBadges } from './profileBadges';

function dailyAttempts(start, count) {
  return Array.from({ length: count }, (_, index) => ({
    question_id: `question-${index}`,
    is_correct: true,
    subject: 'Physics',
    timestamp: new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12).toISOString(),
  }));
}

describe('getEarnedProfileBadges', () => {
  it('only returns medals the user has earned', () => {
    expect(getEarnedProfileBadges([])).toEqual([]);

    const badges = getEarnedProfileBadges(dailyAttempts(new Date(2026, 0, 1), 30));
    expect(badges.map(({ id }) => id)).toEqual(['monthly-streak']);
    expect(badges[0]).toMatchObject({
      name: 'Monthly Momentum',
      description: '30 consecutive days of practice',
      tier: 'silver',
    });
    expect(badges[0].earnedAt).toBe('Jan 30, 2026');
  });

  it('awards streak medals at their all-time thresholds', () => {
    const badges = getEarnedProfileBadges(dailyAttempts(new Date(2025, 0, 1), 365));

    expect(badges.map(({ id }) => id)).toEqual([
      'monthly-streak',
      'quarter-streak',
      'half-year-streak',
      'year-streak',
    ]);
  });

  it('counts unique correct questions, not repeated attempts', () => {
    const repeatedQuestionAttempts = Array.from({ length: 500 }, (_, index) => ({
      question_id: 'same-question',
      is_correct: index > 0,
      subject: 'Physics',
      timestamp: new Date(2026, 0, 1, 0, index).toISOString(),
    }));

    expect(getEarnedProfileBadges(repeatedQuestionAttempts)).toEqual([]);
  });

  it('awards solve medals when their unique-correct-question thresholds are met', () => {
    const attempts = Array.from({ length: 2000 }, (_, index) => ({
      question_id: `question-${index}`,
      is_correct: true,
      subject: 'Physics',
      timestamp: new Date(2026, 0, 1, 0, index).toISOString(),
    }));

    expect(getEarnedProfileBadges(attempts).map(({ id }) => id)).toEqual([
      'five-hundred-solves',
      'two-thousand-solves',
    ]);
  });

  it('awards the all-subject medal only after 100 unique solves in every subject', () => {
    const attempts = ['Biology', 'Chemistry', 'Physics', 'Math'].flatMap((subject, subjectIndex) =>
      Array.from({ length: 100 }, (_, index) => ({
        question_id: `${subject}-${index}`,
        is_correct: true,
        subject,
        timestamp: new Date(2026, 0, 1, 0, subjectIndex * 100 + index).toISOString(),
      })),
    );

    expect(getEarnedProfileBadges(attempts).map(({ id }) => id)).toContain('all-subjects');
  });

  it('uses the loaded question subject when an attempt has no saved subject', () => {
    const attempts = Array.from({ length: 100 }, (_, index) => ({
      question_id: `bio-${index}`,
      is_correct: true,
      timestamp: new Date(2026, 0, 1, 0, index).toISOString(),
    }));
    const questions = attempts.map(({ question_id }) => ({ id: question_id, subject: 'Biology' }));

    expect(getEarnedProfileBadges(attempts, questions)).toEqual([]);
  });
});
