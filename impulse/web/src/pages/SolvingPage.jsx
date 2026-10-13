import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import TimerComponent from '@/components/TimerComponent.jsx';
import AnswerFeedback from '@/components/AnswerFeedback.jsx';
import ProgressBar from '@/components/ProgressBar.jsx';
import RichText from '@/components/RichText.jsx';
import { useQuestions } from '@/hooks/useQuestions';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { useMarkedQuestions } from '@/hooks/useMarkedQuestions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';
import { toast } from 'sonner';

function SolvingPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getQuestionById, questions } = useQuestions();
  const { addSolvedQuestion } = useSolvedQuestions();
  const { toggleMark, isMarked } = useMarkedQuestions();

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  const question = getQuestionById(questionId);

  const getQuestionType = (item) => {
    const rawType = String(item?.type || item?.question_type || item?.questionType || '').trim().toUpperCase();
    if (rawType.startsWith('NUM')) return 'NUM';
    if (rawType === 'MULTI' || rawType === 'MULTIPLE' || rawType === 'MULTISELECT') return 'MULTI';
    return rawType === 'MCQ' ? 'MCQ' : null;
  };

  const isValidNumericAnswer = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return false;
    const numericPattern = /^[-+]?(?:\d+|\d*\.\d+)$/;
    return numericPattern.test(normalized);
  };

  const inferNumericQuestion = (item) => {
    const explicitType = getQuestionType(item);
    if (explicitType === 'NUM') return true;
    if (explicitType !== null) return false;
    const optionValues = Object.values(item.options || {}).map((value) => String(value || '').trim());
    const allOptionsEmpty = optionValues.length === 0 || optionValues.every((value) => value === '');
    const answerIsNumeric = isValidNumericAnswer(String(item?.correct_answer ?? '').trim());
    return allOptionsEmpty && answerIsNumeric;
  };

  const isNumericQuestion = inferNumericQuestion(question);

  const normalizeAnswerValue = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return normalized;
    if (isValidNumericAnswer(normalized)) {
      return Number(normalized);
    }
    return normalized.replace(/^\+/, '');
  };
  const currentIndex = questions.findIndex(q => q.id === questionId);
  const hasNext = currentIndex < questions.length - 1;
  const hasPrev = currentIndex > 0;

  useEffect(() => {
    if (!question) {
      navigate('/practice');
    }
  }, [question, navigate]);

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="max-w-xl rounded-3xl border border-border bg-secondary/20 p-6 text-center">
          <p className="text-lg font-semibold">Question not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The question ID in the URL does not match any loaded question. Please go back and select a valid question.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/practice')}
            className="mt-4"
          >
            Back to practice
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (selectedAnswer === null || String(selectedAnswer).trim() === '') {
      toast.error('Please select an answer');
      return;
    }

    setIsTimerRunning(false);
    setSubmitted(true);
    const userValue = normalizeAnswerValue(selectedAnswer);
    const correctValue = normalizeAnswerValue(question.correct_answer);
    const isCorrect = isNumericQuestion
      ? userValue === correctValue
      : selectedAnswer === question.correct_answer;
    addSolvedQuestion(questionId, isCorrect, timeTaken);
    
    if (isCorrect) {
      toast.success('Correct answer');
    } else {
      toast.error('Incorrect answer');
    }
  };

  const handleMarkForReview = () => {
    toggleMark(questionId);
    toast.success(isMarked(questionId) ? 'Removed from notebook' : 'Added to notebook');
  };

  const handleNext = () => {
    if (hasNext) {
      navigate(`/solve/${questions[currentIndex + 1].id}`);
      setSelectedAnswer(null);
      setSubmitted(false);
      setTimeTaken(0);
      setIsTimerRunning(true);
    }
  };

  const handlePrevious = () => {
    if (hasPrev) {
      navigate(`/solve/${questions[currentIndex - 1].id}`);
      setSelectedAnswer(null);
      setSubmitted(false);
      setTimeTaken(0);
      setIsTimerRunning(true);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-900 border-green-900';
      case 'Medium': return 'bg-yellow-100 text-yellow-900 border-yellow-900';
      case 'Hard': return 'bg-red-100 text-red-900 border-red-900';
      default: return 'bg-gray-100 text-gray-900 border-gray-900';
    }
  };

  return (
    <>
      <Helmet>
        <title>{`Question ${currentIndex + 1} - Impulse`}</title>
        <meta name="description" content="Solve exam questions and track your performance" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <button
              type="button"
              onClick={() => {
                if (location.state?.from) {
                  navigate(location.state.from, { state: { practiceState: location.state.practiceState } });
                } else {
                  navigate(-1);
                }
              }}
              className="text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
                ← Back to Practice
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <ProgressBar current={currentIndex + 1} total={questions.length} />
                <TimerComponent isRunning={isTimerRunning} onTimeUpdate={setTimeTaken} />
              </div>

              <Card className="border-border">
                <CardContent className="p-8">
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge variant="outline" className={`font-bold text-xs uppercase tracking-wide border ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </Badge>
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
                      {question.exam}
                    </Badge>
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
                      {question.subject}
                    </Badge>
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
                      {question.chapter}
                    </Badge>
                    <Badge variant="outline" className="font-bold text-xs uppercase tracking-wide">
                      {question.year}
                    </Badge>
                  </div>

                  <div className="text-2xl font-black uppercase tracking-tight mb-8">
                    <RichText>{question.question_text}</RichText>
                  </div>

                  {(() => {
                    const imageSrc = String(question.image || question.question_image || '').trim();
                    return imageSrc ? (
                      <div className="mb-8">
                        <img
                          src={imageSrc}
                          alt={question.image_alt || 'Question illustration'}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          className="w-full max-h-[420px] rounded-3xl border border-border object-contain bg-background"
                        />
                      </div>
                    ) : null;
                  })()}

                  {isNumericQuestion ? (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-border bg-secondary/20 p-4 text-right text-3xl font-black tracking-tight text-foreground">
                        {selectedAnswer === null || String(selectedAnswer).trim() === '' ? 'Enter answer' : selectedAnswer}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {['7','8','9','4','5','6','1','2','3','.','0','DEL'].map((key) => (
                          <button
                            key={key}
                            type="button"
                            disabled={submitted}
                            onClick={() => {
                              if (submitted) return;
                              if (key === 'DEL') {
                                setSelectedAnswer((prev) => {
                                  if (prev === null || prev === '') return '';
                                  return String(prev).slice(0, -1);
                                });
                                return;
                              }
                              setSelectedAnswer((prev) => {
                                const next = String(prev || '');
                                if (key === '.' && next.includes('.')) return next;
                                return `${next}${key}`;
                              });
                            }}
                            className="rounded-3xl border border-border bg-background p-4 text-2xl font-black uppercase tracking-[0.2em] transition-colors hover:border-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {key === 'DEL' ? '⌫' : key}
                          </button>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => !submitted && setSelectedAnswer('')}
                        className="w-full rounded-full border-border px-5 py-3 text-sm font-black uppercase tracking-[0.14em]"
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(question.options).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => !submitted && setSelectedAnswer(key)}
                          disabled={submitted}
                          className={`w-full p-4 text-left border-2 transition-all duration-200 ${
                            selectedAnswer === key
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border hover:border-foreground'
                          } ${submitted ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <span className="font-bold mr-3">{key}.</span>
                          <div className="font-medium space-y-3">
                            <RichText>{value}</RichText>
                            {question.option_images?.[key] ? (
                              <img
                                src={question.option_images[key]}
                                alt={`Option ${key} image`}
                                className="max-h-[220px] w-full rounded-2xl border border-border object-contain bg-background"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {submitted && (
                <AnswerFeedback
                  isCorrect={isNumericQuestion
                    ? normalizeAnswerValue(selectedAnswer) === normalizeAnswerValue(question.correct_answer)
                    : selectedAnswer === question.correct_answer}
                  explanation={question.explanation}
                  correctAnswer={question.correct_answer}
                  userAnswer={selectedAnswer}
                />
              )}

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handleMarkForReview}
                  className="font-bold"
                >
                  <ColoredIcon icon={Bookmark} name="bookmark" size={4} className={`${isMarked(questionId) ? 'fill-current' : ''} mr-2`} />
                  {isMarked(questionId) ? 'Marked' : 'Mark for Review'}
                </Button>

                <div className="flex items-center gap-2">
                  {!submitted ? (
                    <Button onClick={handleSubmit} className="font-bold">
                      Submit Answer
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={!hasPrev}
                        className="font-bold"
                      >
                        <ColoredIcon icon={ChevronLeft} name="chevronleft" size={4} className="mr-1" />
                        Previous
                      </Button>
                      <Button
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="font-bold"
                      >
                        Next
                        <ColoredIcon icon={ChevronRight} name="chevronright" size={4} className="ml-1" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default SolvingPage;