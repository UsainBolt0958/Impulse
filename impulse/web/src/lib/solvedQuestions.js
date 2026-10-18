export const SOLVED_QUESTIONS_KEY = 'impulse_solved';
export const SOLVED_QUESTIONS_UPDATED_EVENT = 'impulse:solved-questions:updated';

export function appendSolvedQuestionAttempts(attempts) {
  if (typeof window === 'undefined') {
    throw new Error('Solved question attempts can only be saved in a browser.');
  }

  const stored = window.localStorage.getItem(SOLVED_QUESTIONS_KEY);
  let existing = [];
  if (stored) {
    try {
      existing = JSON.parse(stored);
      if (!Array.isArray(existing)) {
        throw new Error('Saved solved question data is not a list.');
      }
    } catch (error) {
      console.error('Could not read saved solved question data; replacing it with new attempts.', error);
      existing = [];
    }
  }

  const attemptIds = new Set(existing.map((entry) => entry?.attempt_id).filter(Boolean));
  const additions = attempts.filter((attempt) => {
    if (!attempt.attempt_id) return true;
    if (attemptIds.has(attempt.attempt_id)) return false;
    attemptIds.add(attempt.attempt_id);
    return true;
  });
  const updated = [...existing, ...additions];

  window.localStorage.setItem(SOLVED_QUESTIONS_KEY, JSON.stringify(updated));
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(SOLVED_QUESTIONS_UPDATED_EVENT));
  }
  return updated;
}
