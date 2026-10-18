import { useState, useEffect } from 'react';

const MARKED_KEY = 'impulse_marked';
const LEGACY_MARKED_KEY = 'examforge_marked';
const MARKED_UPDATED_EVENT = 'impulse:marked:updated';

function migrateMarkedIfNeeded() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(MARKED_KEY);
  const legacy = localStorage.getItem(LEGACY_MARKED_KEY);
  if (!current && legacy) {
    localStorage.setItem(MARKED_KEY, legacy);
  }
}

function readMarkedQuestions() {
  if (typeof window === 'undefined') return [];
  migrateMarkedIfNeeded();
  const stored = window.localStorage.getItem(MARKED_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function useMarkedQuestions() {
  const [markedQuestions, setMarkedQuestions] = useState(readMarkedQuestions);

  useEffect(() => {
    const refresh = () => setMarkedQuestions(readMarkedQuestions());
    const handleStorage = event => {
      if (event.key === MARKED_KEY) refresh();
    };

    window.addEventListener(MARKED_UPDATED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(MARKED_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleMark = (questionId) => {
    const current = readMarkedQuestions();
    let updated;
    if (current.includes(questionId)) {
      updated = current.filter(id => id !== questionId);
    } else {
      updated = [...current, questionId];
    }
    setMarkedQuestions(updated);
    window.localStorage.setItem(MARKED_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(MARKED_UPDATED_EVENT));
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