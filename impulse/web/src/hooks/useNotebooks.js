import { useCallback, useEffect, useState } from 'react';

const NOTEBOOKS_KEY = 'impulse_notebooks';
const NOTEBOOKS_UPDATED_EVENT = 'impulse:notebooks:updated';

function readNotebooks() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(NOTEBOOKS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(notebook =>
      notebook &&
      typeof notebook.id === 'string' &&
      typeof notebook.name === 'string' &&
      Array.isArray(notebook.questionIds)
    );
  } catch {
    return [];
  }
}

function writeNotebooks(notebooks) {
  window.localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(notebooks));
  window.dispatchEvent(new Event(NOTEBOOKS_UPDATED_EVENT));
}

function createNotebookId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState(readNotebooks);

  useEffect(() => {
    const refresh = () => setNotebooks(readNotebooks());
    const handleStorage = event => {
      if (event.key === NOTEBOOKS_KEY) refresh();
    };

    window.addEventListener(NOTEBOOKS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(NOTEBOOKS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const createNotebook = useCallback((name) => {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return null;

    const current = readNotebooks();
    const notebook = {
      id: createNotebookId(),
      name: trimmedName,
      questionIds: [],
      createdAt: new Date().toISOString(),
    };
    writeNotebooks([...current, notebook]);
    return notebook;
  }, []);

  const addQuestionToNotebook = useCallback((notebookId, questionId) => {
    const current = readNotebooks();
    let wasAdded = false;
    const updated = current.map(notebook => {
      if (notebook.id !== notebookId || notebook.questionIds.includes(questionId)) {
        return notebook;
      }
      wasAdded = true;
      return { ...notebook, questionIds: [...notebook.questionIds, questionId] };
    });

    if (wasAdded) writeNotebooks(updated);
    return wasAdded;
  }, []);

  const removeQuestionFromNotebooks = useCallback((questionId) => {
    const current = readNotebooks();
    let wasRemoved = false;
    const updated = current.map(notebook => {
      if (!notebook.questionIds.includes(questionId)) return notebook;
      wasRemoved = true;
      return {
        ...notebook,
        questionIds: notebook.questionIds.filter(id => id !== questionId),
      };
    });

    if (wasRemoved) writeNotebooks(updated);
    return wasRemoved;
  }, []);

  return { notebooks, createNotebook, addQuestionToNotebook, removeQuestionFromNotebooks };
}
