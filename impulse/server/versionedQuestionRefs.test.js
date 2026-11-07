import { describe, expect, it } from 'vitest';
import {
  collectTestQuestionReferences,
  compactVersionedTestQuestions,
  hydrateVersionedTestQuestions,
} from './versionedQuestionRefs.js';

const questionContent = {
  id: 'question-1',
  type: 'MCQ',
  question_text: 'Prompt',
  image: '',
  options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
  option_images: { A: '', B: '', C: '', D: '' },
  correct_answer: 'A',
  solution: 'Reason',
  explanation: 'Reason',
  subject: 'Physics',
};

const dynamicQuestion = {
  id: 'question-1',
  sourceId: 'original-1',
  sourceNumber: 'original-1',
  text: 'Prompt',
  imageUrl: '',
  type: 'MCQ',
  options: [
    { key: 'A', text: 'First', imageUrl: '' },
    { key: 'B', text: 'Second', imageUrl: '' },
    { key: 'C', text: 'Third', imageUrl: '' },
    { key: 'D', text: 'Fourth', imageUrl: '' },
  ],
  answer: 'A',
  solution: 'Reason',
  explanation: 'Reason',
  section: 'PHYSICS-MCQ',
  subject: 'Physics',
};

describe('versioned test question references', () => {
  it('replaces an exact dynamic question copy with an immutable version reference', () => {
    const compacted = compactVersionedTestQuestions({
      id: 'test-1',
      sections: [{ questions: [dynamicQuestion] }],
    }, [{
      question_id: 'question-1',
      version: 3,
      content: questionContent,
    }]);

    expect(compacted.sections[0].questions[0]).toEqual({
      id: 'question-1',
      sourceId: 'original-1',
      sourceNumber: 'original-1',
      section: 'PHYSICS-MCQ',
      subject: 'Physics',
      questionRef: { questionId: 'question-1', version: 3 },
    });
  });

  it('keeps content snapshots when they do not match a question version', () => {
    const changedQuestion = { ...dynamicQuestion, answer: 'B' };
    const compacted = compactVersionedTestQuestions({
      sections: [{ questions: [changedQuestion] }],
    }, [{
      question_id: 'question-1',
      version: 3,
      content: questionContent,
    }]);

    expect(compacted.sections[0].questions[0]).toEqual(changedQuestion);
  });

  it('hydrates a referenced test question from its pinned version', () => {
    const storedTest = {
      id: 'test-1',
      sections: [{
        questions: [{
          id: 'question-1',
          subject: 'Physics',
          questionRef: { questionId: 'question-1', version: 3 },
        }],
      }],
    };

    expect(hydrateVersionedTestQuestions(storedTest, [{
      question_id: 'question-1',
      version: 3,
      content: questionContent,
    }]).sections[0].questions[0]).toMatchObject({
      id: 'question-1',
      text: 'Prompt',
      type: 'MCQ',
      answer: 'A',
      solution: 'Reason',
      options: [
        { key: 'A', text: 'First', imageUrl: '' },
        { key: 'B', text: 'Second', imageUrl: '' },
        { key: 'C', text: 'Third', imageUrl: '' },
        { key: 'D', text: 'Fourth', imageUrl: '' },
      ],
      questionRef: { questionId: 'question-1', version: 3 },
    });
  });

  it('fails explicitly when a referenced immutable version is missing', () => {
    expect(() => hydrateVersionedTestQuestions({
      id: 'test-1',
      sections: [{ questions: [{
        id: 'question-1',
        questionRef: { questionId: 'question-1', version: 99 },
      }] }],
    }, [])).toThrow(/question-1:99/);
  });

  it('rejects a row whose immutable key does not match its stored content ID', () => {
    expect(() => hydrateVersionedTestQuestions({
      id: 'test-1',
      sections: [{ questions: [{
        id: 'question-1',
        questionRef: { questionId: 'question-1', version: 3 },
      }] }],
    }, [{
      question_id: 'question-1',
      version: 3,
      content: { id: 'different-question' },
    }])).toThrow(/question-1:3/);
  });

  it('collects only valid version references', () => {
    expect(collectTestQuestionReferences({
      sections: [{ questions: [
        { questionRef: { questionId: 'question-1', version: 1 } },
        { questionRef: { questionId: 'question-2', version: 0 } },
        {},
      ] }],
    })).toEqual([{ questionId: 'question-1', version: 1 }]);
  });
});
