const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function getTestQuestionType(question) {
  const type = String(question?.type || '').trim().toUpperCase();
  return type === 'NUMERIC' ? 'NUM' : type;
}

function getContentQuestionType(content) {
  const type = String(content?.type || content?.question_type || '').trim().toUpperCase();
  return type === 'NUMERIC' ? 'NUM' : type;
}

function getOptionText(option) {
  if (typeof option === 'string') return option;
  return typeof option?.text === 'string' ? option.text : '';
}

function getOptionImage(content, key) {
  const option = content?.options?.[key];
  return content?.option_images?.[key]
    || (typeof option === 'object' && typeof option?.image === 'string' ? option.image : '')
    || '';
}

function getContentText(content) {
  return content?.question_text || content?.question || content?.text || '';
}

function getContentExplanation(content) {
  return content?.explanation || content?.solution || '';
}

function normalizeAnswer(value, type) {
  const answer = String(value ?? '').trim();
  return type === 'MCQ' ? answer.toUpperCase() : answer;
}

export function questionMatchesVersionedContent(question, content) {
  const type = getTestQuestionType(question);
  if (
    !question
    || !content
    || String(question.id || '') !== String(content.id || '')
    || type !== getContentQuestionType(content)
    || (question.text || '') !== getContentText(content)
    || (question.imageUrl || '') !== (content.image || content.question_image || '')
    || normalizeAnswer(question.answer, type)
      !== normalizeAnswer(content.correct_answer ?? content.answer, type)
    || (question.solution || question.explanation || '') !== getContentExplanation(content)
    || (question.explanation || question.solution || '') !== getContentExplanation(content)
  ) return false;

  if (type !== 'MCQ') return true;
  if (!Array.isArray(question.options) || question.options.length !== OPTION_KEYS.length) return false;

  return OPTION_KEYS.every((key, index) => {
    const option = question.options[index];
    return option?.key === key
      && (option.text || '') === getOptionText(content.options?.[key])
      && (option.imageUrl || '') === getOptionImage(content, key);
  });
}

function mapQuestionSections(test, mapQuestion) {
  if (!Array.isArray(test?.sections)) return test;
  return {
    ...test,
    sections: test.sections.map((section) => (
      Array.isArray(section?.questions)
        ? { ...section, questions: section.questions.map(mapQuestion) }
        : section
    )),
  };
}

export function compactVersionedTestQuestions(test, currentRows, versionRows = []) {
  const currentById = new Map(currentRows.map((row) => [row.question_id, row]));
  const versionByKey = new Map(versionRows.map((row) => [
    `${row.question_id}:${row.version}`,
    row,
  ]));

  return mapQuestionSections(test, (question) => {
    const reference = question?.questionRef;
    const row = reference
      ? versionByKey.get(`${reference.questionId}:${reference.version}`)
      : currentById.get(question?.id);
    if (!row || !questionMatchesVersionedContent(question, row.content)) {
      if (!reference) return question;
      return Object.fromEntries(Object.entries(question).filter(([key]) => key !== 'questionRef'));
    }

    const metadata = Object.fromEntries(Object.entries(question).filter(([key]) => (
      !['text', 'imageUrl', 'type', 'options', 'answer', 'solution', 'explanation', 'questionRef']
        .includes(key)
    )));
    return {
      ...metadata,
      questionRef: {
        questionId: row.question_id,
        version: row.version,
      },
    };
  });
}

function buildTestQuestion(question, content) {
  const type = getContentQuestionType(content);
  const options = type === 'NUM'
    ? []
    : OPTION_KEYS.map((key) => ({
      key,
      text: getOptionText(content.options?.[key]),
      imageUrl: getOptionImage(content, key),
    }));

  return {
    ...question,
    id: question.questionRef.questionId,
    text: getContentText(content),
    imageUrl: content.image || content.question_image || '',
    type,
    options,
    answer: content.correct_answer ?? content.answer ?? '',
    solution: content.solution || content.explanation || '',
    explanation: content.explanation || content.solution || '',
    subject: content.subject || question.subject || '',
  };
}

export function hydrateVersionedTestQuestions(test, versionRows) {
  const versionsByKey = new Map(versionRows.map((row) => [
    `${row.question_id}:${row.version}`,
    row,
  ]));
  return mapQuestionSections(test, (question) => {
    const reference = question?.questionRef;
    if (!reference) return question;
    const row = versionsByKey.get(`${reference.questionId}:${reference.version}`);
    if (!row || row.content?.id !== reference.questionId) {
      const error = new Error(
        `Question version ${reference.questionId}:${reference.version} referenced by test ${test.id} is missing.`,
      );
      error.statusCode = 503;
      throw error;
    }
    return buildTestQuestion(question, row.content);
  });
}

export function collectTestQuestionReferences(test) {
  return (test?.sections || []).flatMap((section) => (
    Array.isArray(section?.questions)
      ? section.questions
        .map((question) => question?.questionRef)
        .filter((reference) => reference
          && typeof reference.questionId === 'string'
          && Number.isInteger(reference.version)
          && reference.version > 0)
      : []
  ));
}
