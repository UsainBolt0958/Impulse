import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TimerComponent from '@/components/TimerComponent.jsx';
import AnswerFeedback from '@/components/AnswerFeedback.jsx';
import RichText from '@/components/RichText.jsx';
import BookmarkQuestionButton from '@/components/BookmarkQuestionButton.jsx';
import { useQuestions } from '@/hooks/useQuestions';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import {
  getPYQPracticeExitState,
  getPYQPracticeQuestionSequence,
  getPYQPracticeReturnState,
} from '@/lib/pyqPracticeNavigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Settings, XCircle } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

function FullScreenSolvingPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getQuestionById, questions, isLoading } = useQuestions();
  const { addSolvedQuestion } = useSolvedQuestions();

  const [selectedOption, setSelectedOption] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('solve_font_size') || 'small');
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const question = getQuestionById(questionId);
  const questionSequence = getPYQPracticeQuestionSequence(questions, location.state, question);
  const questionIndex = questionSequence.findIndex((item) => item.id === questionId);
  const currentIndex = questionIndex < 0 ? 0 : questionIndex;

  const getQuestionType = (item) => {
    const rawType = String(item?.type || item?.question_type || '').trim().toUpperCase();
    if (rawType.startsWith('NUM')) return 'NUM';
    if (rawType === 'MCQ') return 'MCQ';
    return null;
  };

  const isValidNumericAnswer = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return false;
    const numericPattern = /^[-+]?(?:\d+|\d*\.\d+)$/;
    return numericPattern.test(normalized);
  };

  const isNumericQuestion = (() => {
    const explicit = getQuestionType(question);
    if (explicit === 'NUM') return true;
    if (explicit === 'MCQ') return false;

    const answerValue = String(question?.correct_answer ?? '').trim();
    const hasOptions = Object.values(question?.options || {}).some((value) => String(value).trim() !== '');
    return isValidNumericAnswer(answerValue) && !hasOptions;
  })();

  const normalizeAnswerValue = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return normalized;
    if (isValidNumericAnswer(normalized)) {
      return Number(normalized);
    }
    return normalized.replace(/^\+/, '');
  };
  const hasNext = currentIndex < questionSequence.length - 1;
  const hasPrev = currentIndex > 0;

  const fontSizes = {
    small: {
      question: 'text-xs sm:text-sm',
      optionText: 'text-xs sm:text-sm',
      optionLetter: 'text-sm',
    },
    medium: {
      question: 'text-sm sm:text-base',
      optionText: 'text-sm sm:text-base',
      optionLetter: 'text-base',
    },
    large: {
      question: 'text-base sm:text-lg',
      optionText: 'text-base sm:text-lg',
      optionLetter: 'text-lg',
    },
  };

  const currentFontSize = fontSizes[fontSize] || fontSizes.small;

  useEffect(() => {
    if (!isLoading && !question) {
      navigate('/pyq-practice');
    }
  }, [question, isLoading, navigate]);

  useEffect(() => {
    const storedFontSize = localStorage.getItem('solve_font_size');
    if (storedFontSize && fontSizes[storedFontSize]) {
      setFontSize(storedFontSize);
    }

    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (storedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const handleFontSizeChange = (value) => {
    setFontSize(value);
    localStorage.setItem('solve_font_size', value);
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex items-center justify-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Loading question...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-xl rounded-3xl border border-border bg-secondary/20 p-6 text-center">
          <p className="text-lg font-semibold">Question not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The question ID in the URL does not match any loaded question. Please return to practice and try again.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/pyq-practice')}
            className="mt-4"
          >
            Back to practice
          </Button>
        </div>
      </div>
    );
  }

  const handleCheck = () => {
    if (selectedOption === null || String(selectedOption).trim() === '') return;
    setHasChecked(true);
    const userAnswer = isNumericQuestion
      ? normalizeAnswerValue(selectedOption)
      : selectedOption;
    const correctAnswer = isNumericQuestion
      ? normalizeAnswerValue(question.correct_answer)
      : question.correct_answer;
    const isCorrect = userAnswer === correctAnswer;
    addSolvedQuestion(questionId, isCorrect, timeSpent, question);
  };

  const navigateToQuestion = (index) => {
    const nextQuestion = questionSequence[index];
    if (!nextQuestion) return;
    const state = getPYQPracticeReturnState(location.state);
    navigate(`/solve/${nextQuestion.id}`, { replace: true, state });
    setSelectedOption(null);
    setHasChecked(false);
    setTimeSpent(0);
  };

  const handleExit = () => {
    navigate(location.state?.from || '/pyq-practice', {
      replace: true,
      state: getPYQPracticeExitState(location.state, question),
    });
  };

  return (
    <>
      <Helmet>
        <title>{`Question ${currentIndex + 1} - Impulse`}</title>
        <meta name="description" content="Solve exam questions and track your performance" />
      </Helmet>

      <div className="fullscreen-container flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 border-b border-border/80 px-4 py-3 sm:px-6 grid grid-cols-[auto,1fr,auto] items-center gap-3 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExit}
              className="h-10 w-10 rounded-full border border-border/70 bg-transparent hover:bg-secondary"
              aria-label="Exit question solving"
              title="Exit question solving"
            >
              <ColoredIcon icon={ArrowLeft} name="arrowleft" size={4} />
            </Button>
          </div>

          <div className="min-w-0 text-center px-2">
            <p className="truncate text-xs sm:text-sm font-normal tracking-wide text-muted-foreground uppercase">
              {question.exam} &gt;&gt; {question.chapter}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/70 bg-transparent hover:bg-secondary"
                  aria-label="Settings"
                >
                  <ColoredIcon icon={Settings} name="settings" size={4} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border/80 bg-background p-2">
                <DropdownMenuLabel className="px-2 pt-1 pb-2 text-xs font-normal uppercase tracking-[0.2em] text-muted-foreground">
                  Font Size
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={fontSize} onValueChange={handleFontSizeChange}>
                  <DropdownMenuRadioItem value="small" className="rounded-lg pl-9 pr-2 py-2 text-sm font-normal">
                    Small
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium" className="rounded-lg pl-9 pr-2 py-2 text-sm font-normal">
                    Medium
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="large" className="rounded-lg pl-9 pr-2 py-2 text-sm font-normal">
                    Large
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator className="my-2 bg-border/80" />

                <DropdownMenuItem onClick={toggleTheme} className="rounded-lg px-2 py-2 text-sm font-normal">
                  {isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-16 hide-scrollbar relative">
          <div className="max-w-4xl mx-auto space-y-8 pb-24">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm sm:text-base font-normal uppercase tracking-normal text-muted-foreground">
                  Q{currentIndex + 1}
                </p>
                <p className="text-sm sm:text-base font-normal text-muted-foreground">
                  {question.exam}
                </p>
                {question.shift ? (
                  <p className="text-sm sm:text-base font-semibold text-muted-foreground">
                    Shift: {question.shift}
                  </p>
                ) : null}
              </div>

              <div className="mt-1 flex shrink-0 items-center gap-2">
                <BookmarkQuestionButton
                  question={question}
                  className="h-9 w-9 rounded-full"
                />
                <TimerComponent
                  resetKey={questionId}
                  isRunning={!hasChecked}
                  onTimeUpdate={setTimeSpent}
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="max-w-none">
              <div className={`font-sans ${currentFontSize.question} font-normal leading-relaxed tracking-normal text-balance text-foreground/90`}>
                <RichText>{question.question_text}</RichText>
              </div>
            </div>

            {(() => {
              const imageSrc = String(question.image || question.question_image || '').trim();
              return imageSrc ? (
                <div className="max-w-none">
                  <img
                    src={imageSrc}
                    alt={question.image_alt || 'Question illustration'}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    className="w-full max-h-[440px] rounded-3xl border border-border object-contain bg-background"
                  />
                </div>
              ) : null;
            })()}

            {/* Options or Numeric pad */}
            {isNumericQuestion ? (
              <div className="mx-auto max-w-[220px] space-y-3">
                <div className="rounded-3xl border border-border bg-secondary/20 p-2 text-right text-xl font-black tracking-tight text-foreground">
                  {selectedOption === null || String(selectedOption).trim() === '' ? 'Enter answer' : selectedOption}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {['7','8','9','4','5','6','1','2','3','.','0','DEL'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={hasChecked}
                      onClick={() => {
                        if (hasChecked) return;
                        if (key === 'DEL') {
                          setSelectedOption((prev) => {
                            if (prev === null || prev === '') return '';
                            return String(prev).slice(0, -1);
                          });
                          return;
                        }
                        setSelectedOption((prev) => {
                          const next = String(prev || '');
                          if (key === '.' && next.includes('.')) return next;
                          return `${next}${key}`;
                        });
                      }}
                      className="rounded-2xl border border-border bg-background py-2 text-lg font-black uppercase tracking-[0.16em] transition-colors hover:border-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {key === 'DEL' ? '⌫' : key}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => !hasChecked && setSelectedOption('')}
                  className="w-full rounded-2xl border-border px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em]"
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {Object.entries(question.options).map(([key, value]) => (
                  (() => {
                    const isSelected = selectedOption === key;
                    const isCorrectOption = key === question.correct_answer;
                    const isAnswered = hasChecked && selectedOption !== null;
                    const showCorrect = hasChecked && isCorrectOption;
                    const showWrongSelected = hasChecked && isSelected && !isCorrectOption;

                    return (
                      <button
                        key={key}
                        onClick={() => !hasChecked && setSelectedOption(key)}
                        disabled={hasChecked}
                        className={`relative w-full min-h-[88px] p-3 sm:p-4 text-left border-2 border-border/70 rounded-xl transition-all duration-200 group flex items-start gap-3 ${
                          showCorrect
                            ? 'border-emerald-500 ring-4 ring-emerald-500/55 ring-offset-2 ring-offset-background bg-emerald-500/8'
                            : showWrongSelected
                              ? 'border-red-500 ring-4 ring-red-500/55 ring-offset-2 ring-offset-background bg-red-500/8'
                              : isSelected
                                ? 'border-foreground ring-4 ring-foreground/60 ring-offset-2 ring-offset-background bg-secondary/30'
                                : 'bg-background hover:border-foreground/80 hover:bg-secondary/30'
                        } ${isAnswered && !isSelected && !isCorrectOption ? 'opacity-70' : ''} ${hasChecked ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className={`flex items-center justify-center w-10 h-10 flex-shrink-0 border rounded-full ${
                          showCorrect
                            ? 'border-emerald-500 text-emerald-600'
                            : showWrongSelected
                              ? 'border-red-500 text-red-500'
                              : isSelected
                                ? 'border-foreground text-foreground'
                                : 'border-muted-foreground text-muted-foreground group-hover:border-foreground group-hover:text-foreground'
                        }`}>
                          <span className={`font-normal uppercase tracking-wide ${currentFontSize.optionLetter}`}>{key}</span>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className={`font-normal leading-relaxed pt-1 ${currentFontSize.optionText} ${showCorrect || showWrongSelected ? 'text-foreground' : 'text-foreground/90'}`}>
                            <RichText>{value}</RichText>
                          </div>
                          {question.option_images?.[key] ? (
                            <img
                              src={question.option_images[key]}
                              alt={`Option ${key} image`}
                              className="max-h-[240px] w-full rounded-3xl border border-border object-contain bg-background"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                        </div>

                        {hasChecked && isCorrectOption && (
                          <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500 bg-background">
                            <ColoredIcon icon={Check} name="check" size={3} className="text-emerald-600" />
                          </div>
                        )}

                        {hasChecked && isSelected && !isCorrectOption && (
                          <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-red-500 bg-background">
                            <ColoredIcon icon={XCircle} name="xcircle" size={3} className="text-red-500" />
                          </div>
                        )}
                      </button>
                    );
                  })()
                ))}
              </div>
            )}

            {/* Feedback Section */}
            {hasChecked && (
              <AnswerFeedback
                isCorrect={isNumericQuestion
                  ? normalizeAnswerValue(selectedOption) === normalizeAnswerValue(question.correct_answer)
                  : selectedOption === question.correct_answer}
                explanation={question.explanation}
                correctAnswer={question.correct_answer}
                userAnswer={selectedOption}
              />
            )}
          </div>
        </main>

        {/* Footer Actions */}
        <footer className="z-10 flex-shrink-0 border-t-4 border-border bg-background p-4 sm:px-8 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => navigateToQuestion(currentIndex - 1)}
              disabled={!hasPrev}
              className="h-11 px-4 sm:px-8 font-normal uppercase tracking-widest border border-border/80 flex-1 sm:flex-none rounded-full bg-transparent"
            >
              <ColoredIcon icon={ChevronLeft} name="chevrleft" size={4} />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <Button
              onClick={handleCheck}
              disabled={selectedOption === null || String(selectedOption).trim() === '' || hasChecked}
              className={`h-11 px-6 font-normal uppercase tracking-widest flex-1 sm:flex-none border border-transparent rounded-full transition-all duration-200 ${
                selectedOption === null || String(selectedOption).trim() === '' || hasChecked
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-foreground text-background hover:scale-105 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]'
              }`}
            >
              <ColoredIcon icon={Check} name="check" size={4} className="mr-2" />
              Check Answer
            </Button>

            <Button
              variant="outline"
              onClick={() => navigateToQuestion(currentIndex + 1)}
              disabled={!hasNext}
              className="h-11 px-4 sm:px-8 font-normal uppercase tracking-widest border border-border/80 flex-1 sm:flex-none rounded-full bg-transparent"
            >
              <span className="hidden sm:inline">Next</span>
              <ColoredIcon icon={ChevronRight} name="chevrright" size={4} className="sm:ml-2" />
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}

export default FullScreenSolvingPage;