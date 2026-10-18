import { describe, expect, it } from 'vitest';
import {
  getPaperImportChaptersRemovedByGroup,
  getPaperImportGroups,
  getPaperImportId,
} from './paperImportManagement';

describe('paper import management', () => {
  it('creates a stable paper identifier from exam, year, and whitespace-normalized shift', () => {
    expect(getPaperImportId({
      exam: 'JEE MAINS',
      year: 2025,
      shiftName: '  22 January 2025   - Shift 1 ',
    })).toBe('jee mains::2025::22 january 2025 - shift 1');
  });

  it('groups tagged paper questions by paper identifier', () => {
    const questions = [
      { id: 'q-1', paper_import_id: 'neet::2025::neet ug 2025', exam: 'NEET', year: 2025, shift: 'NEET UG 2025', subject: 'Biology', chapter: 'Botany' },
      { id: 'q-2', paper_import_id: 'neet::2025::neet ug 2025', exam: 'NEET', year: 2025, shift: 'NEET UG 2025', subject: 'Physics', chapter: 'Optics' },
      { id: 'q-3', exam: 'NEET', year: 2025, shift: 'NEET UG 2025', subject: 'Chemistry', chapter: 'Organic Chemistry' },
    ];

    const groups = getPaperImportGroups(questions);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      exam: 'NEET',
      year: 2025,
      questionIds: ['q-1', 'q-2'],
      chapters: ['Biology / Botany', 'Physics / Optics'],
    });
  });

  it('recognizes papers imported before explicit paper identifiers were stored', () => {
    const questions = [
      { id: 'q-1', exam: 'MHTCET', year: 2024, shift: 'PCM Shift 1', subject: 'Mathematics', chapter: 'Vectors' },
      { id: 'q-2', exam: 'MHTCET', year: 2024, shift: 'PCM Shift 1', subject: 'Physics', chapter: 'Optics' },
      { id: 'q-3', exam: 'MHTCET', year: 2024, shift: 'PCM Shift 1', subject: 'Chemistry', chapter: 'Solutions' },
    ];
    const activity = [
      { source: 'mhtcet-paper-json-import', questionId: 'q-1' },
      { source: 'mhtcet-paper-json-import', questionId: 'q-2' },
      { source: 'manual', questionId: 'q-3' },
    ];

    expect(getPaperImportGroups(questions, activity)[0].questionIds).toEqual(['q-1', 'q-2']);
  });

  it('lists only chapters that will disappear after paper questions are removed', () => {
    const group = {
      questionIds: ['paper-q1', 'paper-q2'],
      questions: [
        { id: 'paper-q1', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Optics' },
        { id: 'paper-q2', exam: 'JEE MAINS', subject: 'Chemistry', chapter: 'Solutions' },
      ],
    };
    const allQuestions = [
      ...group.questions,
      { id: 'other-q', exam: 'JEE MAINS', subject: 'Physics', chapter: 'Optics' },
    ];

    expect(getPaperImportChaptersRemovedByGroup(group, allQuestions))
      .toEqual(['Chemistry / Solutions']);
  });
});
