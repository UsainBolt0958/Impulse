// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reviewModeSource = readFileSync(
  resolve(process.cwd(), 'public', 'jee2025', 'assets', 'js', 'review-mode.js'),
  'utf8'
);

function loadReviewMode() {
  new Function('window', 'document', 'alert', 'console', reviewModeSource)(
    window,
    document,
    vi.fn(),
    console
  );
}

describe('exam review mode', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent;
      },
      set(value) {
        this.textContent = String(value);
      },
    });
    document.body.innerHTML = `
      <p id="res-subtitle">PAPER 1</p>
      <div class="foot-bar"><button>Previous</button><button>Save &amp; Next</button></div>
      <div class="submit-area"><button>SUBMIT TEST</button></div>
    `;
    window.isReviewMode = false;
    window.reviewModePaper = null;
    window.reviewModeResult = null;
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the specific result currently displayed instead of the latest user result', () => {
    const selectedAttemptResult = { solutions: [{ id: 'q-1', sel: 2 }] };
    window.getDisplayedReviewContext = vi.fn(() => ({
      paper: 1,
      result: selectedAttemptResult,
      attempt: { attemptId: 'attempt-previous' },
    }));
    window.userData = { p1_res: { solutions: [] } };
    window.startReviewSession = vi.fn(() => 1);
    loadReviewMode();

    window.enterReviewMode();

    expect(window.startReviewSession).toHaveBeenCalledWith(1, selectedAttemptResult);
    expect(window.reviewModeResult).toBe(selectedAttemptResult);
    expect(window.isReviewMode).toBe(true);
    expect(document.body).toHaveAttribute('data-review-mode', 'true');
  });

  it('restores selected answers by stable question id and supports legacy positional ids', () => {
    loadReviewMode();
    const reviewSession = {
      data: {
        Physics: {
          'PHYSICS-MCQ': [
            { id: 'imported-q1', sel: null, st: 'not-visited' },
            { id: 'imported-q2', sel: null, st: 'not-visited' },
          ],
        },
        Chemistry: {
          C: [
            { id: 1, sel: null, st: 'not-visited' },
            { id: 2, sel: null, st: 'not-visited' },
          ],
        },
      },
    };

    const restoredCount = window.restoreReviewAnswers(reviewSession, {
      solutions: [
        { id: 'imported-q1', sub: 'Physics', sec: 'PHYSICS-MCQ', sel: 2 },
        { id: 'imported-q2', sub: 'Physics', sec: 'PHYSICS-MCQ', sel: null },
        { qid: 2, subject: 'Chemistry', section: 'C', userAnswer: '12' },
      ],
    });

    expect(restoredCount).toBe(3);
    expect(reviewSession.data.Physics['PHYSICS-MCQ'][0]).toMatchObject({ sel: 2, st: 'answered' });
    expect(reviewSession.data.Physics['PHYSICS-MCQ'][1]).toMatchObject({ sel: null, st: 'not-answered' });
    expect(reviewSession.data.Chemistry.C[1]).toMatchObject({ sel: '12', st: 'answered' });
  });

  it('restores marked and answered-marked palette states from attempt analytics', () => {
    loadReviewMode();
    const reviewSession = {
      data: {
        Physics: {
          A: [
            { id: 'stable-q1', sel: null, st: 'not-visited', sub: 'Physics', sec: 'A' },
            { id: 'stable-q2', sel: null, st: 'not-visited', sub: 'Physics', sec: 'A' },
          ],
        },
      },
    };

    window.restoreReviewAnswers(reviewSession, {
      solutions: [
        { id: 1, sub: 'Physics', sec: 'A', sel: null },
        { id: 2, sub: 'Physics', sec: 'A', sel: 'B' },
      ],
      analytics: {
        markedReviewLog: {
          Physics_A_1: { attempted: false },
          Physics_A_2: { attempted: true },
        },
      },
    });

    expect(reviewSession.data.Physics.A[0]).toMatchObject({
      sel: null,
      st: 'marked',
      reviewResultId: 1,
      reviewResultSubject: 'Physics',
      reviewResultSection: 'A',
    });
    expect(reviewSession.data.Physics.A[1]).toMatchObject({
      sel: 'B',
      st: 'mark-ans',
      reviewResultId: 2,
    });
  });

  it('reads question time using the same paper-prefixed keys as the analysis heatmap', () => {
    loadReviewMode();

    expect(window.getReviewQuestionTimeSpent(
      { analytics: { timePerQuestion: { paper1_Physics_A_q1: 95 } } },
      'Physics',
      'A',
      'q1',
      1
    )).toBe(95);
    expect(window.getReviewQuestionTimeSpent(
      { analytics: { timePerQuestion: { Physics_A_q1: 42 } } },
      'Physics',
      'A',
      'q1',
      1
    )).toBe(42);
  });

  it('uses the analysis heatmap time lookup for review badges', () => {
    const heatmapLookup = vi.fn(() => 67);
    window.getHeatmapQuestionTimeSpent = heatmapLookup;
    loadReviewMode();

    expect(window.getReviewQuestionTimeSpent(
      { analytics: { timePerQuestion: {} } },
      'Physics',
      'A',
      'q1',
      2
    )).toBe(67);
    expect(heatmapLookup).toHaveBeenCalledWith(
      { sub: 'Physics', sec: 'A', id: 'q1', paper: 2 },
      0,
      { analytics: { timePerQuestion: {} } }
    );
  });

  it('persists and restores the selected attempt in review mode after reload', () => {
    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1');
    window.getDisplayedReviewContext = vi.fn(() => ({
      paper: 1,
      result: { solutions: [{ id: 'q-1', sel: 0 }] },
      attempt: { attemptId: 'attempt-selected', rawPaper1: { solutions: [{ id: 'q-1', sel: 0 }] } },
    }));
    window.startReviewSession = vi.fn(() => 1);
    window.act = vi.fn();
    window.finishExam = vi.fn();
    loadReviewMode();

    window.enterReviewMode();
    expect(new URLSearchParams(window.location.search).get('view')).toBe('review');
    window.isReviewMode = false;
    window.reviewModePaper = null;
    window.reviewModeResult = null;
    window.startReviewSession.mockClear();
    window.setDisplayedReviewContext = vi.fn();
    loadReviewMode();

    expect(window.restoreSavedReviewMode()).toBe(true);
    expect(window.startReviewSession).toHaveBeenCalledWith(
      1,
      { solutions: [{ id: 'q-1', sel: 0 }] }
    );
    expect(window.setDisplayedReviewContext).toHaveBeenCalledWith(
      1,
      { solutions: [{ id: 'q-1', sel: 0 }] },
      { attemptId: 'attempt-selected', rawPaper1: { solutions: [{ id: 'q-1', sel: 0 }] } }
    );
    expect(document.querySelector('.submit-area button')).toHaveTextContent('EXIT REVIEW');
    expect(window.localStorage.length).toBe(1);
  });

  it('does not restore stale review state when opening a test without a review mode URL', () => {
    const result = { solutions: [{ id: 'q-1', sel: 0 }] };
    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1');
    window.getDisplayedReviewContext = vi.fn(() => ({ paper: 1, result }));
    window.startReviewSession = vi.fn(() => 1);
    loadReviewMode();

    window.enterReviewMode();
    expect(window.localStorage.length).toBe(1);

    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1&resume=true');
    window.startReviewSession.mockClear();
    expect(window.restoreSavedReviewMode()).toBe(false);
    expect(window.startReviewSession).not.toHaveBeenCalled();
  });

  it('restores the saved analysis instead of launching a new paper after reload', () => {
    const result = { solutions: [{ id: 'q-1', sel: 0 }] };
    const attempt = { attemptId: 'attempt-selected', rawPaper1: result };
    const restoreDisplayedResult = vi.fn();
    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1');
    window.setDisplayedReviewContext = vi.fn();
    window.restoreDisplayedResult = restoreDisplayedResult;
    window.startReviewSession = vi.fn();
    loadReviewMode();

    window.saveAnalysisPageState(1, result, attempt);

    expect(window.hasSavedReviewMode()).toBe(true);
    expect(new URLSearchParams(window.location.search).get('view')).toBe('analysis');
    expect(window.restoreSavedReviewMode()).toBe(true);
    expect(window.setDisplayedReviewContext).toHaveBeenCalledWith(1, result, attempt);
    expect(restoreDisplayedResult).toHaveBeenCalledOnce();
    expect(window.startReviewSession).not.toHaveBeenCalled();
  });

  it('restores a review saved by the previous storage key format', () => {
    const result = { solutions: [{ id: 'q-1', sel: 0 }] };
    const attempt = { attemptId: 'legacy-attempt', rawPaper1: result };
    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1&attemptId=legacy-attempt');
    window.localStorage.setItem(
      'impulse-review-mode:/jee2025/exam/index.html:test-1:series-1',
      JSON.stringify({ paper: 1, result, attempt })
    );
    window.startReviewSession = vi.fn(() => 1);
    window.act = vi.fn();
    window.finishExam = vi.fn();
    loadReviewMode();

    expect(window.hasSavedReviewMode()).toBe(true);
    expect(window.restoreSavedReviewMode()).toBe(true);
    expect(window.startReviewSession).toHaveBeenCalledWith(1, result);
    expect(document.querySelector('.submit-area button')).toHaveTextContent('EXIT REVIEW');
  });

  it('clears only the saved page-resume state when starting an intentional navigation', () => {
    const result = { solutions: [{ id: 'q-1', sel: 0 }] };
    window.history.replaceState({}, '', '/jee2025/exam/index.html?testId=test-1&seriesId=series-1&paper=1');
    window.saveAnalysisPageState = undefined;
    loadReviewMode();

    window.saveAnalysisPageState(1, result, null);
    expect(window.hasSavedReviewMode()).toBe(true);

    window.clearSavedExamPageState();

    expect(window.hasSavedReviewMode()).toBe(false);
  });

  it('returns to the same displayed attempt after exiting review mode', () => {
    const restoreDisplayedResult = vi.fn();
    window.getDisplayedReviewContext = vi.fn(() => ({
      paper: 1,
      result: { solutions: [{ id: 'q-1', sel: 0 }] },
    }));
    window.startReviewSession = vi.fn(() => 1);
    window.restoreDisplayedResult = restoreDisplayedResult;
    window.act = vi.fn();
    window.finishExam = vi.fn();
    loadReviewMode();

    window.enterReviewMode();
    window.exitReviewMode();

    expect(restoreDisplayedResult).toHaveBeenCalledOnce();
    expect(window.isReviewMode).toBe(false);
    expect(document.body).not.toHaveAttribute('data-review-mode');
    expect(window.localStorage.length).toBe(1);
    expect(window.sessionStorage.length).toBe(0);
  });
});
