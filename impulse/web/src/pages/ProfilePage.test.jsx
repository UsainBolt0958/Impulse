import { describe, expect, it } from 'vitest';
import { buildDifficultyStats } from './ProfilePage';

describe('buildDifficultyStats', () => {
  it('counts unique attempted and correctly solved questions per difficulty', () => {
    const questionById = new Map([
      ['physics-1', { difficulty: 'Medium' }],
      ['physics-2', { difficulty: 'Medium' }],
      ['physics-3', { difficulty: 'Hard' }],
    ]);
    const attempts = [
      { question_id: 'physics-1', is_correct: true },
      { question_id: 'physics-1', is_correct: false },
      { question_id: 'physics-2', is_correct: false },
      { question_id: 'physics-3', is_correct: false },
    ];

    expect(buildDifficultyStats(attempts, questionById)).toEqual([
      { name: 'Easy', color: 'bg-emerald-500', attempted: 0, solved: 0 },
      { name: 'Medium', color: 'bg-amber-400', attempted: 2, solved: 1 },
      { name: 'Hard', color: 'bg-rose-500', attempted: 1, solved: 0 },
    ]);
  });
});
