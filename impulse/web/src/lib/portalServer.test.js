import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let fetchMock;
let createCustomTestQuestions;
let createTest;
let loadCustomTestCatalog;
let loadPublicQuestionCatalog;
let loadPublicQuestionMetadata;
let loadPublicQuestionsPage;
let loadPublicQuestionsFromServer;
let loadQuestionVersions;
let loadPublicSeries;
let loadPublicTestCatalog;
let loadPublicTestSummary;
let getSeriesBillingAccessBatch;
let loadAdminAssetMetrics;
let loadAdminOperations;
let loadAdminProjectMetrics;
let savePortalStateToServer;
let updateSeries;
let updateTest;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T00:00:00.000Z'));
  fetchMock = vi.fn().mockImplementation(async () => (
    new Response(JSON.stringify({ questions: [{ id: 'question-1' }] }), { status: 200 })
  ));
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  vi.doMock('./supabase', () => ({
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test-access-token' } },
          error: null,
        }),
      },
    },
  }));
  ({
    createCustomTestQuestions,
    createTest,
    loadCustomTestCatalog,
    loadPublicQuestionCatalog,
    loadPublicQuestionMetadata,
    loadPublicQuestionsPage,
    loadPublicQuestionsFromServer,
    loadQuestionVersions,
    loadPublicSeries,
    loadPublicTestCatalog,
    loadPublicTestSummary,
    getSeriesBillingAccessBatch,
    loadAdminAssetMetrics,
    loadAdminOperations,
    loadAdminProjectMetrics,
    savePortalStateToServer,
    updateSeries,
    updateTest,
  } = await import('./portalServer.js'));
});

