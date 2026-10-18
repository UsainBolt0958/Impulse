const PAPER_IMPORT_ACTIVITY_SOURCES = new Set([
  'jee-mains-paper-json-import',
  'neet-paper-json-import',
  'mhtcet-paper-json-import',
]);

function normalizePart(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function getPaperImportId(paper) {
  return [
    normalizePart(paper.exam),
    normalizePart(paper.year),
    normalizePart(paper.shiftName),
  ].join('::');
}

export function getPaperImportGroups(questions = [], activity = []) {
  const legacyImportedQuestionIds = new Set(activity
    .filter((entry) => PAPER_IMPORT_ACTIVITY_SOURCES.has(entry.source))
    .map((entry) => entry.questionId)
    .filter(Boolean));
  const groups = new Map();

  questions.forEach((question) => {
    const isPaperImported = Boolean(question.paper_import_id)
      || legacyImportedQuestionIds.has(question.id);
    if (!isPaperImported) return;

    const key = question.paper_import_id || getPaperImportId({
      exam: question.exam,
      year: question.year,
      shiftName: question.shift,
    });
    const group = groups.get(key) || {
      id: key,
      exam: question.exam,
      year: question.year,
      shift: question.shift,
      questions: [],
    };
    group.questions.push(question);
    groups.set(key, group);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      questionIds: group.questions.map((question) => question.id),
      chapters: [...new Set(group.questions
        .filter((question) => question.chapter)
        .map((question) => `${question.subject || 'General'} / ${question.chapter}`))],
    }))
    .sort((left, right) => (
      String(right.year).localeCompare(String(left.year))
      || left.exam.localeCompare(right.exam)
      || left.shift.localeCompare(right.shift)
    ));
}

export function getPaperImportChaptersRemovedByGroup(group, allQuestions) {
  const removedIds = new Set(group.questionIds);
  const remainingChapterKeys = new Set(allQuestions
    .filter((question) => !removedIds.has(question.id) && question.chapter)
    .map((question) => [
      normalizePart(question.exam),
      normalizePart(question.subject),
      normalizePart(question.chapter),
    ].join('::')));

  return [...new Set(group.questions
    .filter((question) => question.chapter)
    .filter((question) => !remainingChapterKeys.has([
      normalizePart(question.exam),
      normalizePart(question.subject),
      normalizePart(question.chapter),
    ].join('::')))
    .map((question) => `${question.subject || 'General'} / ${question.chapter}`))];
}
