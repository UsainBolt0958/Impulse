import { describe, expect, it } from 'vitest';
import {
  buildImportedPyqQuestion,
  parsePyqImport,
  validatePyqImport,
} from './pyqImportFormat';

const target = {
  exam: 'JEE MAINS',
  subject: 'Physics',
  chapter: 'Mechanics',
  questionCount: 1,
};

function makeManifest() {
  return {
    schemaVersion: 1,
    expectedQuestionCount: 1,
    questions: [{
      id: 'JEE-P-2024-001',
      year: 2024,
      shift: 'Shift 1',
      difficulty: 'Hard',
      type: 'MCQ',
      text: 'Question statement',
      image: 'question.svg',
      options: {
        A: { text: 'First', image: 'option-a.svg' },
        B: 'Second',
        C: 'Third',
        D: 'Fourth',
      },
      answer: 'A',
      solution: 'Worked solution',
    }],
  };
}

describe('PYQ import format', () => {
  it('parses valid JSON and validates counts and question/option SVG references', () => {
    const manifest = parsePyqImport(JSON.stringify(makeManifest()));
    const result = validatePyqImport(manifest, [
      { name: 'question.svg' },
      { name: 'option-a.svg' },
    ], target);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects JSON values that are not manifest objects', () => {
    expect(() => parsePyqImport('null')).toThrow('must contain a manifest object');
    expect(() => parsePyqImport('not-json')).toThrow('Invalid JSON');
  });

  it('maps PYQ metadata, answers, solutions, and question/option images to the library shape', () => {
    const question = buildImportedPyqQuestion(makeManifest().questions[0], target, {
      'question.svg': '/uploads/question.svg',
      'option-a.svg': '/uploads/option-a.svg',
    }, 'Impulse Admin');

    expect(question).toMatchObject({
      source_id: 'JEE-P-2024-001',
      exam: 'JEE MAINS',
      exam_slug: 'jee-mains',
      year: 2024,
      shift: 'Shift 1',
      subject: 'Physics',
      chapter: 'Mechanics',
      difficulty: 'Hard',
      type: 'MCQ',
      question_text: 'Question statement',
      image: '/uploads/question.svg',
      question_image: '/uploads/question.svg',
      option_images: { A: '/uploads/option-a.svg', B: '', C: '', D: '' },
      correct_answer: 'A',
      solution: 'Worked solution',
      explanation: 'Worked solution',
    });
  });

  it('rejects count mismatches, missing images, duplicate IDs, invalid answers, and malformed options', () => {
    const manifest = makeManifest();
    manifest.expectedQuestionCount = 2;
    manifest.questions[0].image = 'missing.svg';
    manifest.questions[0].answer = 'Z';
    manifest.questions[0].options.D = '';
    manifest.questions.push({ ...manifest.questions[0] });

    const { errors } = validatePyqImport(manifest, [], target);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('expectedQuestionCount (2) must match'),
      expect.stringContaining('contains 2 question(s), but 1 were selected'),
      expect.stringContaining('referenced image "missing.svg" was not uploaded'),
      expect.stringContaining('answer must be one option key'),
      expect.stringContaining('must contain text or an image'),
      expect.stringContaining('is duplicated in the JSON'),
    ]));
  });

  it('accepts numeric PYQs with numeric zero answers and no options', () => {
    const manifest = makeManifest();
    manifest.questions[0] = {
      year: 2023,
      shift: 'Paper 2',
      difficulty: 'Easy',
      type: 'NUMERIC',
      text: 'Enter a number',
      answer: 0,
    };

    const result = validatePyqImport(manifest, [], target);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(buildImportedPyqQuestion(manifest.questions[0], target, {}, 'Impulse Admin'))
      .toMatchObject({ type: 'NUM', correct_answer: '0' });
  });

  it('requires a year and one of the supported difficulties for every question', () => {
    const manifest = makeManifest();
    manifest.questions[0].text = '  ';
    manifest.questions[0].image = '';
    delete manifest.questions[0].year;
    manifest.questions[0].shift = '';
    delete manifest.questions[0].difficulty;

    const { errors } = validatePyqImport(manifest, [], target);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('must contain question text or an image'),
      expect.stringContaining('year must be a whole number'),
      expect.stringContaining('shift is required'),
      expect.stringContaining('difficulty must be Easy, Medium, or Hard'),
    ]));
  });

  it('normalizes supported difficulty labels and maps them into PYQ records', () => {
    const manifest = makeManifest();
    manifest.questions[0].difficulty = 'easy';
    const result = validatePyqImport(manifest, [{ name: 'question.svg' }, { name: 'option-a.svg' }], target);

    expect(result.errors).toEqual([]);
    expect(buildImportedPyqQuestion(manifest.questions[0], target, {
      'question.svg': '/uploads/question.svg',
      'option-a.svg': '/uploads/option-a.svg',
    }, 'Impulse Admin').difficulty).toBe('Easy');
  });

  it('rejects source IDs already used in the selected exam, subject, and chapter', () => {
    const { errors } = validatePyqImport(makeManifest(), [], target, [{
      exam: target.exam,
      subject: target.subject,
      chapter: target.chapter,
      source_id: 'jee-p-2024-001',
    }]);

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('already exists in the selected exam, subject, and chapter'),
    ]));
  });

  it('rejects duplicate image filenames and question batches above the limit', () => {
    const { errors } = validatePyqImport(makeManifest(), [
      { name: 'question.svg' },
      { name: 'QUESTION.SVG' },
    ], { ...target, questionCount: 201 });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('selected question count must be a whole number from 1 to 200'),
      expect.stringContaining('More than one uploaded image is named'),
    ]));
  });
});
