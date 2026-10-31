import { describe, expect, it } from 'vitest';
import { parseQuizQuestionImport, validateQuizQuestionImport } from './quizQuestionImport';

const validQuestion = {
  subject: 'Physics',
  chapter: 'Motion',
  question: 'How far does it travel?',
  options: { A: '1 m', B: '2 m', C: '3 m', D: '4 m' },
  answer: 'B',
};

describe('quiz question JSON import', () => {
  it('parses JSON and validates questions with their own chapter tags', () => {
    const manifest = parseQuizQuestionImport(JSON.stringify({ questions: [validQuestion] }));

    expect(validateQuizQuestionImport(manifest)).toEqual({
      errors: [],
      questions: [{
        subject: 'Physics',
        chapter: 'Motion',
        question_text: 'How far does it travel?',
        options: { A: '1 m', B: '2 m', C: '3 m', D: '4 m' },
        correct_answer: 'B',
        explanation: '',
        difficulty: 'Medium',
      }],
    });
  });

  it('uses top-level subject and chapter as defaults', () => {
    const result = validateQuizQuestionImport({
      subject: 'Chemistry',
      chapter: 'Atomic Structure',
      questions: [{ ...validQuestion, subject: undefined, chapter: undefined }],
    });

    expect(result.errors).toEqual([]);
    expect(result.questions[0]).toMatchObject({
      subject: 'Chemistry',
      chapter: 'Atomic Structure',
    });
  });

  it('accepts a four-item options array and answer aliases', () => {
    const result = validateQuizQuestionImport([{
      ...validQuestion,
      options: ['one', 'two', 'three', 'four'],
      answer: undefined,
      correct_answer: 'c',
    }]);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].options).toEqual({ A: 'one', B: 'two', C: 'three', D: 'four' });
    expect(result.questions[0].correct_answer).toBe('C');
  });

  it('reports missing chapter, incomplete options, and an invalid answer', () => {
    const missingChapter = validateQuizQuestionImport({
      questions: [{ ...validQuestion, chapter: '' }],
    });
    const incompleteOptions = validateQuizQuestionImport({
      questions: [{ ...validQuestion, options: { A: 'Only one' } }],
    });
    const invalidAnswer = validateQuizQuestionImport({
      questions: [{ ...validQuestion, answer: 'E' }],
    });

    expect(missingChapter.errors).toContain('Question 1 is missing chapter (a non-empty string).');
    expect(incompleteOptions.errors).toContain('Question 1 must provide four non-empty options (A, B, C, and D).');
    expect(invalidAnswer.errors).toContain('Question 1 answer must be A, B, C, or D.');
  });

  it('rejects empty or oversized manifests', () => {
    expect(validateQuizQuestionImport({ questions: [] }).errors).toContain(
      'The JSON must contain a non-empty questions array.',
    );
    expect(validateQuizQuestionImport({ questions: Array(501).fill(validQuestion) }).errors).toContain(
      'A single import may contain at most 500 questions.',
    );
  });

  it('reports malformed JSON', () => {
    expect(() => parseQuizQuestionImport('{')).toThrow('Invalid JSON:');
  });
});
