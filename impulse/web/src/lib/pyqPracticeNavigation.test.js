import { describe, expect, it } from 'vitest';
import {
  getPYQPracticeExitState,
  getPYQPracticeQuestionSequence,
  getPYQPracticeReturnState,
} from './pyqPracticeNavigation';

describe('getPYQPracticeExitState', () => {
  it('preserves the selected chapter and filters when returning from practice', () => {
    const practiceState = {
      step: 4,
      selectedExam: 'JEE MAINS',
      selectedSubject: 'Physics',
      selectedChapter: 'Mechanics',
      appliedFilters: { difficulty: ['Hard'], year: [2025] },
      localFilters: { difficulty: ['Hard'], year: [2025] },
    };

    expect(getPYQPracticeExitState({
      from: '/pyq-practice',
      practiceState,
    }, {})).toEqual({ practiceState });
  });

  it('returns to the current question chapter when no navigation state exists', () => {
    expect(getPYQPracticeExitState(null, {
      exam: 'JEE MAINS',
      subject: 'Chemistry',
      chapter: 'Chemical Bonding',
    })).toEqual({
      practiceState: {
        step: 4,
        selectedExam: 'JEE MAINS',
        selectedSubject: 'Chemistry',
        selectedChapter: 'Chemical Bonding',
        appliedFilters: { difficulty: [], year: [] },
        localFilters: { difficulty: [], year: [] },
      },
    });
  });

  it('does not add practice state when returning to another origin', () => {
    const locationState = { from: '/notebook' };
    expect(getPYQPracticeExitState(locationState, {})).toEqual({});
  });
});

describe('getPYQPracticeReturnState', () => {
  it('preserves the selected exam, subject, chapter, and filters while navigating', () => {
    const locationState = {
      from: '/pyq-practice',
      practiceState: {
        step: 3,
        selectedExam: 'JEE MAINS',
        selectedSubject: 'Physics',
        selectedChapter: 'Mechanics',
        appliedFilters: { difficulty: ['Hard'], year: ['2025'] },
        localFilters: { difficulty: ['Hard'], year: ['2025'] },
      },
    };

    expect(getPYQPracticeReturnState(locationState)).toEqual({
      from: '/pyq-practice',
      practiceState: {
        step: 4,
        selectedExam: 'JEE MAINS',
        selectedSubject: 'Physics',
        selectedChapter: 'Mechanics',
        appliedFilters: { difficulty: ['Hard'], year: ['2025'] },
        localFilters: { difficulty: ['Hard'], year: ['2025'] },
      },
    });
  });

  it('leaves return state from other pages unchanged', () => {
    const locationState = { from: '/notebook' };
    expect(getPYQPracticeReturnState(locationState)).toBe(locationState);
  });
});

describe('getPYQPracticeQuestionSequence', () => {
  const questions = [
    { id: 'physics-q1', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Mechanics', difficulty: 'Easy', year: 2024 },
    { id: 'chemistry-q1', exam: 'JEE MAINS', subject: 'Chemistry', chapter: 'Mechanics', difficulty: 'Easy', year: 2024 },
    { id: 'physics-q2', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Mechanics', difficulty: 'Hard', year: 2025 },
    { id: 'physics-q3', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Mechanics', difficulty: 'Hard', year: 2025 },
    { id: 'physics-other-chapter', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Optics', difficulty: 'Hard', year: 2025 },
    { id: 'other-exam', exam: 'NEET', subject: 'Physics', chapter: 'Mechanics', difficulty: 'Hard', year: 2025 },
  ];

  it('limits previous and next navigation to the selected exam, subject, and chapter', () => {
    const sequence = getPYQPracticeQuestionSequence(questions, {
      from: '/pyq-practice',
      practiceState: {
        selectedExam: 'JEE MAINS',
        selectedSubject: 'Physics',
        selectedChapter: 'Mechanics',
      },
    }, questions[2]);

    expect(sequence.map((question) => question.id)).toEqual([
      'physics-q1',
      'physics-q2',
      'physics-q3',
    ]);
    expect(sequence.findIndex((question) => question.id === 'physics-q2') + 1).toBe(2);
  });

  it('respects applied PYQ filters in the solving sequence', () => {
    const sequence = getPYQPracticeQuestionSequence(questions, {
      from: '/pyq-practice',
      practiceState: {
        selectedExam: 'JEE MAINS',
        selectedSubject: 'Physics',
        selectedChapter: 'Mechanics',
        appliedFilters: { difficulty: ['Hard'], year: ['2025'] },
      },
    }, questions[2]);

    expect(sequence.map((question) => question.id)).toEqual(['physics-q2', 'physics-q3']);
  });

  it('preserves the existing sequence for non-PYQ entry points', () => {
    expect(getPYQPracticeQuestionSequence(questions, { from: '/notebook' }, questions[0]))
      .toBe(questions);
  });
});
