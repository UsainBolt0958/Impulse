import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCustomTestCatalog,
  buildQuestionCatalog,
  filterAndCacheQuestionPage,
  filterAndPaginateQuestions,
  getCachedCustomTestCatalogIfFresh,
  getCachedQuestionCatalogIfFresh,
  getCachedQuestionMetadataIfFresh,
  getCachedQuestionPage,
  getCachedQuestionCatalog,
  getOrLoadQuestionCatalog,
  getOrLoadCustomTestCatalog,
  getOrLoadQuestionMetadata,
  getOrLoadQuestionPage,
  getOrLoadPrecomputedQuestionPage,
  filterQuestions,
  getQuestionMetadata,
  getQuestionMetadataCacheVersion,
  invalidateQuestionMetadataCache,
  paginateQuestions,
} from './questionQuery.js';

const questions = [
  { id: '1', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Thermodynamics', difficulty: 'Easy', year: 2025 },
  { id: '2', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Thermodynamics', difficulty: 'Medium', year: 2024 },
  { id: '3', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Units and Measurements', difficulty: 'Easy', year: 2025 },
  { id: '4', exam: 'NEET', subject: 'Physics', chapter: 'Thermodynamics', difficulty: 'Easy', year: 2025 },
];

afterEach(() => {
  vi.useRealTimers();
  invalidateQuestionMetadataCache();
});

describe('question query helpers', () => {
  it('filters by exact exam, subject, chapter, difficulty, and year values', () => {
    expect(filterQuestions(questions, {
      exam: ['JEE MAINS'],
      subject: ['Physics'],
      chapter: ['Thermodynamics'],
      difficulty: ['Easy'],
      year: ['2025'],
    })).toEqual([questions[0]]);
  });

  it('preserves multi-value matching and trims values when using indexed filters', () => {
    expect(filterQuestions(questions, {
      exam: [' JEE MAINS ', 'NEET', 'JEE MAINS'],
      subject: [' Physics '],
      chapter: [' Thermodynamics ', 'Units and Measurements'],
      difficulty: ['Easy', ' Medium '],
      year: ['2024', ' 2025 '],
    })).toEqual(questions);
    expect(filterQuestions(questions, {
      exam: [' ', 'MISSING'],
      subject: ['Physics'],
    })).toEqual([]);
  });

  it('builds chapter counts and available years for the selected exam and subject', () => {
    expect(buildQuestionCatalog(questions, 'JEE MAINS', 'Physics')).toEqual([
      { chapter: 'Thermodynamics', count: 2, years: ['2025', '2024'] },
      { chapter: 'Units and Measurements', count: 1, years: ['2025'] },
    ]);
  });

  it('caches chapter catalogs briefly and returns isolated result objects', () => {
    vi.useFakeTimers();
    const first = getCachedQuestionCatalog(questions, 'JEE MAINS', 'Physics');
    first[0].years.push('changed');

    expect(getCachedQuestionCatalogIfFresh('JEE MAINS', 'Physics')).toEqual([
      { chapter: 'Thermodynamics', count: 2, years: ['2025', '2024'] },
      { chapter: 'Units and Measurements', count: 1, years: ['2025'] },
    ]);
    expect(getCachedQuestionCatalog([], 'JEE MAINS', 'Physics')).toEqual([
      { chapter: 'Thermodynamics', count: 2, years: ['2025', '2024'] },
      { chapter: 'Units and Measurements', count: 1, years: ['2025'] },
    ]);

    vi.advanceTimersByTime(15_000);
    expect(getCachedQuestionCatalogIfFresh('JEE MAINS', 'Physics')).toBeNull();
    expect(getCachedQuestionCatalog([], 'JEE MAINS', 'Physics')).toEqual([]);
  });

  it('does not repopulate the chapter catalog cache with data from before a save', () => {
    vi.useFakeTimers();
    const requestVersion = getQuestionMetadataCacheVersion();
    invalidateQuestionMetadataCache();

    expect(getCachedQuestionCatalog(
      questions,
      'JEE MAINS',
      'Physics',
      requestVersion,
    )).toHaveLength(2);
    expect(getCachedQuestionCatalog([], 'JEE MAINS', 'Physics')).toEqual([]);
  });

  it('returns stable pagination metadata', () => {
    expect(paginateQuestions(questions, 2, 2)).toEqual({
      questions: [questions[2], questions[3]],
      total: 4,
      page: 2,
      limit: 2,
      hasMore: false,
    });
  });

  it('filters and paginates in one pass with the same results and totals', () => {
    const filters = {
      exam: ['JEE MAINS', 'NEET'],
      chapter: ['Thermodynamics'],
      year: ['2024', '2025'],
    };

    [1, 2, 3].forEach((page) => {
      expect(filterAndPaginateQuestions(questions, filters, page, 1))
        .toEqual(paginateQuestions(filterQuestions(questions, filters), page, 1));
    });
    expect(filterAndPaginateQuestions(questions, { exam: ['missing'] }, 1, 20))
      .toEqual({
        questions: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });
  });

  it('caches filtered question pages and returns isolated result objects', () => {
    vi.useFakeTimers();
    const filters = {
      exam: ['JEE MAINS'],
      subject: ['Physics'],
      chapter: ['Thermodynamics'],
    };
    const first = filterAndCacheQuestionPage(questions, filters, 1, 1);
    first.questions[0].chapter = 'changed';

    expect(getCachedQuestionPage(filters, 1, 1)).toEqual({
      questions: [questions[0]],
      total: 2,
      page: 1,
      limit: 1,
      hasMore: true,
    });
    expect(getCachedQuestionPage({
      ...filters,
      exam: ['NEET'],
    }, 1, 1)).toBeNull();
    expect(getCachedQuestionPage(filters, 2, 1)).toBeNull();

    vi.advanceTimersByTime(15_000);
    expect(getCachedQuestionPage(filters, 1, 1)).toBeNull();
  });

  it('does not repopulate the question-page cache with data from before a save', () => {
    const filters = { exam: ['JEE MAINS'] };
    const requestVersion = getQuestionMetadataCacheVersion();
    invalidateQuestionMetadataCache();

    filterAndCacheQuestionPage(questions, filters, 1, 1, requestVersion);
    expect(getCachedQuestionPage(filters, 1, 1)).toBeNull();

    expect(filterAndCacheQuestionPage(questions, filters, 1, 1)).toEqual({
      questions: [questions[0]],
      total: 3,
      page: 1,
      limit: 1,
      hasMore: true,
    });
    invalidateQuestionMetadataCache();
    expect(getCachedQuestionPage(filters, 1, 1)).toBeNull();
  });

  it('coalesces concurrent page cache misses and returns isolated results', async () => {
    let finishLoad;
    const loadQuestions = vi.fn(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const filters = { exam: ['JEE MAINS'], subject: ['Physics'] };
    const firstRequest = getOrLoadQuestionPage(filters, 1, 1, loadQuestions);
    const secondRequest = getOrLoadQuestionPage(filters, 1, 1, loadQuestions);

    await Promise.resolve();
    expect(loadQuestions).toHaveBeenCalledOnce();
    finishLoad(questions);

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.questions[0].chapter = 'changed';
    await expect(getOrLoadQuestionPage(filters, 1, 1, loadQuestions)).resolves.toMatchObject({
      questions: [questions[0]],
      total: 3,
      page: 1,
      limit: 1,
      hasMore: true,
    });
    expect(loadQuestions).toHaveBeenCalledOnce();
  });

  it('coalesces and caches precomputed pages from an indexed store', async () => {
    let finishLoad;
    const loadPage = vi.fn(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const filters = { exam: ['JEE MAINS'], subject: ['Physics'] };
    const firstRequest = getOrLoadPrecomputedQuestionPage(filters, 1, 1, loadPage);
    const secondRequest = getOrLoadPrecomputedQuestionPage(filters, 1, 1, loadPage);

    await Promise.resolve();
    expect(loadPage).toHaveBeenCalledOnce();
    finishLoad({
      questions: [questions[0]],
      total: 3,
      page: 1,
      limit: 1,
      hasMore: true,
    });

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    await expect(getOrLoadPrecomputedQuestionPage(filters, 1, 1, loadPage))
      .resolves.toEqual(first);
    expect(loadPage).toHaveBeenCalledOnce();
  });

  it('does not cache a stale in-flight page after invalidation', async () => {
    let finishStaleLoad;
    const filters = { exam: ['JEE MAINS'] };
    const staleRequest = getOrLoadQuestionPage(
      filters,
      1,
      1,
      () => new Promise((resolve) => { finishStaleLoad = resolve; }),
    );
    await Promise.resolve();

    invalidateQuestionMetadataCache();
    await expect(getOrLoadQuestionPage(filters, 1, 1, async () => questions))
      .resolves.toMatchObject({ total: 3 });
    finishStaleLoad([questions[3]]);
    await staleRequest;

    const loadQuestions = vi.fn(async () => []);
    await expect(getOrLoadQuestionPage(filters, 1, 1, loadQuestions))
      .resolves.toMatchObject({ total: 3 });
    expect(loadQuestions).not.toHaveBeenCalled();
  });

  it('clears failed in-flight page loads so later requests can retry', async () => {
    const filters = { exam: ['JEE MAINS'] };
    const loadQuestions = vi.fn()
      .mockRejectedValueOnce(new Error('temporary state read failure'))
      .mockResolvedValueOnce(questions);

    await expect(getOrLoadQuestionPage(filters, 1, 1, loadQuestions))
      .rejects.toThrow('temporary state read failure');
    await expect(getOrLoadQuestionPage(filters, 1, 1, loadQuestions))
      .resolves.toMatchObject({ total: 3 });
    expect(loadQuestions).toHaveBeenCalledTimes(2);
  });

  it('returns only requested question classification fields', () => {
    expect(getQuestionMetadata(questions, ['2'])).toEqual([{
      id: '2',
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      difficulty: 'Medium',
    }]);
  });

  it('reuses an indexed metadata lookup and preserves question-bank order', () => {
    vi.useFakeTimers();
    const first = getQuestionMetadata(questions, ['4', '2']);

    expect(first.map((question) => question.id)).toEqual(['2', '4']);
    expect(getCachedQuestionMetadataIfFresh(['4', '2'])).toEqual(first);
    expect(getCachedQuestionMetadataIfFresh(['missing'])).toEqual([]);
    expect(getQuestionMetadata([], ['2', '4'])).toEqual(first);
  });

  it('coalesces different concurrent metadata batches and chapter-catalog loads', async () => {
    let finishMetadataLoad;
    let finishCatalogLoad;
    const loadMetadataQuestions = vi.fn(() => new Promise((resolve) => {
      finishMetadataLoad = resolve;
    }));
    const loadCatalogQuestions = vi.fn(() => new Promise((resolve) => {
      finishCatalogLoad = resolve;
    }));
    const firstMetadata = getOrLoadQuestionMetadata(['4', '2'], loadMetadataQuestions);
    const secondMetadata = getOrLoadQuestionMetadata(['3', '1'], loadMetadataQuestions);
    const firstCatalog = getOrLoadQuestionCatalog(
      'JEE MAINS',
      'Physics',
      loadCatalogQuestions,
    );
    const secondCatalog = getOrLoadQuestionCatalog(
      'JEE MAINS',
      'Physics',
      loadCatalogQuestions,
    );

    await Promise.resolve();
    expect(loadMetadataQuestions).toHaveBeenCalledOnce();
    expect(loadCatalogQuestions).toHaveBeenCalledOnce();
    finishMetadataLoad(questions);
    finishCatalogLoad(questions);

    const metadataResults = await Promise.all([firstMetadata, secondMetadata]);
    expect(metadataResults[0].map(({ id }) => id)).toEqual(['2', '4']);
    expect(metadataResults[1].map(({ id }) => id)).toEqual(['1', '3']);
    expect(metadataResults[0]).not.toBe(metadataResults[1]);
    await expect(Promise.all([firstCatalog, secondCatalog])).resolves.toEqual([
      [
        { chapter: 'Thermodynamics', count: 2, years: ['2025', '2024'] },
        { chapter: 'Units and Measurements', count: 1, years: ['2025'] },
      ],
      [
        { chapter: 'Thermodynamics', count: 2, years: ['2025', '2024'] },
        { chapter: 'Units and Measurements', count: 1, years: ['2025'] },
      ],
    ]);
  });

  it('does not repopulate metadata or catalog caches from stale in-flight loads', async () => {
    let finishStaleMetadata;
    let finishStaleCatalog;
    const staleVersion = getQuestionMetadataCacheVersion();
    const staleMetadata = getOrLoadQuestionMetadata(
      ['1'],
      () => new Promise((resolve) => { finishStaleMetadata = resolve; }),
      staleVersion,
    );
    const staleCatalog = getOrLoadQuestionCatalog(
      'JEE MAINS',
      'Physics',
      () => new Promise((resolve) => { finishStaleCatalog = resolve; }),
      staleVersion,
    );
    await Promise.resolve();

    invalidateQuestionMetadataCache();
    await expect(getOrLoadQuestionMetadata(['2'], async () => questions))
      .resolves.toHaveLength(1);
    await expect(getOrLoadQuestionCatalog('JEE MAINS', 'Physics', async () => questions))
      .resolves.toHaveLength(2);
    finishStaleMetadata([questions[0]]);
    finishStaleCatalog([questions[3]]);
    await Promise.all([staleMetadata, staleCatalog]);

    const loadMetadata = vi.fn(async () => []);
    const loadCatalog = vi.fn(async () => []);
    await expect(getOrLoadQuestionMetadata(['2'], loadMetadata)).resolves.toHaveLength(1);
    await expect(getOrLoadQuestionCatalog('JEE MAINS', 'Physics', loadCatalog))
      .resolves.toHaveLength(2);
    expect(loadMetadata).not.toHaveBeenCalled();
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it('clears failed metadata-index loads so a later lookup can retry', async () => {
    const loadQuestions = vi.fn()
      .mockRejectedValueOnce(new Error('temporary state read failure'))
      .mockResolvedValueOnce(questions);

    await expect(getOrLoadQuestionMetadata(['1'], loadQuestions))
      .rejects.toThrow('temporary state read failure');
    await expect(getOrLoadQuestionMetadata(['2', '3'], loadQuestions))
      .resolves.toMatchObject([{ id: '2' }, { id: '3' }]);
    expect(loadQuestions).toHaveBeenCalledTimes(2);
  });

  it('expires and invalidates the metadata index, including in-flight stale requests', () => {
    vi.useFakeTimers();
    getQuestionMetadata(questions, ['2']);
    vi.advanceTimersByTime(15_000);
    expect(getQuestionMetadata([], ['2'])).toEqual([]);

    const requestVersion = getQuestionMetadataCacheVersion();
    invalidateQuestionMetadataCache();
    expect(getQuestionMetadata(questions, ['2'], requestVersion)).toEqual([{
      id: '2',
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      difficulty: 'Medium',
    }]);
    expect(getQuestionMetadata([], ['2'])).toEqual([]);
    invalidateQuestionMetadataCache();
    expect(getQuestionMetadata([], ['2'])).toEqual([]);
  });

  it('builds a compact custom-test catalog with counts, years, chapters, and types', () => {
    expect(buildCustomTestCatalog([
      {
        ...questions[0],
        type: 'MCQ',
        question_text: 'question body',
      },
      {
        ...questions[1],
        type: 'NUMERIC',
        question_text: 'another question body',
      },
      { ...questions[2], subject: '', chapter: '' },
      questions[3],
    ])).toEqual([
      {
        name: 'JEE MAINS',
        count: 3,
        years: ['2025', '2024'],
        subjects: [
          {
            name: 'Physics',
            questionCount: 2,
            questionCountByYear: { 2025: 1, 2024: 1 },
            typesByYear: [
              { year: '2025', types: ['MCQ'] },
              { year: '2024', types: ['NUM'] },
            ],
            chapters: [
              { name: 'Thermodynamics', questionCountByYear: { 2025: 1, 2024: 1 } },
            ],
          },
          {
            name: 'Unspecified',
            questionCount: 1,
            questionCountByYear: { 2025: 1 },
            typesByYear: [{ year: '2025', types: ['MCQ'] }],
            chapters: [
              { name: 'Unspecified', questionCountByYear: { 2025: 1 } },
            ],
          },
        ],
      },
      {
        name: 'NEET',
        count: 1,
        years: ['2025'],
        subjects: [
          {
            name: 'Physics',
            questionCount: 1,
            questionCountByYear: { 2025: 1 },
            typesByYear: [{ year: '2025', types: ['MCQ'] }],
            chapters: [
              { name: 'Thermodynamics', questionCountByYear: { 2025: 1 } },
            ],
          },
        ],
      },
    ]);
  });

  it('caches the custom-test catalog, coalesces cold loads, and isolates responses', async () => {
    vi.useFakeTimers();
    let finishLoad;
    const loadQuestions = vi.fn(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const firstRequest = getOrLoadCustomTestCatalog(loadQuestions);
    const secondRequest = getOrLoadCustomTestCatalog(loadQuestions);

    await Promise.resolve();
    expect(loadQuestions).toHaveBeenCalledOnce();
    finishLoad(questions);

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first[0].name = 'changed';
    expect(getCachedCustomTestCatalogIfFresh()[0].name).toBe('JEE MAINS');

    vi.advanceTimersByTime(15_000);
    expect(getCachedCustomTestCatalogIfFresh()).toBeNull();
  });

  it('invalidates and retries custom-test catalog loads safely', async () => {
    let finishStaleLoad;
    const requestVersion = getQuestionMetadataCacheVersion();
    const staleRequest = getOrLoadCustomTestCatalog(
      () => new Promise((resolve) => { finishStaleLoad = resolve; }),
      requestVersion,
    );
    await Promise.resolve();

    invalidateQuestionMetadataCache();
    await getOrLoadCustomTestCatalog(async () => [questions[3]]);
    finishStaleLoad(questions);
    await staleRequest;

    const loadQuestions = vi.fn()
      .mockRejectedValueOnce(new Error('temporary state read failure'))
      .mockResolvedValueOnce([questions[0]]);
    invalidateQuestionMetadataCache();
    await expect(getOrLoadCustomTestCatalog(loadQuestions))
      .rejects.toThrow('temporary state read failure');
    await expect(getOrLoadCustomTestCatalog(loadQuestions)).resolves.toMatchObject([
      { name: 'JEE MAINS', count: 1 },
    ]);
    expect(loadQuestions).toHaveBeenCalledTimes(2);
  });
});
