import { describe, expect, it } from 'vitest';
import {
  addCustomTestTimeSpent,
  calculateCustomTestResults,
  compactCustomTestResult,
  selectCustomTestQuestions,
  selectCustomTestQuestionsBySubject,
} from './customTest';

const makeQuestion = (id, chapter, difficulty, year = 2024) => ({
  id,
  exam: 'JEE MAINS',
  subject: 'Physics',
  chapter,
  difficulty,
  year,
  type: 'MCQ',
  correct_answer: 'A',
  options: { A: 'one', B: 'two' },
});

describe('selectCustomTestQuestions', () => {
  it('fills from other chapters while keeping exam, subject, and year constraints', () => {
    const questions = [
      makeQuestion('selected-easy', 'Mechanics', 'Easy'),
      makeQuestion('fallback-medium', 'Optics', 'Medium'),
      makeQuestion('wrong-year', 'Optics', 'Hard', 2023),
      { ...makeQuestion('wrong-exam', 'Optics', 'Hard'), exam: 'NEET' },
      { ...makeQuestion('wrong-subject', 'Optics', 'Hard'), subject: 'Chemistry' },
    ];

    const selected = selectCustomTestQuestions({
      questions,
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapters: ['Mechanics'],
      years: ['2024'],
      count: 5,
      difficulty: 'moderate-hard',
      random: () => 0,
    });

    expect(selected.map((question) => question.id).sort()).toEqual(['fallback-medium', 'selected-easy']);
  });

  it('uses the requested mix when every difficulty is available', () => {
    const questions = [
      ...Array.from({ length: 4 }, (_, index) => makeQuestion(`easy-${index}`, 'Mechanics', 'Easy')),
      ...Array.from({ length: 20 }, (_, index) => makeQuestion(`medium-${index}`, 'Mechanics', 'Medium')),
      ...Array.from({ length: 6 }, (_, index) => makeQuestion(`hard-${index}`, 'Mechanics', 'Hard')),
    ];

    const selected = selectCustomTestQuestions({
      questions,
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapters: ['Mechanics'],
      years: ['2024'],
      count: 30,
      difficulty: 'moderate-hard',
      random: () => 0,
    });

    expect(selected).toHaveLength(30);
    expect(selected.filter((question) => question.difficulty === 'Medium')).toHaveLength(20);
    expect(selected.filter((question) => question.difficulty === 'Hard')).toHaveLength(6);
    expect(selected.filter((question) => question.difficulty === 'Easy')).toHaveLength(4);
  });

  it('caps a subject at 120 questions even when a larger count is requested', () => {
    const questions = Array.from({ length: 125 }, (_, index) => (
      makeQuestion(`question-${index}`, 'Mechanics', 'Medium')
    ));
    const selected = selectCustomTestQuestions({
      questions,
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapters: ['Mechanics'],
      years: ['2024'],
      count: 125,
      difficulty: 'moderate-hard',
      random: () => 0,
    });

    expect(selected).toHaveLength(120);
  });

  it('fills missing difficulty targets without dropping uncategorized eligible questions', () => {
    const questions = [
      makeQuestion('selected-easy', 'Mechanics', 'Easy'),
      makeQuestion('selected-hard', 'Mechanics', 'Hard'),
      makeQuestion('other-medium', 'Optics', 'Medium'),
      makeQuestion('other-uncategorized', 'Optics', 'Unrated'),
    ];
    const selected = selectCustomTestQuestions({
      questions,
      exam: 'JEE MAINS',
      subject: 'Physics',
      chapters: ['Mechanics'],
      years: ['2024'],
      count: 4,
      difficulty: 'moderate-hard',
      random: () => 0,
    });

    expect(selected.map(({ id }) => id).sort()).toEqual([
      'other-medium',
      'other-uncategorized',
      'selected-easy',
      'selected-hard',
    ]);
  });

  it('groups a multi-subject bank once without changing per-subject selection results', () => {
    const questions = [
      makeQuestion('p-easy', 'Mechanics', 'Easy'),
      { ...makeQuestion('chem-medium', 'Organic', 'Medium'), subject: 'Chemistry' },
      makeQuestion('p-medium', 'Optics', 'Medium', 2025),
      { ...makeQuestion('wrong-year', 'Mechanics', 'Hard', 2023) },
      { ...makeQuestion('wrong-exam', 'Mechanics', 'Hard'), exam: 'NEET' },
      { ...makeQuestion('chem-hard', 'Organic', 'Hard'), subject: 'Chemistry' },
      makeQuestion('p-hard', 'Mechanics', 'Hard'),
    ];
    const subjects = [
      { name: 'Physics', chapters: ['Mechanics'], count: 3 },
      { name: 'Chemistry', chapters: ['Organic'], count: 2 },
    ];
    const createRandom = () => {
      let state = 17;
      return () => {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
      };
    };
    const previousRandom = createRandom();
    const previousSelection = subjects.flatMap((subject) => selectCustomTestQuestions({
      questions,
      exam: 'JEE MAINS',
      subject: subject.name,
      chapters: subject.chapters,
      years: ['2024'],
      count: subject.count,
      difficulty: 'moderate-hard',
      random: previousRandom,
    }));

    expect(selectCustomTestQuestionsBySubject({
      questions,
      exam: 'JEE MAINS',
      subjects,
      years: ['2024'],
      difficulty: 'moderate-hard',
      random: createRandom(),
    })).toEqual(previousSelection);
  });
});

