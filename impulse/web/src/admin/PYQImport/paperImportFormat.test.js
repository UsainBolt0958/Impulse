import { describe, expect, it } from 'vitest';
import { buildAnswerKeyFromQuestions, buildExamConfig } from '@/lib/testSeriesEngine';
import {
  buildImportedJeeMainsPaperQuestions,
  parseJeeMainsPaperImport,
  validateJeeMainsPaperImport,
  buildImportedPaperQuestions,
  buildDynamicPaperSections,
  validatePaperImport,
} from './paperImportFormat';

function makePaper() {
  return {
    schemaVersion: 1,
    exam: 'JEE MAINS',
    year: 2025,
    shiftName: '22 January 2025 - Shift 1',
    expectedQuestionCount: 2,
    questions: [
      {
        id: 'JEE-MAINS-2025-01-22-S1-PHY-001',
        subject: 'Physics',
        chapter: 'Electrostatics',
        difficulty: 'Medium',
        type: 'MCQ',
        text: 'Question statement',
        image: 'PHY-001-Q.svg',
        options: {
          A: { text: 'First', image: 'PHY-001-OPT-A.svg' },
          B: 'Second',
          C: 'Third',
          D: 'Fourth',
        },
        answer: 'A',
        solution: 'Worked solution',
      },
      {
        id: 'JEE-MAINS-2025-01-22-S1-MATH-001',
        subject: 'Mathematics',
        chapter: 'Circle',
        difficulty: 'Hard',
        type: 'NUM',
        text: 'Enter a value',
        answer: 0,
        solution: 'The answer is zero.',
      },
    ],
  };
}

