import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import RichText from '@/components/RichText.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  LayoutGrid,
  Moon,
  Settings,
  Send,
  Sun,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  addCustomTestTimeSpent,
  calculateCustomTestResults,
  compactCustomTestResult,
  CUSTOM_TEST_RESULTS_KEY,
  CUSTOM_TEST_SESSION_KEY,
  getQuestionType,
} from '@/lib/customTest';
import {
  completeCustomTestCloudSession,
  CUSTOM_TEST_CLOUD_CHECKPOINT_INTERVAL_MS,
  loadCustomTestCloudSession,
  saveCustomTestCloudProgress,
} from '@/lib/customTestSessionSync';
import { appendSolvedQuestionAttempts } from '@/lib/solvedQuestions';

const LOCAL_SESSION_AUTOSAVE_INTERVAL_MS = 30_000;

function readSession() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_TEST_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Could not read custom test session', error);
    return null;
  }
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
}

function CustomTestExamPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(readSession);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(() => Number(session?.currentIndex) || 0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    return session ? Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)) : 0;
  });
  const [showPalette, setShowPalette] = useState(true);
  const [fontSize, setFontSize] = useState('medium');
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [activeSubject, setActiveSubject] = useState(() => (
    session?.questions?.[Number(session.currentIndex) || 0]?.subject
    || session?.subjects?.[0]?.name
    || ''
  ));
  const sessionRef = useRef(session);
  const currentQuestionIdRef = useRef(session?.questions?.[currentIndex]?.id);
  const pendingTimeSpentRef = useRef({});
  const submitRef = useRef(null);
  const isSubmittedRef = useRef(false);
  const saveErrorShownRef = useRef(false);
  const cloudSaveErrorShownRef = useRef(false);
  const cloudCheckpointRequestRef = useRef(Promise.resolve());

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem('theme');
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const nextIsDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);
      document.documentElement.classList.toggle('dark', nextIsDark);
      setIsDark(nextIsDark);

      const storedFontSize = window.localStorage.getItem('custom_test_font_size');
      if (['small', 'medium', 'large'].includes(storedFontSize)) setFontSize(storedFontSize);
    } catch (error) {
      console.error('Could not load custom test display settings', error);
      toast.error('Could not load saved display settings.');
    }
  }, []);

  const handleFontSizeChange = (nextFontSize) => {
    setFontSize(nextFontSize);
    try {
      window.localStorage.setItem('custom_test_font_size', nextFontSize);
    } catch (error) {
      console.error('Could not save custom test font size', error);
      toast.error('Could not save the font size setting.');
    }
  };

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    document.documentElement.classList.toggle('dark', nextIsDark);
    try {
      window.localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Could not save custom test theme', error);
      toast.error('Could not save the theme setting.');
    }
  };

  const questions = session?.questions || [];
  const question = questions[currentIndex] || null;
  const questionType = question ? getQuestionType(question) : 'MCQ';
  const isNumeric = questionType === 'NUM';
  const options = useMemo(() => {
    if (Array.isArray(question?.options)) {
      return question.options.map((option, index) => (
        typeof option === 'object' && option !== null
          ? [option.key ?? String.fromCharCode(65 + index), option.text ?? option.value ?? '']
          : [String.fromCharCode(65 + index), option]
      ));
    }
    return Object.entries(question?.options || {});
  }, [question]);

  const flushTimeSpent = useCallback((current = sessionRef.current) => {
    if (!current) return null;
    const elapsedByQuestion = pendingTimeSpentRef.current;
    if (!Object.keys(elapsedByQuestion).length) return current;
    pendingTimeSpentRef.current = {};
    return {
      ...current,
      timeSpent: addCustomTestTimeSpent(current.timeSpent, elapsedByQuestion),
    };
  }, []);

  const persistSession = useCallback((sessionToSave = sessionRef.current) => {
    if (!sessionToSave) return false;
    try {
      window.localStorage.setItem(CUSTOM_TEST_SESSION_KEY, JSON.stringify(sessionToSave));
      saveErrorShownRef.current = false;
      return true;
    } catch (error) {
      console.error('Could not save custom test progress', error);
      if (!saveErrorShownRef.current) {
        toast.error('Your browser could not save exam progress. Keep this tab open until submission.');
        saveErrorShownRef.current = true;
      }
      return false;
    }
  }, []);

  const updateSession = useCallback((updater) => {
    const current = flushTimeSpent();
    if (!current) return null;
    const updated = typeof updater === 'function' ? updater(current) : updater;
    const next = { ...updated, updatedAt: new Date().toISOString() };
    sessionRef.current = next;
    setSession(next);
    persistSession(next);
    return next;
  }, [flushTimeSpent, persistSession]);

  const checkpointCloudSession = useCallback(async () => {
    let current = sessionRef.current;
    if (!current || isSubmittedRef.current) return;
    const snapshot = flushTimeSpent(current);
    if (snapshot !== current) {
      current = { ...snapshot, updatedAt: new Date().toISOString() };
      sessionRef.current = current;
      setSession(current);
      persistSession(current);
    }

    const saveRequest = cloudCheckpointRequestRef.current
      .catch(() => undefined)
      .then(() => saveCustomTestCloudProgress(current));
    cloudCheckpointRequestRef.current = saveRequest;
    try {
      await saveRequest;
      cloudSaveErrorShownRef.current = false;
    } catch (error) {
      console.error('Could not checkpoint custom test progress to Supabase', error);
      if (!cloudSaveErrorShownRef.current) {
        toast.error('Cloud test progress could not be saved. Your latest progress remains on this device.');
        cloudSaveErrorShownRef.current = true;
      }
    }
  }, [flushTimeSpent, persistSession]);

  const submitExam = useCallback((automatic = false) => {
    let currentSession = sessionRef.current;
    if (!currentSession || isSubmittedRef.current) return;
    if (!automatic && !window.confirm('Submit this custom test now? You cannot change answers after submission.')) return;

    currentSession = flushTimeSpent(currentSession);
    sessionRef.current = currentSession;
    isSubmittedRef.current = true;
    const submittedAt = Date.now();
    const result = compactCustomTestResult({
      ...calculateCustomTestResults(currentSession, submittedAt),
      markedForReview: currentSession.markedForReview || [],
      bookmarked: currentSession.bookmarked || [],
    });

    try {
      const storedResults = JSON.parse(window.localStorage.getItem(CUSTOM_TEST_RESULTS_KEY) || '[]');
      const results = Array.isArray(storedResults) ? storedResults : [];
      const compactedResults = results.map(compactCustomTestResult);
      window.localStorage.setItem(
        CUSTOM_TEST_RESULTS_KEY,
        JSON.stringify([result, ...compactedResults].slice(0, 50)),
      );
      const attemptTimestamp = new Date(result.submittedAt).toISOString();
      appendSolvedQuestionAttempts(result.questionResults
        .filter((questionResult) => questionResult.hasAnswer)
        .map((questionResult) => ({
          question_id: questionResult.questionId,
          exam: 'Custom Test',
          subject: questionResult.subject,
          chapter: questionResult.chapter,
          difficulty: questionResult.difficulty,
          is_correct: questionResult.isCorrect,
          time_taken: questionResult.timeSpent,
          timestamp: attemptTimestamp,
          attempt_id: `custom-test:${result.id}:${questionResult.questionId}`,
        })));
      window.localStorage.removeItem(CUSTOM_TEST_SESSION_KEY);
      cloudCheckpointRequestRef.current
        .catch(() => undefined)
        .then(() => completeCustomTestCloudSession(currentSession.id))
        .catch((error) => {
          console.error('Could not clear the completed custom test cloud session', error);
          toast.error('Your result is saved, but cloud cleanup failed. Please keep this device signed in and online.');
        });
      toast.success(automatic ? 'Time is up. Your test has been submitted.' : 'Custom test submitted.');
      navigate(`/custom-test/results/${encodeURIComponent(result.id)}`, { replace: true });
    } catch (error) {
      isSubmittedRef.current = false;
      console.error('Could not save custom test results', error);
      toast.error('Could not save your results. Please try submitting again.');
    }
  }, [flushTimeSpent, navigate]);
  submitRef.current = submitExam;

  useEffect(() => {
    let active = true;
    const restoreCloudSession = async () => {
      try {
        const restoredSession = await loadCustomTestCloudSession(sessionRef.current);
        if (!active) return;
        if (restoredSession) {
          sessionRef.current = restoredSession;
          setSession(restoredSession);
          const restoredIndex = Math.min(
            Math.max(0, Number(restoredSession.currentIndex) || 0),
            Math.max(0, restoredSession.questions.length - 1),
          );
          setCurrentIndex(restoredIndex);
          setActiveSubject(
            restoredSession.questions[restoredIndex]?.subject
            || restoredSession.subjects?.[0]?.name
            || ''
          );
          setRemainingSeconds(Math.max(0, Math.ceil((restoredSession.endsAt - Date.now()) / 1000)));
          try {
            window.localStorage.setItem(CUSTOM_TEST_SESSION_KEY, JSON.stringify(restoredSession));
          } catch (error) {
            console.error('Could not store restored custom test progress locally', error);
            toast.error('The cloud test was restored, but this browser could not save a local copy.');
          }
        } else if (sessionRef.current) {
          sessionRef.current = null;
          setSession(null);
          window.localStorage.removeItem(CUSTOM_TEST_SESSION_KEY);
        }
      } catch (error) {
        console.error('Could not restore custom test cloud checkpoint', error);
        if (active) {
          toast.error("Could not check cloud-saved test progress. Continuing with this device's saved test.");
        }
      } finally {
        if (active) setIsSessionReady(true);
      }
    };
    restoreCloudSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSessionReady) return;
    if (!session || !Array.isArray(session.questions) || session.questions.length === 0) {
      toast.error('No active custom test was found.');
      navigate('/custom-test', { replace: true });
      return;
    }
    sessionRef.current = session;
  }, [isSessionReady, session, navigate]);

  useEffect(() => {
    currentQuestionIdRef.current = question?.id;
  }, [question?.id]);

  useEffect(() => {
    if (!session || !isSessionReady) return undefined;
    const timerId = window.setInterval(() => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const timeLeft = Math.ceil((currentSession.endsAt - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, timeLeft));
      if (timeLeft <= 0) {
        submitRef.current?.(true);
        return;
      }

      const activeQuestionId = currentQuestionIdRef.current;
      if (activeQuestionId) {
        pendingTimeSpentRef.current[activeQuestionId] = (
          Number(pendingTimeSpentRef.current[activeQuestionId]) || 0
        ) + 1;
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isSessionReady, session?.id]);

  useEffect(() => {
    if (!session || !isSessionReady) return undefined;
    const autosaveId = window.setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      let snapshot = flushTimeSpent(current);
      if (snapshot !== current) {
        snapshot = { ...snapshot, updatedAt: new Date().toISOString() };
        sessionRef.current = snapshot;
        setSession(snapshot);
      }
      persistSession(snapshot);
    }, LOCAL_SESSION_AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(autosaveId);
  }, [isSessionReady, session?.id, flushTimeSpent, persistSession]);

  useEffect(() => {
    if (!session || !isSessionReady) return undefined;
    const checkpointId = window.setInterval(
      checkpointCloudSession,
      CUSTOM_TEST_CLOUD_CHECKPOINT_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void checkpointCloudSession();
    };
    const handleOnline = () => {
      void checkpointCloudSession();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(checkpointId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [isSessionReady, session?.id, checkpointCloudSession]);

  const navigateToQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    setActiveSubject(questions[index].subject || '');
    updateSession((current) => ({ ...current, currentIndex: index }));
  };

  const saveAndNavigateToNext = () => {
    const nextIndex = Math.min(currentIndex + 1, questions.length - 1);
    const nextSession = {
      ...flushTimeSpent(sessionRef.current),
      currentIndex: nextIndex,
      updatedAt: new Date().toISOString(),
    };
    if (!persistSession(nextSession)) return;
    sessionRef.current = nextSession;
    setSession(nextSession);
    setCurrentIndex(nextIndex);
    setActiveSubject(questions[nextIndex].subject || '');
  };

  const answerQuestion = (answer) => {
    if (!question) return;
    updateSession((current) => ({
      ...current,
      answers: { ...current.answers, [question.id]: answer },
    }));
  };

  const toggleListItem = (field) => {
    if (!question) return;
    updateSession((current) => {
      const currentValues = current[field] || [];
      const nextValues = currentValues.includes(question.id)
        ? currentValues.filter((id) => id !== question.id)
        : [...currentValues, question.id];
      return { ...current, [field]: nextValues };
    });
  };

  const subjectQuestionIndexes = (subjectName) => questions
    .map((item, index) => (item.subject === subjectName ? index : -1))
    .filter((index) => index >= 0);

  if (!isSessionReady || !session || !question) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <p className="text-xl font-black uppercase">Loading custom test…</p>
          <Button variant="outline" onClick={() => navigate('/custom-test')} className="mt-4">Back to builder</Button>
        </div>
      </div>
    );
  }

  const questionNumber = currentIndex + 1;
  const answeredCount = Object.values(session.answers || {}).filter((answer) => String(answer).trim() !== '').length;
  const markedForReview = session.markedForReview || [];
  const bookmarked = session.bookmarked || [];
  const selectedAnswer = session.answers?.[question.id] ?? '';
  const activeSubjectName = activeSubject || session.subjects?.[0]?.name || '';
  const activeSubjectIndexes = subjectQuestionIndexes(activeSubjectName);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <Helmet>
        <title>{session.exam} Custom Test - Impulse</title>
      </Helmet>
      <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
        <button
          type="button"
          aria-label="Exit custom test"
          onClick={async () => {
            if (!window.confirm('Exit the test? Your current progress will be saved and the timer will continue.')) return;
            await checkpointCloudSession();
            navigate('/custom-test');
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-wide">{session.exam} · Custom Test</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{session.difficulty} · {questions.length} questions</div>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <Clock3 className={cn('h-4 w-4', remainingSeconds <= 300 && 'text-destructive')} />
          <span aria-live="polite" className={cn('font-mono text-sm font-black tabular-nums', remainingSeconds <= 300 && 'text-destructive')}>
            {formatTime(remainingSeconds)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" aria-label="Exam display settings">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border bg-background p-2">
            <DropdownMenuLabel className="px-2 pb-2 pt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Font size
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={fontSize} onValueChange={handleFontSizeChange}>
              <DropdownMenuRadioItem value="small" className="rounded-lg py-2">Small</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium" className="rounded-lg py-2">Medium</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="large" className="rounded-lg py-2">Large</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="my-2 bg-border" />
            <DropdownMenuItem onClick={toggleTheme} className="rounded-lg py-2">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Switch to {isDark ? 'light' : 'dark'} theme
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-secondary/20 px-4 py-3 sm:px-6" aria-label="Subjects">
        {session.subjects.map((subject) => {
          const subjectIndexes = subjectQuestionIndexes(subject.name);
          const currentSubject = activeSubjectName === subject.name;
          return (
            <button
              key={subject.name}
              type="button"
              aria-pressed={currentSubject}
              onClick={() => {
                setActiveSubject(subject.name);
                if (subjectIndexes.length) navigateToQuestion(subjectIndexes[0]);
              }}
              className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${currentSubject ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-secondary'}`}
            >
              {subject.name} <span className="ml-1 opacity-70">{subjectIndexes.length}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full font-black uppercase tracking-wide">{question.subject}</Badge>
                <Badge variant="outline" className="rounded-full">{question.chapter || 'Unspecified'}</Badge>
                <Badge variant="outline" className="rounded-full">{question.year || 'PYQ'}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleListItem('markedForReview')}
                  className={cn('rounded-xl font-bold', markedForReview.includes(question.id) && 'border-amber-500 text-amber-600')}
                >
                  <Flag className="mr-2 h-4 w-4" /> {markedForReview.includes(question.id) ? 'Marked' : 'Mark for review'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={bookmarked.includes(question.id) ? 'Remove bookmark' : 'Bookmark question'}
                  onClick={() => toggleListItem('bookmarked')}
                  className={cn('rounded-xl', bookmarked.includes(question.id) && 'border-primary text-primary')}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden rounded-3xl border-border shadow-sm">
              <CardContent className="p-5 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h1 className="text-sm font-black uppercase tracking-widest">Question {questionNumber}</h1>
                  <span className="text-xs font-bold text-muted-foreground">{questionNumber} of {questions.length}</span>
                </div>
                <div className={cn(
                  'mb-8 leading-8',
                  fontSize === 'small' ? 'text-base' : fontSize === 'large' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl',
                )}>
                  <RichText>{question.question_text || question.text || 'Question text is unavailable.'}</RichText>
                  {(question.image || question.question_image) && (
                    <img
                      src={question.image || question.question_image}
                      alt={question.image_alt || 'Question illustration'}
                      className="mt-5 max-h-[420px] w-full rounded-2xl border border-border object-contain"
                    />
                  )}
                </div>

                {isNumeric ? (
                  <div className="max-w-xs space-y-2">
                    <label htmlFor="numeric-answer" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Enter numerical answer</label>
                    <Input
                      id="numeric-answer"
                      type="number"
                      step="any"
                      value={selectedAnswer}
                      onChange={(event) => answerQuestion(event.target.value)}
                      className={cn(
                        'h-12 rounded-2xl font-bold',
                        fontSize === 'small' ? 'text-base' : fontSize === 'large' ? 'text-xl' : 'text-lg',
                      )}
                      placeholder="Type your answer"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {options.map(([key, value]) => {
                      const isSelected = String(selectedAnswer) === String(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => answerQuestion(key)}
                          className={`flex min-h-20 w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${isSelected ? 'border-foreground bg-secondary/60' : 'border-border hover:border-foreground/40 hover:bg-secondary/20'}`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-border'}`}>{key}</span>
                          <span className={cn(
                            'min-w-0 flex-1 pt-0.5',
                            fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base',
                          )}><RichText>{String(value ?? '')}</RichText></span>
                          {isSelected && <Check className="mt-1 h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-4 py-3 shadow-[0_-8px_24px_hsl(var(--background)/0.8)] sm:px-6 lg:px-8">
            <div className="flex w-full items-center gap-3">
              <Button variant="outline" onClick={() => navigateToQuestion(currentIndex - 1)} disabled={currentIndex === 0} className="h-11 min-w-0 flex-1 rounded-xl font-bold">
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => answerQuestion('')}
                disabled={!String(selectedAnswer).trim()}
                className="h-11 min-w-0 flex-1 rounded-xl font-bold"
              >
                <X className="mr-2 h-4 w-4" /> Clear response
              </Button>
              <Button
                onClick={saveAndNavigateToNext}
                disabled={currentIndex === questions.length - 1}
                className="h-11 min-w-0 flex-1 rounded-xl font-black uppercase tracking-wide"
              >
                Save & next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>

        <aside className={cn(
          'z-10 flex shrink-0 flex-col border-l border-border bg-card transition-all',
          showPalette ? 'w-[300px] lg:w-[340px]' : 'w-14',
          'max-md:fixed max-md:bottom-0 max-md:right-0 max-md:top-16 max-md:shadow-xl',
          !showPalette && 'max-md:w-14',
        )}>
          {showPalette && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest">Question palette</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{answeredCount} answered · {questions.length - answeredCount} remaining</p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-muted-foreground">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Answered</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Review</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border border-border" /> Unanswered</span>
                  </div>
                </div>
                <button type="button" aria-label="Collapse question palette" onClick={() => setShowPalette(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-secondary">
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{activeSubjectName}</h3>
                <div className="grid grid-cols-5 gap-2">
                  {activeSubjectIndexes.map((index) => {
                    const paletteQuestion = questions[index];
                    const hasAnswer = String(session.answers?.[paletteQuestion.id] ?? '').trim() !== '';
                    const isReview = markedForReview.includes(paletteQuestion.id);
                    const isCurrent = currentIndex === index;
                    return (
                      <button
                        key={paletteQuestion.id}
                        type="button"
                        aria-label={`Go to question ${index + 1}${hasAnswer ? ', answered' : ', unanswered'}${isReview ? ', marked for review' : ''}`}
                        onClick={() => navigateToQuestion(index)}
                        className={`relative flex h-10 items-center justify-center rounded-xl border-2 text-xs font-black transition-all ${isCurrent ? 'border-foreground ring-2 ring-foreground/15' : 'border-transparent'} ${hasAnswer ? 'bg-emerald-500 text-white' : 'bg-secondary text-foreground'} ${isReview && !hasAnswer ? 'bg-amber-500 text-white' : ''}`}
                      >
                        {index + 1}
                        {isReview && <Flag className="absolute left-1 top-1 h-3 w-3 fill-amber-500 text-amber-700" />}
                        {bookmarked.includes(paletteQuestion.id) && <Bookmark className="absolute right-1 top-1 h-3 w-3 fill-current" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {!showPalette && (
            <button type="button" aria-label="Expand question palette" onClick={() => setShowPalette(true)} className="flex h-12 w-full items-center justify-center border-b border-border hover:bg-secondary">
              <LayoutGrid className="h-4 w-4" />
            </button>
          )}
          <div className={cn('mt-auto border-t border-border p-3', !showPalette && 'px-2')}>
            <Button
              variant="destructive"
              onClick={() => submitExam(false)}
              aria-label="Submit test"
              className={cn('w-full rounded-xl font-black uppercase tracking-wide', !showPalette && 'px-0')}
            >
              <Send className={cn('h-4 w-4', showPalette && 'mr-2')} />
              {showPalette && 'Submit test'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CustomTestExamPage;