describe('calculateCustomTestResults', () => {
  it('scores correct, wrong, and unattempted questions and tracks time', () => {
    const questions = [
      makeQuestion('correct', 'Mechanics', 'Easy'),
      makeQuestion('wrong', 'Mechanics', 'Medium'),
      makeQuestion('blank', 'Mechanics', 'Hard'),
    ];
    const result = calculateCustomTestResults({
      id: 'test-1',
      exam: 'JEE MAINS',
      difficulty: 'moderate-hard',
      startedAt: 1_000,
      durationSeconds: 600,
      questions,
      subjects: [{ name: 'Physics' }],
      answers: { correct: 'A', wrong: 'B' },
      timeSpent: { correct: 30, wrong: 45 },
      marks: { MCQ: { correct: 4, wrong: -1 }, NUM: { correct: 4, wrong: 0 } },
    }, 121_000);

    expect(result).toMatchObject({
      score: 3,
      positiveMarks: 4,
      negativeMarks: 1,
      correctCount: 1,
      wrongCount: 1,
      unattemptedCount: 1,
      accuracy: 50,
      totalTimeSpent: 75,
    });
    expect(result.questionResults[0]).toMatchObject({
      questionText: '',
      explanation: '',
      questionId: 'correct',
    });
    expect(result.questionResults[0]).not.toHaveProperty('question');
  });

  it('applies the no-negative-mark default to a wrong numerical response', () => {
    const result = calculateCustomTestResults({
      id: 'numeric-test',
      exam: 'JEE MAINS',
      difficulty: 'hard',
      startedAt: 1_000,
      durationSeconds: 600,
      questions: [{
        id: 'numeric',
        subject: 'Physics',
        chapter: 'Mechanics',
        type: 'NUMERIC',
        correct_answer: '2.5',
      }],
      subjects: [{ name: 'Physics' }],
      answers: { numeric: '2' },
      timeSpent: { numeric: 12 },
      marks: { NUM: { correct: 4, wrong: 0 } },
    }, 13_000);

    expect(result).toMatchObject({ score: 0, negativeMarks: 0, wrongCount: 1 });
  });

  it('stores a pinned question version instead of duplicating review text', () => {
    const result = calculateCustomTestResults({
      id: 'versioned-test',
      exam: 'JEE MAINS',
      difficulty: 'hard',
      startedAt: 1_000,
      durationSeconds: 600,
      questions: [{
        id: 'question-1',
        question_version: 4,
        subject: 'Physics',
        chapter: 'Mechanics',
        type: 'MCQ',
        question_text: 'Prompt',
        solution: 'Reason',
        correct_answer: 'A',
      }],
      subjects: [{ name: 'Physics' }],
      answers: {},
      timeSpent: {},
      marks: { MCQ: { correct: 4, wrong: -1 } },
    }, 13_000);

    expect(result.questionResults[0]).toMatchObject({
      questionId: 'question-1',
      questionVersion: { questionId: 'question-1', version: 4 },
    });
    expect(result.questionResults[0]).not.toHaveProperty('questionText');
    expect(result.questionResults[0]).not.toHaveProperty('explanation');
  });
});

