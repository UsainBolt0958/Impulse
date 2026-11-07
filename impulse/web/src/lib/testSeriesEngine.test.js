import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateScore, initTestSeriesEngine } from './testSeriesEngine';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  describe('initTestSeriesEngine', () => {
    it('loads series, test metadata, and template through one authorized request', async () => {
      const series = { id: 'series-1', title: 'Series' };
      const test = {
        id: 'test-1',
        seriesId: 'series-1',
        sections: [{ subject: 'Physics', sectionName: 'A', questions: [{ id: 'q1' }] }],
      };
      const fetchMock = vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ series, test }),
        { status: 200 }
      ));
      vi.stubGlobal('fetch', fetchMock);

      await expect(initTestSeriesEngine('test-1', 'series-1')).resolves.toMatchObject({
        series,
        test,
        template: test,
        config: {
          testId: 'test-1',
          seriesId: 'series-1',
          sections: { A: [1, undefined, undefined, undefined] },
        },
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toContain('/api/test-launch?testId=test-1&seriesId=series-1');
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
