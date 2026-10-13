import { useState, useEffect } from 'react';

const MARKED_KEY = 'impulse_marked';
const LEGACY_MARKED_KEY = 'examforge_marked';

function migrateMarkedIfNeeded() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(MARKED_KEY);
  const legacy = localStorage.getItem(LEGACY_MARKED_KEY);
  if (!current && legacy) {
    localStorage.setItem(MARKED_KEY, legacy);
  }
}

export function useMarkedQuestions() {
  const [markedQuestions, setMarkedQuestions] = useState([]);

  useEffect(() => {
    migrateMarkedIfNeeded();
    const stored = localStorage.getItem(MARKED_KEY);
    if (stored) {
      setMarkedQuestions(JSON.parse(stored));
    }
  }, []);

  const toggleMark = (questionId) => {
    let updated;
    if (markedQuestions.includes(questionId)) {
      updated = markedQuestions.filter(id => id !== questionId);
    } else {
      updated = [...markedQuestions, questionId];
    }
    setMarkedQuestions(updated);
    localStorage.setItem(MARKED_KEY, JSON.stringify(updated));
  };

  const isMarked = (questionId) => {
    return markedQuestions.includes(questionId);
  };

  const getMarkedCount = () => {
    return markedQuestions.length;
  };

  return {
    markedQuestions,
    toggleMark,
    isMarked,
    getMarkedCount
  };
}