afterEach(() => {
  vi.doUnmock('./supabase');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('portal server requests', () => {
  it('loads pinned question versions in one request for scorecard review', async () => {
    const references = [{ questionId: 'question-1', version: 3 }];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      questions: [{
        questionId: 'question-1',
        version: 3,
        content: { question_text: 'Prompt' },
      }],
    }), { status: 200 }));

    await expect(loadQuestionVersions(references)).resolves.toEqual([{
      questionId: 'question-1',
      version: 3,
      content: { question_text: 'Prompt' },
    }]);
    expect(fetchMock.mock.calls[0][0]).toContain('/questions/versions');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ references });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-access-token');
  });

  it('batches large scorecards within the API request limit', async () => {
    fetchMock.mockImplementation(async () => (
      new Response(JSON.stringify({ questions: [] }), { status: 200 })
    ));
    const references = Array.from({ length: 205 }, (_, index) => ({
      questionId: `question-${index}`,
      version: 1,
    }));

    await expect(loadQuestionVersions(references)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, options]) => (
      JSON.parse(options.body).references.length
    ))).toEqual([100, 100, 5]);
  });

  it('sends one authenticated request for a batch of series access checks', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      accessBySeriesId: {
        'series-one': { allowed: true, reason: 'purchased' },
        'series-two': { allowed: false, reason: 'payment_required', price_inr: 500 },
      },
    }), { status: 200 }));

    await expect(getSeriesBillingAccessBatch(['series-one', 'series-two'])).resolves.toEqual({
      'series-one': { allowed: true, reason: 'purchased' },
      'series-two': { allowed: false, reason: 'payment_required', price_inr: 500 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/billing/series-access/batch');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-access-token',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ seriesIds: ['series-one', 'series-two'] }),
    });
  });

  it('loads admin operations health with a client session identifier', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      api: { status: 'healthy' },
      supabase: { configured: false },
      backups: { status: 'not_available' },
    }), { status: 200 }));

    await expect(loadAdminOperations()).resolves.toMatchObject({
      api: { status: 'healthy' },
      supabase: { configured: false },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/operations'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Client-Session': expect.stringMatching(/^[a-f\d-]{36}$/i),
        }),
      })
    );
  });

  it('authenticates active-session heartbeats with the current user session', async () => {
    const { startClientSessionHeartbeat } = await import('./portalServer.js');
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ recorded: true }), { status: 200 }));

    const stopHeartbeat = startClientSessionHeartbeat();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    stopHeartbeat();
    expect(fetchMock.mock.calls[0][0]).toContain('/telemetry/heartbeat');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-access-token');
    expect(fetchMock.mock.calls[0][1].headers['X-Client-Session']).toMatch(/^[a-f\d-]{36}$/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads project-level metrics from the protected admin API', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      configured: true,
      status: 'healthy',
      metrics: [{ metric: 'database_size_bytes', value: 4096 }],
    }), { status: 200 }));

    await expect(loadAdminProjectMetrics()).resolves.toMatchObject({
      configured: true,
      metrics: [{ metric: 'database_size_bytes', value: 4096 }],
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/admin/project-metrics');
  });

  it('rejects invalid batch sizes before sending a request', async () => {
    await expect(getSeriesBillingAccessBatch([])).rejects.toThrow('between 1 and 50');
    await expect(getSeriesBillingAccessBatch(Array(51).fill('series'))).rejects.toThrow('between 1 and 50');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('coalesces concurrent requests and reuses the result for 60 seconds', async () => {
    const [first, second] = await Promise.all([
      loadPublicQuestionsFromServer(),
      loadPublicQuestionsFromServer(),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first).toEqual([{ id: 'question-1' }]);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);

    await loadPublicQuestionsFromServer();
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    await loadPublicQuestionsFromServer();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe('loadAdminAssetMetrics', () => {
    it('loads protected asset metrics with a client session identifier', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        activeSessions: 2,
        traffic24h: { requests: 12 },
      }), { status: 200 }));

      await expect(loadAdminAssetMetrics()).resolves.toEqual({
        activeSessions: 2,
        traffic24h: { requests: 12 },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/asset-metrics'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Client-Session': expect.stringMatching(/^[a-f\d-]{36}$/i),
          }),
        })
      );
    });
  });

  it('does not cache failed requests', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));

    await expect(loadPublicQuestionsFromServer()).rejects.toThrow('Network unavailable');
    await expect(loadPublicQuestionsFromServer()).resolves.toEqual([{ id: 'question-1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requests compact chapter metadata and filtered question pages', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response(
        JSON.stringify({ chapters: [{ chapter: 'Thermodynamics', count: 2, years: ['2025'] }] }),
        { status: 200 }
      ))
      .mockImplementationOnce(async () => new Response(
        JSON.stringify({
          questions: [{ id: 'question-1' }],
          total: 2,
          page: 1,
          limit: 1,
          hasMore: true,
        }),
        { status: 200 }
      ));

    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics')).resolves.toEqual([
      { chapter: 'Thermodynamics', count: 2, years: ['2025'] },
    ]);
    await expect(loadPublicQuestionsPage({
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      difficulty: ['Easy', 'Medium'],
      year: ['2025'],
    }, 1, 1)).resolves.toMatchObject({
      questions: [{ id: 'question-1' }],
      total: 2,
      hasMore: true,
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/questions/catalog?exam=JEE+MAINS&subject=Physics');
    expect(fetchMock.mock.calls[1][0]).toContain('chapter=Thermodynamics');
    expect(fetchMock.mock.calls[1][0]).toContain('difficulty=Easy&difficulty=Medium');
    expect(fetchMock.mock.calls[1][0]).toContain('year=2025');
    expect(fetchMock.mock.calls[1][0]).toContain('page=1&limit=1');
  });

  it('coalesces and caches identical question pages for 15 seconds with isolated results', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      questions: [{ id: 'question-1', options: { A: 'Answer' } }],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    }), { status: 200 }));
    const filters = { exam: 'JEE MAINS', subject: 'Physics', chapter: 'Mechanics' };

    const [first, second] = await Promise.all([
      loadPublicQuestionsPage(filters),
      loadPublicQuestionsPage(filters),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);

    first.questions[0].options.A = 'changed';
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ options: { A: 'Answer' } }],
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(15_000);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      questions: [{ id: 'question-2' }],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    }), { status: 200 }));
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'question-2' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache question-page failures', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        questions: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      }), { status: 200 }));

    await expect(loadPublicQuestionsPage({ exam: 'JEE MAINS' }))
      .rejects.toThrow('Network unavailable');
    await expect(loadPublicQuestionsPage({ exam: 'JEE MAINS' })).resolves.toMatchObject({
      questions: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates question pages only after successful admin-state updates', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        questions: [{ id: 'question-1' }], total: 1, page: 1, limit: 20, hasMore: false,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Save failed' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ questions: [], exams: [], profile: {}, activity: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        questions: [{ id: 'question-3' }], total: 1, page: 1, limit: 20, hasMore: false,
      }), { status: 200 }));

    const filters = { exam: 'JEE MAINS' };
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'question-1' }],
    });
    await expect(savePortalStateToServer({})).rejects.toThrow('Save failed');
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'question-1' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await savePortalStateToServer({});
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'question-3' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not let an in-flight question page repopulate cache after an admin save', async () => {
    let resolveOldRequest;
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOldRequest = resolve;
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        questions: [{ id: 'new-question' }], total: 1, page: 1, limit: 20, hasMore: false,
      }), { status: 200 }));

    const filters = { exam: 'JEE MAINS' };
    const oldRequest = loadPublicQuestionsPage(filters);
    await savePortalStateToServer({});
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'new-question' }],
    });

    resolveOldRequest(new Response(JSON.stringify({
      questions: [{ id: 'old-question' }], total: 1, page: 1, limit: 20, hasMore: false,
    }), { status: 200 }));
    await oldRequest;
    await expect(loadPublicQuestionsPage(filters)).resolves.toMatchObject({
      questions: [{ id: 'new-question' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('coalesces and caches chapter catalogs for 30 seconds with isolated results', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      chapters: [{ chapter: 'Mechanics', count: 10, years: ['2025'] }],
    }), { status: 200 }));

    const [first, second] = await Promise.all([
      loadPublicQuestionCatalog('JEE MAINS', 'Physics'),
      loadPublicQuestionCatalog('JEE MAINS', 'Physics'),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first).toEqual([{ chapter: 'Mechanics', count: 10, years: ['2025'] }]);
    expect(second).toEqual(first);
    expect(first).not.toBe(second);

    first[0].years.push('changed');
    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics')).resolves.toEqual([
      { chapter: 'Mechanics', count: 10, years: ['2025'] },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(30_000);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ chapters: [] }), { status: 200 }));
    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries failed chapter catalog requests', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        chapters: [{ chapter: 'Mechanics', count: 1, years: [] }],
      }), { status: 200 }));

    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics'))
      .rejects.toThrow('Network unavailable');
    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics')).resolves.toEqual([
      { chapter: 'Mechanics', count: 1, years: [] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates chapter catalogs only after a successful admin-state save', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        chapters: [{ chapter: 'Mechanics', count: 1, years: ['2025'] }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Save failed' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        questions: [], exams: [], profile: {}, activity: [],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        chapters: [{ chapter: 'Optics', count: 2, years: ['2024'] }],
      }), { status: 200 }));

    await loadPublicQuestionCatalog('JEE MAINS', 'Physics');
    await expect(savePortalStateToServer({})).rejects.toThrow('Save failed');
    await loadPublicQuestionCatalog('JEE MAINS', 'Physics');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await savePortalStateToServer({});
    await expect(loadPublicQuestionCatalog('JEE MAINS', 'Physics')).resolves.toEqual([
      { chapter: 'Optics', count: 2, years: ['2024'] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('loads one published test summary without requesting the full catalog', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(
      JSON.stringify({
        series: { id: 'series id', title: 'Series' },
        test: { id: 'test/one', title: 'Test' },
      }),
      { status: 200 }
    ));

    await expect(loadPublicTestSummary('series id', 'test/one')).resolves.toEqual({
      series: { id: 'series id', title: 'Series' },
      test: { id: 'test/one', title: 'Test' },
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/test-catalog?seriesId=series+id&testId=test%2Fone');
  });

  it('coalesces and caches the public series list until a series or test mutation', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [{ id: 'series-one', title: 'Series' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'series-two' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [{ id: 'series-two', title: 'Updated' }] }), { status: 200 }));

    const [first, second] = await Promise.all([loadPublicSeries(), loadPublicSeries()]);
    expect(first).toEqual([{ id: 'series-one', title: 'Series' }]);
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
    first[0].title = 'Mutated in caller';
    await expect(loadPublicSeries()).resolves.toEqual([{ id: 'series-one', title: 'Series' }]);
    expect(fetchMock).toHaveBeenCalledOnce();

    await updateSeries('series-one', { title: 'Updated' });
    await expect(loadPublicSeries()).resolves.toEqual([{ id: 'series-two', title: 'Updated' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries failed public series requests and refreshes the list on expiry', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [{ id: 'series-one' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [] }), { status: 200 }));

    await expect(loadPublicSeries()).rejects.toThrow('Network unavailable');
    await expect(loadPublicSeries()).resolves.toEqual([{ id: 'series-one' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(30_000);
    await expect(loadPublicSeries()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('coalesces and caches published test summaries for 30 seconds', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      series: { id: 'series-one', meta: { kind: 'test-series' } },
      test: { id: 'test-one', subjects: ['Physics'] },
    }), { status: 200 }));

    const [first, second] = await Promise.all([
      loadPublicTestSummary('series-one', 'test-one'),
      loadPublicTestSummary('series-one', 'test-one'),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);

    first.test.subjects.push('Changed');
    await expect(loadPublicTestSummary('series-one', 'test-one')).resolves.toEqual({
      series: { id: 'series-one', meta: { kind: 'test-series' } },
      test: { id: 'test-one', subjects: ['Physics'] },
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(30_000);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      series: { id: 'series-one' },
      test: { id: 'test-one', subjects: ['Chemistry'] },
    }), { status: 200 }));
    await expect(loadPublicTestSummary('series-one', 'test-one')).resolves.toMatchObject({
      test: { subjects: ['Chemistry'] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries failed test summary requests instead of caching failures', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        series: { id: 'series-one' },
        test: { id: 'test-one' },
      }), { status: 200 }));

    await expect(loadPublicTestSummary('series-one', 'test-one'))
      .rejects.toThrow('Network unavailable');
    await expect(loadPublicTestSummary('series-one', 'test-one')).resolves.toMatchObject({
      test: { id: 'test-one' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates test summary cache after successful test or series updates only', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        series: { id: 'series-one' },
        test: { id: 'test-one', title: 'Original' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Update failed' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'test-one',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        series: { id: 'series-one' },
        test: { id: 'test-one', title: 'Updated' },
      }), { status: 200 }));

    await loadPublicTestSummary('series-one', 'test-one');
    await expect(updateSeries('series-one', { title: 'Failed update' }))
      .rejects.toThrow('Update failed');
    await loadPublicTestSummary('series-one', 'test-one');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await updateTest('test-one', { title: 'Updated' });
    await expect(loadPublicTestSummary('series-one', 'test-one')).resolves.toMatchObject({
      test: { title: 'Updated' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('coalesces and caches each filtered public catalog for 30 seconds', async () => {
    fetchMock.mockImplementation(async () => new Response(
      JSON.stringify({
        series: [{ id: 'series-one', title: 'Series' }],
        tests: [{ id: 'test-one', seriesId: 'series-one', title: 'Test' }],
      }),
      { status: 200 }
    ));

    const filter = { kind: 'previous-papers', examKey: 'jee-mains' };
    const [first, second] = await Promise.all([
      loadPublicTestCatalog(filter),
      loadPublicTestCatalog(filter),
    ]);

    expect(first).toEqual({
      series: [{ id: 'series-one', title: 'Series' }],
      tests: [{ id: 'test-one', seriesId: 'series-one', title: 'Test' }],
    });
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/test-catalog?kind=previous-papers&examKey=jee-mains');

    await loadPublicTestCatalog(filter);
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(30_000);
    await loadPublicTestCatalog(filter);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps catalog filters cached independently', async () => {
    fetchMock.mockImplementation(async (url) => new Response(
      JSON.stringify({
        series: [{ id: String(url) }],
        tests: [],
      }),
      { status: 200 }
    ));

    const papers = await loadPublicTestCatalog({ kind: 'previous-papers', examKey: 'jee-mains' });
    const tests = await loadPublicTestCatalog({ kind: 'test-series' });
    await loadPublicTestCatalog({ kind: 'previous-papers', examKey: 'jee-mains' });

    expect(papers.series[0].id).toContain('examKey=jee-mains');
    expect(tests.series[0].id).toContain('kind=test-series');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches paginated test-series pages independently and preserves paging metadata', async () => {
    fetchMock.mockImplementation(async (url) => {
      const requestUrl = new URL(url, 'http://localhost');
      const page = Number(requestUrl.searchParams.get('page'));
      return new Response(JSON.stringify({
        series: [{ id: 'series-one', title: 'Series' }],
        tests: [{ id: `test-${page}`, seriesId: 'series-one' }],
        testCountsBySeries: { 'series-one': 25 },
        pageInfo: { page, limit: 18, total: 25, hasMore: page === 1 },
      }), { status: 200 });
    });

    const firstPage = await loadPublicTestCatalog({ kind: 'test-series', page: 1, limit: 18 });
    const secondPage = await loadPublicTestCatalog({ kind: 'test-series', page: 2, limit: 18 });
    const cachedFirstPage = await loadPublicTestCatalog({ kind: 'test-series', page: 1, limit: 18 });

    expect(firstPage.pageInfo).toEqual({ page: 1, limit: 18, total: 25, hasMore: true });
    expect(firstPage.testCountsBySeries).toEqual({ 'series-one': 25 });
    expect(secondPage.tests).toEqual([{ id: 'test-2', seriesId: 'series-one' }]);
    expect(cachedFirstPage).toEqual(firstPage);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/test-catalog?kind=test-series&page=1&limit=18');
    expect(fetchMock.mock.calls[1][0]).toContain('/test-catalog?kind=test-series&page=2&limit=18');
  });

  it('returns isolated summaries and bounds the browser catalog cache', async () => {
    fetchMock.mockImplementation(async (url) => new Response(JSON.stringify({
      series: [{ id: String(url), meta: { nested: true } }],
      tests: [],
    }), { status: 200 }));

    const first = await loadPublicTestCatalog({ kind: 'test-series', page: 1, limit: 1 });
    first.series[0].meta.nested = false;
    const isolated = await loadPublicTestCatalog({ kind: 'test-series', page: 1, limit: 1 });
    expect(isolated.series[0].meta.nested).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    for (let page = 2; page <= 51; page += 1) {
      await loadPublicTestCatalog({ kind: 'test-series', page, limit: 1 });
    }
    await loadPublicTestCatalog({ kind: 'test-series', page: 1, limit: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(52);
  });

  it('invalidates public catalog caches after successful test or series edits', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [], tests: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'series-one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [], tests: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'test-one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ series: [], tests: [] }), { status: 200 }));

    await loadPublicTestCatalog({ kind: 'test-series' });
    await updateSeries('series-one', { title: 'Updated' });
    await loadPublicTestCatalog({ kind: 'test-series' });
    await createTest({ title: 'Added test' });
    await loadPublicTestCatalog({ kind: 'test-series' });

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('loads compact metadata for requested question IDs and reuses it briefly', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(
      JSON.stringify({
        questions: [{
          id: 'question-1',
          exam: 'JEE MAINS',
          subject: 'Physics',
          chapter: 'Thermodynamics',
          difficulty: 'Easy',
        }],
      }),
      { status: 200 }
    ));

    const [first, second] = await Promise.all([
      loadPublicQuestionMetadata(['question-1']),
      loadPublicQuestionMetadata(['question-1']),
    ]);

    expect(first['question-1']).toMatchObject({
      exam: 'JEE MAINS',
      chapter: 'Thermodynamics',
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/questions/metadata?id=question-1');
  });

  it('coalesces and caches the compact custom-test catalog for 60 seconds', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(
      JSON.stringify({
        exams: [{ name: 'JEE MAINS', count: 10, years: ['2025'] }],
      }),
      { status: 200 }
    ));

    const [first, second] = await Promise.all([
      loadCustomTestCatalog(),
      loadCustomTestCatalog(),
    ]);

    expect(first).toEqual([{ name: 'JEE MAINS', count: 10, years: ['2025'] }]);
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
    await loadCustomTestCatalog();
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    await loadCustomTestCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/questions/custom-test/catalog');
  });

  it('requests server-selected question bodies using the builder settings', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(
      JSON.stringify({ questions: [{ id: 'question-2', question_text: 'Selected body' }] }),
      { status: 200 }
    ));

    const selection = {
      exam: 'JEE MAINS',
      subjects: [{ name: 'Physics', chapters: ['Mechanics'], count: 10 }],
      years: ['2025'],
      difficulty: 'moderate-hard',
    };
    await expect(createCustomTestQuestions(selection)).resolves.toEqual([
      { id: 'question-2', question_text: 'Selected body' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/questions/custom-test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(selection),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-access-token');
  });

});
