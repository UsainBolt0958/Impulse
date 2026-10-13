import { useState, useEffect } from 'react';

const SOLVED_KEY = 'impulse_solved';
const LEGACY_SOLVED_KEY = 'examforge_solved';

function migrateSolvedIfNeeded() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(SOLVED_KEY);
  const legacy = localStorage.getItem(LEGACY_SOLVED_KEY);
  if (!current && legacy) {
    localStorage.setItem(SOLVED_KEY, legacy);
  }
}

function readStoredSolvedQuestions() {
  if (typeof window === 'undefined') return [];

  migrateSolvedIfNeeded();
  const stored = localStorage.getItem(SOLVED_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function useSolvedQuestions() {
  const [solvedQuestions, setSolvedQuestions] = useState(() => readStoredSolvedQuestions());

  useEffect(() => {
    setSolvedQuestions(readStoredSolvedQuestions());
  }, []);

  const addSolvedQuestion = (questionId, isCorrect, timeTaken) => {
    const newSolved = {
      question_id: questionId,
      is_correct: isCorrect,
      time_taken: timeTaken,
      timestamp: new Date().toISOString()
    };

    const updated = [...solvedQuestions, newSolved];
    setSolvedQuestions(updated);
    localStorage.setItem(SOLVED_KEY, JSON.stringify(updated));
  };

  const isQuestionSolved = (questionId) => {
    return solvedQuestions.some(sq => sq.question_id === questionId);
  };

  const getQuestionAttempts = (questionId) => {
    return solvedQuestions.filter(sq => sq.question_id === questionId);
  };

  const getTotalSolved = () => {
    return new Set(solvedQuestions.map(sq => sq.question_id)).size;
  };

  const getCorrectCount = () => {
    const uniqueCorrect = new Set();
    solvedQuestions.forEach(sq => {
      if (sq.is_correct) {
        uniqueCorrect.add(sq.question_id);
      }
    });
    return uniqueCorrect.size;
  };

  const getAccuracy = () => {
    const total = getTotalSolved();
    if (total === 0) return 0;
    return ((getCorrectCount() / total) * 100).toFixed(1);
  };

  const getCurrentStreak = () => {
    if (solvedQuestions.length === 0) return 0;

    const sortedByDate = [...solvedQuestions].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    const dateSet = new Set();
    sortedByDate.forEach(sq => {
      const date = new Date(sq.timestamp);
      date.setHours(0, 0, 0, 0);
      dateSet.add(date.getTime());
    });

    while (dateSet.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  };

  return {
    solvedQuestions,
    addSolvedQuestion,
    isQuestionSolved,
    getQuestionAttempts,
    getTotalSolved,
    getCorrectCount,
    getAccuracy,
    getCurrentStreak
  };
}