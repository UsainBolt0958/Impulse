import { describe, expect, it } from 'vitest';
import {
  buildImportedSections,
  parseTestImport,
  validateTestImport,
} from './testImportFormat';
import { buildExamConfig, buildAnswerKeyFromQuestions } from '@/lib/testSeriesEngine';

function makeManifest() {
  return {
    schemaVersion: 1,
    test: {
      title: 'Sample test',
      durationMinutes: 180,
      expectedQuestionCount: 3,
    },
    subjects: [
      {
        name: 'Physics',
        sections: [
          {
            name: 'PHY-A',
            type: 'MCQ',
            expectedQuestionCount: 1,
            marking: { correct: 4, wrong: -1, unanswered: 0 },
            questions: [
              {
                id: 'PHY-A-001',
                number: '12',
                text: 'Question text',
                image: 'PHY-A-001.svg',
                options: [
                  { key: 'A', text: 'One' },
                  { key: 'B', text: 'Two' },
                  { key: 'C', text: 'Three' },
                  { key: 'D', text: 'Four' },
                ],
                answer: 'B',
                solution: 'Worked solution',
              },
            ],
          },
        ],
      },
      {
        name: 'Chemistry',
        sections: [
          {
            name: 'CHEM-B',
            type: 'MULTI',
            expectedQuestionCount: 1,
            marking: { correct: 4, wrong: -2, unanswered: 0 },
            questions: [
              {
                id: 'CHEM-B-001',
                text: 'Select all that apply',
                options: [
                  { key: 'A', text: 'One' },
                  { key: 'B', text: 'Two' },
                  { key: 'C', text: 'Three' },
                  { key: 'D', text: 'Four' },
                ],
                answer: ['A', 'C'],
                solution: 'Worked solution',
              },
            ],
          },
        ],
      },
      {
        name: 'Mathematics',
        sections: [
          {
            name: 'MATH-N',
            type: 'NUM',
            expectedQuestionCount: 1,
            marking: { correct: 4, wrong: 0, unanswered: 0 },
            questions: [
              {
                id: 'MATH-N-001',
                text: 'Enter a number',
                answer: { min: -2.5, max: -2.25 },
                solution: 'Worked solution',
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('test import format', () => {
  it('parses and validates a manifest with MCQ, MULTI, NUM, and SVG assets', () => {
    const manifest = parseTestImport(JSON.stringify(makeManifest()));
    const validation = validateTestImport(manifest, [{ name: 'PHY-A-001.svg' }]);

    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it('maps section markings and answers to the existing test schema', () => {
    const sections = buildImportedSections(makeManifest(), 'test-1', {
      'phy-a-001.svg': '/uploads/image.svg',
    });

    expect(sections.map((section) => section.subject)).toEqual([
      'Physics',
      'Chemistry',
      'Mathematics',
    ]);
    expect(sections[0].posMarks).toBe(4);
    expect(sections[0].negMarks).toBe(1);
    expect(sections[0].markingScheme).toEqual({ correct: 4, wrong: -1, unanswered: 0 });
    expect(sections[0].questions[0]).toMatchObject({
      sourceId: 'PHY-A-001',
      sourceNumber: '12',
      imageUrl: '/uploads/image.svg',
      answer: 'B',
      solution: 'Worked solution',
    });
    expect(sections[1].questions[0].answer).toBe('AC');
    expect(sections[2].questions[0].answer).toEqual({ min: -2.5, max: -2.25 });
  });

  it('builds test-specific exam settings and answer keys from imported sections', () => {
    const sections = buildImportedSections(makeManifest(), 'test-1', {
      'phy-a-001.svg': '/uploads/image.svg',
    });
    const test = { id: 'test-1', seriesId: 'series-1', subjects: ['Physics'], sections };
    const config = buildExamConfig(
      { id: 'series-1', subjects: ['Outdated subject'], sections: [{ name: 'OLD', type: 'MCQ' }] },
      test
    );
    const answerKey = buildAnswerKeyFromQuestions([], { sections });

    expect(config.subjects).toEqual(['Physics']);
    expect(config.sections['PHY-A']).toEqual([1, 'MCQ', 4, 1]);
    expect(config.marking['PHY-A']).toMatchObject({ posMarks: 4, negMarks: 1 });
    expect(answerKey.Physics['PHY-A']).toEqual(['B']);
    expect(answerKey.Chemistry['CHEM-B']).toEqual(['AC']);
  });

  it('reports subject/section duplicates, answer and image issues, and count mismatches', () => {
    const manifest = makeManifest();
    manifest.subjects[1].name = 'physics';
    manifest.subjects[1].sections[0].name = 'PHY-A';
    manifest.subjects[1].sections[0].expectedQuestionCount = 2;
    manifest.subjects[1].sections[0].questions[0].answer = ['A', 'A', 'Z'];
    manifest.subjects[0].sections[0].questions[0].image = 'missing.svg';

    const { errors } = validateTestImport(manifest);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Duplicate subject name'),
      expect.stringContaining('Section name "PHY-A" is repeated'),
      expect.stringContaining('declares 2 questions but contains 1'),
      expect.stringContaining('referenced image "missing.svg" was not uploaded'),
      expect.stringContaining('MULTI answer must be a non-empty array'),
    ]));
  });

  it('rejects unsigned wrong-answer marks, non-four-option questions, and repeated question IDs', () => {
    const manifest = makeManifest();
    manifest.subjects[0].sections[0].marking.wrong = 1;
    manifest.subjects[0].sections[0].questions[0].options.pop();
    manifest.subjects[1].sections[0].questions[0].id = 'PHY-A-001';

    const { errors } = validateTestImport(manifest);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('positive correct marks, non-positive wrong marks'),
      expect.stringContaining('exactly four options'),
      expect.stringContaining('Question ID "PHY-A-001" is duplicated'),
    ]));
  });

  it('accepts zero as a numeric answer and warns rather than blocking absent solution text', () => {
    const manifest = makeManifest();
    const numericQuestion = manifest.subjects[2].sections[0].questions[0];
    numericQuestion.answer = 0;
    delete numericQuestion.solution;

    const { errors, warnings } = validateTestImport(manifest, [{ name: 'PHY-A-001.svg' }]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('(MATH-N-001) has no solution text'),
    ]));
    expect(buildImportedSections(manifest, 'test-1')[2].questions[0].answer).toBe(0);
  });
});
