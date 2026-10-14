import { describe, expect, it } from 'vitest';
import {
  calculateCustomTestResults,
  selectCustomTestQuestions,
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
});
