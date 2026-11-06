import { useState, useEffect, useMemo } from 'react';
import { loadPublicQuestionsFromServer } from '@/lib/portalServer';

export function useQuestions() {
  const [questions, setQuestions] = useState([]);
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
        const remoteQuestions = await loadPublicQuestionsFromServer();
        if (active) {
          setQuestions(remoteQuestions);
          ['impulse_questions', 'examforge_questions', 'impulse_seeded', 'examforge_seeded']
            .forEach((key) => window.localStorage.removeItem(key));
        }
      } catch (error) {
        console.error('Could not load questions from the server.', error);
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

  const filteredQuestions = useMemo(() => questions.filter(q => {
      if (filters.exam.length > 0 && !filters.exam.includes(q.exam)) return false;
      if (filters.difficulty.length > 0 && !filters.difficulty.includes(q.difficulty)) return false;
      if (filters.chapter.length > 0 && !filters.chapter.includes(q.chapter)) return false;
      if (filters.subject.length > 0 && !filters.subject.includes(q.subject)) return false;
      if (filters.year.length > 0 && !filters.year.includes(q.year)) return false;
      return true;
    }), [questions, filters]);

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
    filteredQuestions,
    filters,
    updateFilters,
    clearFilters,
    getQuestionById,
    getUniqueValues
  };
}