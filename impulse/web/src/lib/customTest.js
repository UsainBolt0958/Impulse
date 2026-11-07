import {
  CUSTOM_DIFFICULTIES,
  getQuestionType,
  MAX_QUESTIONS_PER_SUBJECT,
  selectCustomTestQuestions,
  selectCustomTestQuestionsBySubject,
} from '../../../shared/customTestSelection.js';

export {
  CUSTOM_DIFFICULTIES,
  getQuestionType,
  MAX_QUESTIONS_PER_SUBJECT,
  selectCustomTestQuestions,
  selectCustomTestQuestionsBySubject,
};

export const CUSTOM_TEST_SESSION_KEY = 'impulse_custom_test_session';
export const CUSTOM_TEST_RESULTS_KEY = 'impulse_custom_test_results';

export function normalizeCustomAnswer(value) {
  const normalized = String(value ?? '').trim();
  if (/^[-+]?(?:\d+|\d*\.\d+)$/.test(normalized)) return Number(normalized);
  return normalized.replace(/^\+/, '');
}

export function addCustomTestTimeSpent(timeSpent = {}, elapsedByQuestion = {}) {
  const updatedTimeSpent = { ...timeSpent };
  Object.entries(elapsedByQuestion).forEach(([questionId, elapsed]) => {
    const seconds = Number(elapsed);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    updatedTimeSpent[questionId] = (Number(updatedTimeSpent[questionId]) || 0) + seconds;
  });
  return updatedTimeSpent;
}

export function calculateCustomTestResults(session, submittedAt = Date.now()) {
  const answers = session.answers || {};
  const timeSpent = session.timeSpent || {};
  const marks = session.marks || {};
  let positiveMarks = 0;
  let negativeMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let attemptedCount = 0;
  let totalTimeSpent = 0;

  const questionResults = session.questions.map((question, index) => {
    const answer = answers[question.id] ?? '';
    const hasAnswer = String(answer).trim() !== '';
    const questionType = getQuestionType(question);
    const correctAnswer = question.correct_answer ?? question.answer ?? '';
    const isCorrect = hasAnswer
      && normalizeCustomAnswer(answer) === normalizeCustomAnswer(correctAnswer);
    const time = Math.max(0, Number(timeSpent[question.id]) || 0);
    const points = hasAnswer
      ? (isCorrect ? Number(marks[questionType]?.correct ?? 4) : Number(marks[questionType]?.wrong ?? (questionType === 'NUM' ? 0 : -1)))
      : 0;

    if (hasAnswer) {
      attemptedCount += 1;
      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongCount += 1;
      }
      if (points >= 0) positiveMarks += points;
      else negativeMarks += Math.abs(points);
    }
    totalTimeSpent += time;

    return {
      index: index + 1,
      questionId: question.id,
      subject: question.subject || 'Unspecified',
      chapter: question.chapter || 'Unspecified',
      difficulty: question.difficulty || 'Unspecified',
      questionType,
      question,
      answer,
      correctAnswer,
      hasAnswer,
      isCorrect,
      marks: points,
      timeSpent: time,
    };
  });

  const totalQuestions = session.questions.length;
  const maxScore = questionResults.reduce(
    (total, result) => total + Number(marks[result.questionType]?.correct ?? 4),
    0,
  );
  const score = positiveMarks - negativeMarks;
  const elapsedSeconds = Math.max(0, Math.floor((submittedAt - session.startedAt) / 1000));

  return {
    id: session.id,
    exam: session.exam,
    difficulty: session.difficulty,
    startedAt: session.startedAt,
    submittedAt,
    durationSeconds: session.durationSeconds,
    elapsedSeconds,
    totalQuestions,
    attemptedCount,
    correctCount,
    wrongCount,
    unattemptedCount: totalQuestions - attemptedCount,
    positiveMarks,
    negativeMarks,
    score,
    maxScore,
    accuracy: attemptedCount ? Number(((correctCount / attemptedCount) * 100).toFixed(1)) : 0,
    efficiency: maxScore ? Number(((score / maxScore) * 100).toFixed(1)) : 0,
    totalTimeSpent,
    averageTimePerQuestion: totalQuestions ? Number((totalTimeSpent / totalQuestions).toFixed(1)) : 0,
    questionResults,
    subjects: session.subjects,
    marks: session.marks,
  };
}
