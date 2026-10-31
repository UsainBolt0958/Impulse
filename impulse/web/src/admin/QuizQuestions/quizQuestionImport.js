const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseQuizQuestionImport(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

export function validateQuizQuestionImport(manifest) {
  const errors = [];
  const questions = [];
  const sourceQuestions = Array.isArray(manifest) ? manifest : manifest?.questions;

  if (!Array.isArray(sourceQuestions) || sourceQuestions.length === 0) {
    return { errors: ['The JSON must contain a non-empty questions array.'], questions };
  }
  if (sourceQuestions.length > 500) {
    errors.push('A single import may contain at most 500 questions.');
  }

  sourceQuestions.forEach((question, index) => {
    const context = `Question ${index + 1}`;
    if (!isRecord(question)) {
      errors.push(`${context} must be an object.`);
      return;
    }

    const subjectValue = question.subject ?? manifest?.subject;
    const chapterValue = question.chapter ?? manifest?.chapter;
    const questionValue = question.question ?? question.question_text ?? question.text;
    const subject = typeof subjectValue === 'string' ? subjectValue.trim() : '';
    const chapter = typeof chapterValue === 'string' ? chapterValue.trim() : '';
    const questionText = typeof questionValue === 'string' ? questionValue.trim() : '';
    const rawOptions = question.options;
    const optionValues = Array.isArray(rawOptions)
      ? rawOptions
      : OPTION_KEYS.map((key) => rawOptions?.[key]);
    const answerValue = question.answer ?? question.correct_answer ?? question.correctAnswer;
    const answer = typeof answerValue === 'string' ? answerValue.trim().toUpperCase() : '';
    const missing = [];

    if (!subject) missing.push('subject (a non-empty string)');
    if (!chapter) missing.push('chapter (a non-empty string)');
    if (!questionText) missing.push('question text (a non-empty string)');
    if (!Array.isArray(rawOptions) && !isRecord(rawOptions)) missing.push('options');
    if (missing.length) {
      errors.push(`${context} is missing ${missing.join(', ')}.`);
      return;
    }
    if (optionValues.length !== OPTION_KEYS.length || optionValues.some(
      (option) => typeof option !== 'string' || !option.trim(),
    )) {
      errors.push(`${context} must provide four non-empty options (A, B, C, and D).`);
      return;
    }
    if (!OPTION_KEYS.includes(answer)) {
      errors.push(`${context} answer must be A, B, C, or D.`);
      return;
    }

    questions.push({
      subject,
      chapter,
      question_text: questionText,
      options: Object.fromEntries(OPTION_KEYS.map((key, optionIndex) => [
        key,
        optionValues[optionIndex].trim(),
      ])),
      correct_answer: answer,
      explanation: String(question.explanation ?? question.solution ?? '').trim(),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(question.difficulty)
        ? question.difficulty
        : 'Medium',
    });
  });

  return { errors, questions };
}
