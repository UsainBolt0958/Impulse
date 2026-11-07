import { useState, useEffect } from 'react';
import {
  appendSolvedQuestionAttempts,
  SOLVED_QUESTIONS_KEY,
  SOLVED_QUESTIONS_UPDATED_EVENT,
} from '@/lib/solvedQuestions';

const LEGACY_SOLVED_KEY = 'examforge_solved';

function migrateSolvedIfNeeded() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(SOLVED_QUESTIONS_KEY);
  const legacy = localStorage.getItem(LEGACY_SOLVED_KEY);
  if (!current && legacy) {
    localStorage.setItem(SOLVED_QUESTIONS_KEY, legacy);
  }
}

function readStoredSolvedQuestions() {
  if (typeof window === 'undefined') return [];

  migrateSolvedIfNeeded();
  const stored = localStorage.getItem(SOLVED_QUESTIONS_KEY);
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
    const refresh = () => setSolvedQuestions(readStoredSolvedQuestions());
    const handleStorage = event => {
      if (event.key === SOLVED_QUESTIONS_KEY) refresh();
    };

    refresh();
    window.addEventListener(SOLVED_QUESTIONS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(SOLVED_QUESTIONS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const addSolvedQuestion = (questionId, isCorrect, timeTaken, question = {}) => {
    const newSolved = {
      question_id: questionId,
      exam: question.exam,
      subject: question.subject,
      chapter: question.chapter,
      difficulty: question.difficulty,
      is_correct: isCorrect,
      time_taken: timeTaken,
      timestamp: new Date().toISOString()
    };

    const updated = appendSolvedQuestionAttempts([newSolved]);
    setSolvedQuestions(updated);
  };

  const isQuestionSolved = (questionId) => {
    return solvedQuestions.some(sq => sq.question_id === questionId);
  };

  const getQuestionAttempts = (questionId) => {
    return solvedQuestions.filter(sq => sq.question_id === questionId);
  };

  const getUniqueAttemptedCount = () => {
    return new Set(solvedQuestions.map(sq => sq.question_id).filter(Boolean)).size;
  };

  const getTotalAttempts = () => {
    return solvedQuestions.filter(sq => sq.question_id).length;
  };

  const getUniqueSolvedCount = () => {
    const uniqueCorrect = new Set();
    solvedQuestions.forEach(sq => {
      if (sq.is_correct && sq.question_id) {
        uniqueCorrect.add(sq.question_id);
      }
    });
    return uniqueCorrect.size;
  };

  const getCorrectAttemptCount = () => {
    return solvedQuestions.filter(sq => sq.question_id && sq.is_correct === true).length;
  };

  const getAccuracy = () => {
    const total = getTotalAttempts();
    if (total === 0) return 0;
    return ((getCorrectAttemptCount() / total) * 100).toFixed(1);
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
    getTotalSolved: getUniqueAttemptedCount,
    getUniqueAttemptedCount,
    getTotalAttempts,
    getCorrectCount: getUniqueSolvedCount,
    getUniqueSolvedCount,
    getCorrectAttemptCount,
    getAccuracy,
    getCurrentStreak
  };
}