describe('addCustomTestTimeSpent', () => {
  it('merges elapsed question time without mutating existing time totals', () => {
    const existing = { question1: 12 };
    const elapsed = { question1: 3, question2: 5 };

    expect(addCustomTestTimeSpent(existing, elapsed)).toEqual({
      question1: 15,
      question2: 5,
    });

    expect(existing).toEqual({ question1: 12 });
    expect(elapsed).toEqual({ question1: 3, question2: 5 });
  });

  it('ignores invalid or non-positive elapsed values', () => {
    expect(addCustomTestTimeSpent({ question1: 4 }, {
      question1: 0,
      question2: -1,
      question3: 'not-a-number',
    })).toEqual({ question1: 4 });
  });
});

describe('compactCustomTestResult', () => {
  it('removes legacy question snapshots while retaining scorecard review content', () => {
    const oldResult = {
      id: 'legacy-result',
      questionResults: [{
        questionId: 'question-1',
        subject: 'Physics',
        correctAnswer: 'A',
        question: {
          id: 'question-1',
          subject: 'Physics',
          question_text: 'Question prompt',
          options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
          correct_answer: 'A',
          solution: 'Explanation',
          explanation: 'Explanation',
          image: 'question.svg',
          largeMetadata: 'x'.repeat(100),
        },
      }],
    };

    expect(compactCustomTestResult(oldResult)).toEqual({
      id: 'legacy-result',
      questionResults: [{
        questionId: 'question-1',
        subject: 'Physics',
        correctAnswer: 'A',
        questionText: 'Question prompt',
        explanation: 'Explanation',
      }],
    });
    expect(oldResult.questionResults[0].question.options).toBeDefined();
  });

  it('leaves already compact and malformed legacy result entries unchanged', () => {
    const result = {
      id: 'compact-result',
      questionResults: [
        { questionId: 'question-1', questionText: 'Prompt', explanation: 'Why' },
        null,
      ],
    };

    expect(compactCustomTestResult(result)).toEqual(result);
    expect(compactCustomTestResult({ id: 'incomplete' })).toEqual({ id: 'incomplete' });
  });

  it('removes review snapshots when a result already has an immutable version reference', () => {
    expect(compactCustomTestResult({
      questionResults: [{
        questionId: 'question-1',
        questionVersion: { questionId: 'question-1', version: 2 },
        questionText: 'Prompt',
        explanation: 'Reason',
      }],
    }).questionResults[0]).toEqual({
      questionId: 'question-1',
      questionVersion: { questionId: 'question-1', version: 2 },
    });
  });
});

describe('addCustomTestTimeSpent', () => {
  it('merges elapsed question time without mutating existing time totals', () => {
    const existing = { question1: 12 };
    const elapsed = { question1: 3, question2: 5 };

    expect(addCustomTestTimeSpent(existing, elapsed)).toEqual({
      question1: 15,
      question2: 5,
    });
    expect(existing).toEqual({ question1: 12 });
    expect(elapsed).toEqual({ question1: 3, question2: 5 });
  });

  it('ignores invalid or non-positive elapsed values', () => {
    expect(addCustomTestTimeSpent({ question1: 4 }, {
      question1: 0,
      question2: -1,
      question3: 'not-a-number',
    })).toEqual({ question1: 4 });
  });
});
