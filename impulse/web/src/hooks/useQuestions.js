import { useState, useEffect } from 'react';
import { loadPublicQuestionsFromServer, savePortalStateToServer } from '@/lib/portalServer';

const QUESTIONS_KEY = 'impulse_questions';
const LEGACY_QUESTIONS_KEY = 'examforge_questions';

function migrateQuestionsIfNeeded() {
  if (typeof window === 'undefined') return;
  const current = localStorage.getItem(QUESTIONS_KEY);
  const legacy = localStorage.getItem(LEGACY_QUESTIONS_KEY);
  if (!current && legacy) {
    localStorage.setItem(QUESTIONS_KEY, legacy);
  }
}

function readStoredQuestions() {
  if (typeof window === 'undefined') return [];

  migrateQuestionsIfNeeded();
  const stored = localStorage.getItem(QUESTIONS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function useQuestions() {
  const [questions, setQuestions] = useState(() => readStoredQuestions());
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    exam: [],
    difficulty: [],
    chapter: [],
    subject: [],
    year: []
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const localQuestions = readStoredQuestions();
        if (localQuestions.length && active) {
          setQuestions(localQuestions);
        }

        const remoteQuestions = await loadPublicQuestionsFromServer();
        if (remoteQuestions.length) {
          if (active) setQuestions(remoteQuestions);
        } else if (localQuestions.length) {
          await savePortalStateToServer({ questions: localQuestions, exams: [], profile: {}, activity: [] });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const getFilteredQuestions = () => {
    return questions.filter(q => {
      if (filters.exam.length > 0 && !filters.exam.includes(q.exam)) return false;
      if (filters.difficulty.length > 0 && !filters.difficulty.includes(q.difficulty)) return false;
      if (filters.chapter.length > 0 && !filters.chapter.includes(q.chapter)) return false;
      if (filters.subject.length > 0 && !filters.subject.includes(q.subject)) return false;
      if (filters.year.length > 0 && !filters.year.includes(q.year)) return false;
      return true;
    });
  };

  const getQuestionById = (id) => {
    return questions.find(q => q.id === id);
  };

  const getUniqueValues = (field) => {
    return [...new Set(questions.map(q => q[field]))].sort();
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      exam: [],
      difficulty: [],
      chapter: [],
      subject: [],
      year: []
    });
  };

  return {
    questions,
    isLoading,
    filteredQuestions: getFilteredQuestions(),
    filters,
    updateFilters,
    clearFilters,
    getQuestionById,
    getUniqueValues
  };
}