export function getPYQPracticeQuestionSequence(questions, locationState, currentQuestion) {
  if (locationState?.from !== '/pyq-practice' || !locationState?.practiceState) {
    return questions;
  }

  const {
    selectedExam,
    selectedSubject,
    selectedChapter,
    appliedFilters = {},
  } = locationState.practiceState;
  const difficultyFilters = Array.isArray(appliedFilters.difficulty) ? appliedFilters.difficulty : [];
  const yearFilters = Array.isArray(appliedFilters.year) ? appliedFilters.year.map(String) : [];
  const sequence = questions.filter((question) => (
    question.exam === (selectedExam || currentQuestion?.exam)
    && question.subject === (selectedSubject || currentQuestion?.subject)
    && (!selectedChapter || question.chapter === selectedChapter)
    && (!difficultyFilters.length || difficultyFilters.includes(question.difficulty))
    && (!yearFilters.length || yearFilters.includes(String(question.year)))
  ));

  if (currentQuestion && !sequence.some((question) => question.id === currentQuestion.id)) {
    return [currentQuestion];
  }

  return sequence;
}

export function getPYQPracticeReturnState(locationState) {
  if (locationState?.from !== '/pyq-practice') return locationState;

  return {
    ...locationState,
    practiceState: {
      ...locationState.practiceState,
      step: 4,
    },
  };
}

export function getPYQPracticeExitState(locationState, question) {
  if (locationState?.practiceState) {
    return { practiceState: locationState.practiceState };
  }

  if (locationState?.from) {
    return {};
  }

  return {
    practiceState: {
      step: 4,
      selectedExam: question?.exam || null,
      selectedSubject: question?.subject || null,
      selectedChapter: question?.chapter || null,
      appliedFilters: { difficulty: [], year: [] },
      localFilters: { difficulty: [], year: [] },
    },
  };
}
