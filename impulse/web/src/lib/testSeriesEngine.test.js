import { describe, expect, it } from 'vitest';
import { calculateScore } from './testSeriesEngine';

function scoreAnswer(answer, sectionType = 'NUM', correctAnswer = 3) {
  return calculateScore(
    { Physics: { A: { 0: answer } } },
    { Physics: { A: [correctAnswer] } },
    {
      subjects: ['Physics'],
      sections: { A: [1, sectionType, 4, -1] },
    },
  );
}

describe('calculateScore', () => {
  it.each(['3', '3.0', '3.00', '03.00', '+3.000', '3e0'])(
    'accepts numerically equivalent NUM answer %s',
    (answer) => {
      expect(scoreAnswer(answer)).toMatchObject({
        totalScore: 4,
        stats: { correct: 1, wrong: 0, skipped: 0 },
      });
    },
  );

  it('does not treat non-numeric text as a numeric answer', () => {
    expect(scoreAnswer('3abc')).toMatchObject({
      totalScore: -1,
      stats: { correct: 0, wrong: 1, skipped: 0 },
    });
  });

  it('accepts numeric answers when the imported answer key is a string', () => {
    expect(scoreAnswer('03.00', 'NUM', '3')).toMatchObject({
      totalScore: 4,
      stats: { correct: 1, wrong: 0, skipped: 0 },
    });
  });

  it('preserves exact matching for non-numeric sections', () => {
    expect(scoreAnswer('03.00', 'MCQ', '3')).toMatchObject({
      totalScore: -1,
      stats: { correct: 0, wrong: 1, skipped: 0 },
    });
  });
});
