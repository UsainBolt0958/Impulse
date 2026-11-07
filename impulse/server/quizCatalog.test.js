import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildQuizCatalog,
  getCachedQuizCatalogIfFresh,
  getCachedQuizCatalog,
  getCachedQuizQuestionsIfFresh,
  getCachedQuizQuestions,
  getOrLoadQuizCatalog,
  getOrLoadQuizQuestions,
  getOrLoadQuizQuestionsForChapter,
  getQuizCatalogCacheVersion,
  getQuizQuestion,
  invalidateQuizCatalogCache,
} from './quizCatalog.js';

const playableQuestion = (overrides = {}) => ({
  subject: 'Physics',
  chapter: 'Mechanics',
  question_text: 'Question',
  options: { A: 'A', B: 'B', C: 'C', D: 'D' },
  correct_answer: 'A',
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  invalidateQuizCatalogCache();
});

describe('quiz catalog helpers', () => {
  it('builds sorted counts from playable questions only', () => {
    expect(buildQuizCatalog([
      playableQuestion({ chapter: 'Waves' }),
      playableQuestion(),
      playableQuestion({ subject: 'Chemistry', chapter: 'Organic' }),
      playableQuestion({ correct_answer: 'E' }),
    ])).toEqual([
      { name: 'Chemistry', chapters: [{ name: 'Organic', questionCount: 1 }] },
      {
        name: 'Physics',
        chapters: [
          { name: 'Mechanics', questionCount: 1 },
          { name: 'Waves', questionCount: 1 },
        ],
      },
    ]);
  });

  it('builds the same catalog from the normalized minimal question projection', () => {
    expect(buildQuizCatalog([{
      subject: 'Physics',
      chapter: 'Mechanics',
      question_text: 'Question',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      correct_answer: 'A',
    }])).toEqual([
      { name: 'Physics', chapters: [{ name: 'Mechanics', questionCount: 1 }] },
    ]);
  });

  it('preserves normalized quiz-question output', () => {
    expect(getQuizQuestion(playableQuestion({
      id: 'question-1',
      question_text: '  Question  ',
      options: {
        A: { text: ' A ', image: 'a.svg' },
        B: 'B',
        C: 'C',
        D: 'D',
      },
    }))).toEqual({
      id: 'question-1',
      question: 'Question',
      image: '',
      options: {
        A: { text: 'A', image: 'a.svg' },
        B: { text: 'B', image: '' },
        C: { text: 'C', image: '' },
        D: { text: 'D', image: '' },
      },
      correctAnswer: 'A',
      explanation: '',
    });
  });

  it('reuses an isolated catalog for 15 seconds and refreshes after expiry', () => {
    vi.useFakeTimers();
    const firstQuestions = [playableQuestion()];
    const firstCatalog = getCachedQuizCatalog(firstQuestions);
    firstCatalog[0].chapters[0].questionCount = 99;

    expect(getCachedQuizCatalogIfFresh()).toEqual([
      { name: 'Physics', chapters: [{ name: 'Mechanics', questionCount: 1 }] },
    ]);
    expect(getCachedQuizCatalog([])).toEqual([
      { name: 'Physics', chapters: [{ name: 'Mechanics', questionCount: 1 }] },
    ]);

    vi.advanceTimersByTime(15_000);
    expect(getCachedQuizCatalogIfFresh()).toBeNull();
    expect(getCachedQuizCatalog([])).toEqual([]);
  });

  it('indexes playable questions by trimmed subject and chapter', () => {
    const questions = [
      playableQuestion({ id: 'physics-1', subject: ' Physics ', chapter: 'Mechanics ' }),
      playableQuestion({ id: 'physics-2', chapter: 'Optics' }),
      playableQuestion({ id: 'chemistry-1', subject: 'Chemistry', chapter: 'Mechanics' }),
      playableQuestion({ id: 'invalid', correct_answer: 'E' }),
    ];

    expect(getCachedQuizQuestions(questions, 'Physics', 'Mechanics').map(({ id }) => id))
      .toEqual(['physics-1']);
    const cachedQuestion = getCachedQuizQuestionsIfFresh('Physics', 'Mechanics');
    cachedQuestion[0].options.A.text = 'changed';
    expect(getCachedQuizQuestionsIfFresh('Physics', 'Mechanics')[0].options.A.text).toBe('A');
    expect(getCachedQuizQuestions([], ' Physics ', 'Mechanics ').map(({ id }) => id))
      .toEqual(['physics-1']);
    expect(getCachedQuizQuestions(questions, 'Physics', 'Missing')).toEqual([]);
  });

  it('expires and invalidates the playable-question index without allowing stale repopulation', () => {
    vi.useFakeTimers();
    const originalQuestions = [playableQuestion({ id: 'old-question' })];
    expect(getCachedQuizQuestions(originalQuestions, 'Physics', 'Mechanics')).toHaveLength(1);
    expect(getCachedQuizQuestions([], 'Physics', 'Mechanics')).toHaveLength(1);

    vi.advanceTimersByTime(15_000);
    expect(getCachedQuizQuestions([], 'Physics', 'Mechanics')).toEqual([]);

    const requestVersion = getQuizCatalogCacheVersion();
    invalidateQuizCatalogCache();
    expect(getCachedQuizQuestions(originalQuestions, 'Physics', 'Mechanics', requestVersion))
      .toHaveLength(1);
    expect(getCachedQuizQuestions([], 'Physics', 'Mechanics')).toEqual([]);
  });

  it('refreshes the catalog after explicit invalidation', () => {
    getCachedQuizCatalog([playableQuestion()]);
    invalidateQuizCatalogCache();

    expect(getCachedQuizCatalog([])).toEqual([]);
  });

  it('does not let a request started before invalidation repopulate the cache', () => {
    const requestVersion = getQuizCatalogCacheVersion();
    invalidateQuizCatalogCache();

    expect(getCachedQuizCatalog([playableQuestion()], requestVersion)).toHaveLength(1);
    expect(getCachedQuizCatalog([])).toEqual([]);
  });

  it('coalesces cold catalog and challenge-index loads', async () => {
    let finishLoad;
    const loadQuestions = vi.fn(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const catalogRequest = getOrLoadQuizCatalog(loadQuestions);
    const questionsRequest = getOrLoadQuizQuestions(loadQuestions, 'Physics', 'Mechanics');

    await Promise.resolve();
    expect(loadQuestions).toHaveBeenCalledOnce();
    finishLoad([playableQuestion({ id: 'physics-1' })]);

    await expect(catalogRequest).resolves.toEqual([
      { name: 'Physics', chapters: [{ name: 'Mechanics', questionCount: 1 }] },
    ]);
    await expect(questionsRequest).resolves.toMatchObject([{ id: 'physics-1' }]);
  });

  it('caches normalized chapter loads independently and coalesces matching requests', async () => {
    let finishPhysicsLoad;
    const loadPhysics = vi.fn(() => new Promise((resolve) => {
      finishPhysicsLoad = resolve;
    }));
    const firstPhysicsRequest = getOrLoadQuizQuestionsForChapter(
      loadPhysics,
      'Physics',
      'Mechanics',
    );
    const duplicatePhysicsRequest = getOrLoadQuizQuestionsForChapter(
      loadPhysics,
      ' Physics ',
      'Mechanics ',
    );

    await Promise.resolve();
    expect(loadPhysics).toHaveBeenCalledOnce();
    finishPhysicsLoad([playableQuestion({ id: 'physics-1' })]);
    await expect(firstPhysicsRequest).resolves.toMatchObject([{ id: 'physics-1' }]);
    await expect(duplicatePhysicsRequest).resolves.toMatchObject([{ id: 'physics-1' }]);

    const loadOptics = vi.fn(async () => [
      playableQuestion({ id: 'physics-optics', chapter: 'Optics' }),
    ]);
    await expect(getOrLoadQuizQuestionsForChapter(loadOptics, 'Physics', 'Optics'))
      .resolves.toMatchObject([{ id: 'physics-optics' }]);
    expect(loadOptics).toHaveBeenCalledOnce();

    await expect(getOrLoadQuizQuestionsForChapter(
      vi.fn(async () => { throw new Error('cache miss'); }),
      'Physics',
      'Mechanics',
    )).resolves.toMatchObject([{ id: 'physics-1' }]);
  });

  it('does not repopulate a normalized chapter cache after invalidation', async () => {
    let finishStaleLoad;
    const requestVersion = getQuizCatalogCacheVersion();
    const staleRequest = getOrLoadQuizQuestionsForChapter(
      () => new Promise((resolve) => { finishStaleLoad = resolve; }),
      'Physics',
      'Mechanics',
      requestVersion,
    );
    await Promise.resolve();

    invalidateQuizCatalogCache();
    finishStaleLoad([playableQuestion({ id: 'stale-question' })]);
    await expect(staleRequest).resolves.toMatchObject([{ id: 'stale-question' }]);

    const reload = vi.fn(async () => [playableQuestion({ id: 'fresh-question' })]);
    await expect(getOrLoadQuizQuestionsForChapter(reload, 'Physics', 'Mechanics'))
      .resolves.toMatchObject([{ id: 'fresh-question' }]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('bounds normalized chapter cache entries and evicts the oldest chapter', async () => {
    const firstLoad = vi.fn(async () => [playableQuestion({ id: 'first-question' })]);
    await getOrLoadQuizQuestionsForChapter(firstLoad, 'Physics', 'Chapter 0');

    for (let index = 1; index <= 100; index += 1) {
      await getOrLoadQuizQuestionsForChapter(
        async () => [playableQuestion({
          id: `question-${index}`,
          chapter: `Chapter ${index}`,
        })],
        'Physics',
        `Chapter ${index}`,
      );
    }

    await getOrLoadQuizQuestionsForChapter(firstLoad, 'Physics', 'Chapter 0');
    expect(firstLoad).toHaveBeenCalledTimes(2);
  });

  it('does not cache a cold index after invalidation', async () => {
    let finishStaleLoad;
    const requestVersion = getQuizCatalogCacheVersion();
    const staleRequest = getOrLoadQuizCatalog(
      () => new Promise((resolve) => { finishStaleLoad = resolve; }),
      requestVersion,
    );
    await Promise.resolve();

    invalidateQuizCatalogCache();
    await expect(getOrLoadQuizCatalog(async () => [
      playableQuestion({ subject: 'Chemistry', chapter: 'Organic' }),
    ])).resolves.toEqual([
      { name: 'Chemistry', chapters: [{ name: 'Organic', questionCount: 1 }] },
    ]);
    finishStaleLoad([playableQuestion()]);
    await staleRequest;

    const loadQuestions = vi.fn(async () => []);
    await expect(getOrLoadQuizCatalog(loadQuestions)).resolves.toEqual([
      { name: 'Chemistry', chapters: [{ name: 'Organic', questionCount: 1 }] },
    ]);
    expect(loadQuestions).not.toHaveBeenCalled();
  });

  it('clears a failed in-flight index load so later requests can retry', async () => {
    const loadQuestions = vi.fn()
      .mockRejectedValueOnce(new Error('temporary read failure'))
      .mockResolvedValueOnce([playableQuestion()]);

    await expect(getOrLoadQuizCatalog(loadQuestions)).rejects.toThrow('temporary read failure');
    await expect(getOrLoadQuizCatalog(loadQuestions)).resolves.toEqual([
      { name: 'Physics', chapters: [{ name: 'Mechanics', questionCount: 1 }] },
    ]);
    expect(loadQuestions).toHaveBeenCalledTimes(2);
  });
});