describe('JEE Main paper import format', () => {
  it('parses and validates a full paper with one shared year and shift', () => {
    const manifest = parseJeeMainsPaperImport(JSON.stringify(makePaper()));
    const result = validateJeeMainsPaperImport(manifest, [
      { name: 'PHY-001-Q.svg' },
      { name: 'PHY-001-OPT-A.svg' },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('maps every subject, chapter, year, difficulty, shared shift, answers, and images to PYQ records', () => {
    const questions = buildImportedJeeMainsPaperQuestions(makePaper(), {
      'phy-001-q.svg': '/uploads/question.svg',
      'phy-001-opt-a.svg': '/uploads/option.svg',
    }, 'Impulse Admin');

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      source_id: 'JEE-MAINS-2025-01-22-S1-PHY-001',
      exam: 'JEE MAINS',
      exam_slug: 'jee-mains',
      year: 2025,
      shift: '22 January 2025 - Shift 1',
      subject: 'Physics',
      chapter: 'Electrostatics',
      difficulty: 'Medium',
      image: '/uploads/question.svg',
      question_image: '/uploads/question.svg',
      option_images: { A: '/uploads/option.svg', B: '', C: '', D: '' },
      correct_answer: 'A',
      solution: 'Worked solution',
    });
    expect(questions[1]).toMatchObject({
      year: 2025,
      shift: '22 January 2025 - Shift 1',
      subject: 'Mathematics',
      chapter: 'Circle',
      difficulty: 'Hard',
      type: 'NUM',
      correct_answer: '0',
    });
  });

  it('builds ordered dynamic-engine sections with correct answers, media, and exam markings', () => {
    const importedQuestions = buildImportedPaperQuestions(makePaper(), {
      'phy-001-q.svg': '/uploads/question.svg',
      'phy-001-opt-a.svg': '/uploads/option.svg',
    }, 'Impulse Admin').map((question, index) => ({
      ...question,
      id: `question-${index + 1}`,
    }));
    const sections = buildDynamicPaperSections(importedQuestions);

    expect(sections.map((section) => [section.subject, section.type])).toEqual([
      ['Physics', 'MCQ'],
      ['Mathematics', 'NUM'],
    ]);
    expect(sections[0]).toMatchObject({
      sectionName: 'PHYSICS-MCQ',
      questionCount: 1,
      posMarks: 4,
      negMarks: 1,
      markingScheme: { correct: 4, wrong: -1, unanswered: 0 },
    });
    expect(sections[0].questions[0]).toMatchObject({
      id: 'question-1',
      text: 'Question statement',
      imageUrl: '/uploads/question.svg',
      answer: 'A',
      options: [
        { key: 'A', text: 'First', imageUrl: '/uploads/option.svg' },
        { key: 'B', text: 'Second', imageUrl: '' },
        { key: 'C', text: 'Third', imageUrl: '' },
        { key: 'D', text: 'Fourth', imageUrl: '' },
      ],
    });
    expect(sections[1]).toMatchObject({
      sectionName: 'MATHEMATICS-NUM',
      posMarks: 4,
      negMarks: 0,
      questions: [{ answer: '0', options: [] }],
    });
  });

  it('feeds imported sections and answers into the dynamic engine configuration', () => {
    const questions = buildImportedPaperQuestions(makePaper(), {}, 'Impulse Admin')
      .map((question, index) => ({ ...question, id: `question-${index + 1}` }));
    const sections = buildDynamicPaperSections(questions);
    const test = { id: 'paper-test', seriesId: 'papers-series', sections, durationMinutes: 180 };
    const config = buildExamConfig(
      { id: 'papers-series', durationMinutes: 180 },
      test
    );
    const answerKey = buildAnswerKeyFromQuestions([], { sections });

    expect(config.subjects).toEqual(['Physics', 'Mathematics']);
    expect(config.sections['PHYSICS-MCQ']).toEqual([1, 'MCQ', 4, 1]);
    expect(config.sections['MATHEMATICS-NUM']).toEqual([1, 'NUM', 4, 0]);
    expect(config.duration).toBe(180);
    expect(answerKey.Physics['PHYSICS-MCQ']).toEqual(['A']);
    expect(answerKey.Mathematics['MATHEMATICS-NUM']).toEqual(['0']);
  });

  it('requires valid count, paper metadata, and question subject/chapter/difficulty', () => {
    const manifest = makePaper();
    manifest.expectedQuestionCount = 3;
    manifest.year = '2025';
    manifest.shiftName = '';
    manifest.questions[0].subject = 'Biology';
    manifest.questions[1].chapter = '';
    delete manifest.questions[1].difficulty;

    const { errors } = validateJeeMainsPaperImport(manifest, []);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('year must be a whole number from 2002 through'),
      expect.stringContaining('shiftName is required'),
      expect.stringContaining('expectedQuestionCount is 3'),
      expect.stringContaining('subject must be Physics, Chemistry, Mathematics'),
      expect.stringContaining('.chapter is required'),
      expect.stringContaining('.difficulty must be Easy, Medium, or Hard'),
    ]));
  });

  it('rejects duplicate question IDs, existing paper IDs, and per-question shift/year overrides', () => {
    const manifest = makePaper();
    manifest.questions[1].id = manifest.questions[0].id;
    manifest.questions[1].year = 2024;
    manifest.questions[1].shiftName = 'Another shift';

    const { errors } = validateJeeMainsPaperImport(manifest, [], [{
      exam: 'JEE MAINS',
      year: 2025,
      shift: manifest.shiftName,
      source_id: manifest.questions[0].id.toLocaleLowerCase(),
    }]);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('is duplicated in this paper'),
      expect.stringContaining('already exists for this exam, year, and shift'),
      expect.stringContaining('year must not be set'),
      expect.stringContaining('must not set a shift'),
    ]));
  });

  it('blocks missing image references and duplicate uploaded filenames', () => {
    const manifest = makePaper();
    manifest.questions[0].image = 'missing.svg';
    const { errors } = validateJeeMainsPaperImport(manifest, [
      { name: 'PHY-001-OPT-A.svg' },
      { name: 'phy-001-opt-a.SVG' },
    ]);

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('referenced image "missing.svg" was not uploaded'),
      expect.stringContaining('More than one uploaded image is named'),
    ]));
  });

  it('warns about missing solutions and rejects unsupported image file types', () => {
    const manifest = makePaper();
    delete manifest.questions[1].solution;
    manifest.questions[0].image = 'diagram.gif';
    const { errors, warnings } = validateJeeMainsPaperImport(manifest, []);

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('unsupported image type'),
    ]));
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('has no solution text'),
    ]));
  });

  it('imports NEET questions and normalizes Botany or Zoology to Biology', () => {
    const manifest = makePaper();
    manifest.exam = 'NEET';
    manifest.questions = [manifest.questions[0], {
      ...manifest.questions[1],
      id: 'NEET-2025-BIO-001',
      subject: 'Botany',
    }];
    manifest.expectedQuestionCount = 2;

    const { errors } = validatePaperImport(manifest, [
      { name: 'PHY-001-Q.svg' },
      { name: 'PHY-001-OPT-A.svg' },
    ], [], 'NEET');
    expect(errors).toEqual([]);
    expect(buildImportedPaperQuestions(manifest, {}, 'Impulse Admin')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exam: 'NEET', exam_slug: 'neet', subject: 'Biology' }),
      ])
    );
  });

  it('imports MHT CET papers with Mathematics or Biology and canonicalizes the exam name', () => {
    const manifest = makePaper();
    manifest.exam = 'MHT CET';
    const imageFiles = [
      { name: 'PHY-001-Q.svg' },
      { name: 'PHY-001-OPT-A.svg' },
    ];
    const { errors } = validatePaperImport(manifest, imageFiles, [], 'MHTCET');

    expect(errors).toEqual([]);
    expect(buildImportedPaperQuestions(manifest, {}, 'Impulse Admin')[0]).toMatchObject({
      exam: 'MHTCET',
      exam_slug: 'mhtcet',
    });

    manifest.questions[1].subject = 'Biology';
    expect(validatePaperImport(manifest, imageFiles, [], 'MHTCET').errors).toEqual([]);
  });

  it('rejects papers whose exam does not match the selected importer', () => {
    const manifest = makePaper();
    manifest.exam = 'NEET';

    const { errors } = validatePaperImport(manifest, [], [], 'MHTCET');
    expect(errors).toContain('exam must be "MHTCET" for this importer.');
  });
});
