import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ColoredIcon from '@/components/ColoredIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Atom, BookOpen, Bookmark, Calculator, Check, ChevronLeft, ChevronRight,
  Clock3, Dna, FileCheck2, FlaskConical, GraduationCap, Microscope, ShieldCheck,
  Timer, Zap,
} from 'lucide-react';
import {
  CUSTOM_DIFFICULTIES,
  CUSTOM_TEST_SESSION_KEY,
  MAX_QUESTIONS_PER_SUBJECT,
} from '@/lib/customTest';
import { createCustomTestCloudSession } from '@/lib/customTestSessionSync';
import { createCustomTestQuestions, loadCustomTestCatalog } from '@/lib/portalServer';

const EXAM_ICONS = {
  'JEE MAINS': Calculator,
  'JEE ADVANCED': GraduationCap,
  NEET: Microscope,
  MHTCET: BookOpen,
  BITSAT: Zap,
  COMEDK: Atom,
};

const SUBJECT_ICONS = {
  Physics: Zap,
  Chemistry: FlaskConical,
  Mathematics: Calculator,
  Biology: Dna,
  English: BookOpen,
  'Logical Reasoning': Atom,
};

const DEFAULT_MARKS = {
  MCQ: { correct: 4, wrong: -1 },
  NUM: { correct: 4, wrong: 0 },
};

const STEPS = ['Exam', 'Subjects', 'Chapters', 'Settings'];

function CustomTestBuilderPage() {
  const navigate = useNavigate();
  const [questionCatalog, setQuestionCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [chapterSubject, setChapterSubject] = useState('');
  const [selectedChapters, setSelectedChapters] = useState({});
  const [questionCounts, setQuestionCounts] = useState({});
  const [difficulty, setDifficulty] = useState('moderate-hard');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedYears, setSelectedYears] = useState(null);
  const [showYears, setShowYears] = useState(false);
  const [marks, setMarks] = useState(DEFAULT_MARKS);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    loadCustomTestCatalog()
      .then((catalog) => {
        if (active) setQuestionCatalog(catalog);
      })
      .catch((error) => {
        console.error('Could not load the custom-test question catalog.', error);
        if (active) setLoadError(error.message || 'Could not load available PYQ questions.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const exams = questionCatalog;
  const selectedExamCatalog = questionCatalog.find((exam) => exam.name === selectedExam);
  const availableYears = selectedExamCatalog?.years || [];
  const activeYears = selectedYears ?? availableYears;
  const subjects = selectedExamCatalog?.subjects || [];

  const activeChapterSubject = subjects.find((subject) => subject.name === chapterSubject)
    || subjects.find((subject) => selectedSubjects.includes(subject.name));
  const selectedQuestionCount = selectedSubjects.reduce(
    (total, name) => total + Math.min(
      MAX_QUESTIONS_PER_SUBJECT,
      Math.max(1, Number(questionCounts[name]) || 10),
    ),
    0,
  );
  const questionTypes = useMemo(() => {
    const types = new Set();
    subjects
      .filter((subject) => selectedSubjects.includes(subject.name))
      .flatMap((subject) => subject.typesByYear || [])
      .filter(({ year }) => activeYears.includes(String(year)))
      .forEach(({ types: availableTypes }) => availableTypes.forEach((type) => types.add(type)));
    return ['MCQ', 'NUM'].filter((type) => types.has(type));
  }, [subjects, selectedSubjects, activeYears]);

  const handleExamSelect = (exam) => {
    setSelectedExam(exam);
    setSelectedSubjects([]);
    setSelectedChapters({});
    setQuestionCounts({});
    setSelectedYears(null);
    setMarks(DEFAULT_MARKS);
  };

  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject.name)) {
      setSelectedSubjects((current) => current.filter((name) => name !== subject.name));
      return;
    }
    setSelectedSubjects((current) => [...current, subject.name]);
    setSelectedChapters((current) => ({
      ...current,
      [subject.name]: current[subject.name] || [],
    }));
  };

  const toggleChapter = (subjectName, chapter) => {
    setSelectedChapters((current) => {
      const existing = current[subjectName] || [];
      const next = existing.includes(chapter)
        ? existing.filter((item) => item !== chapter)
        : [...existing, chapter];
      return { ...current, [subjectName]: next };
    });
  };

  const toggleYear = (year) => {
    setSelectedYears((current) => {
      const active = current ?? availableYears;
      return active.includes(year)
        ? active.filter((item) => item !== year)
        : [...active, year];
    });
  };

  const updateMark = (type, field, value) => {
    if (value === '' || !Number.isFinite(Number(value))) return;
    setMarks((current) => ({ ...current, [type]: { ...current[type], [field]: Number(value) } }));
  };

  const continueBuilder = () => {
    if (step === 1 && !selectedExam) {
      toast.error('Choose an exam to continue.');
      return;
    }
    if (step === 2 && selectedSubjects.length === 0) {
      toast.error('Select at least one subject.');
      return;
    }
    if (step === 3 && selectedSubjects.some((name) => !(selectedChapters[name] || []).length)) {
      toast.error('Select at least one chapter for every chosen subject.');
      return;
    }
    if (step < 4) setStep((current) => current + 1);
  };

  const startTest = async () => {
    if (activeYears.length === 0) {
      toast.error('Select at least one PYQ year.');
      return;
    }
    if (window.localStorage.getItem(CUSTOM_TEST_SESSION_KEY)
      && !window.confirm('Starting a new test will replace your unfinished custom test. Continue?')) return;

    setIsStarting(true);
    try {
      const testQuestions = await createCustomTestQuestions({
        exam: selectedExam,
        subjects: selectedSubjects.map((name) => ({
          name,
          chapters: selectedChapters[name] || [],
          count: Math.min(
            MAX_QUESTIONS_PER_SUBJECT,
            Math.max(1, Math.floor(Number(questionCounts[name]) || 10)),
          ),
        })),
        years: activeYears.map(String),
        difficulty,
      });
      if (!testQuestions.length) {
        toast.error('There are no questions for your selected chapters and PYQ years.');
        return;
      }

      const startedAt = Date.now();
      const session = {
        id: window.crypto?.randomUUID?.() || `custom-${startedAt}`,
        exam: selectedExam,
        difficulty: CUSTOM_DIFFICULTIES.find((item) => item.id === difficulty)?.label || difficulty,
        difficultyId: difficulty,
        startedAt,
        updatedAt: new Date(startedAt).toISOString(),
        endsAt: startedAt + Math.max(1, Number(durationMinutes) || 60) * 60 * 1000,
        durationSeconds: Math.max(1, Number(durationMinutes) || 60) * 60,
        subjects: selectedSubjects.map((name) => ({
          name,
          chapters: selectedChapters[name] || [],
          questionIds: testQuestions
            .filter((question) => String(question.subject || 'Unspecified') === name)
            .map((question) => question.id),
        })),
        questions: testQuestions,
        answers: {},
        timeSpent: {},
        markedForReview: [],
        bookmarked: [],
        marks: Object.fromEntries(questionTypes.map((type) => [type, marks[type]])),
      };

      window.localStorage.setItem(CUSTOM_TEST_SESSION_KEY, JSON.stringify(session));
      try {
        await createCustomTestCloudSession(session);
      } catch (error) {
        console.error('Could not create custom test cloud checkpoint', error);
        toast.error('The test is saved on this device, but cloud resume could not be set up.');
      }
      navigate('/custom-test/exam');
    } catch (error) {
      console.error('Could not save custom test session', error);
      toast.error(error.message || 'Could not start the test. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const stepTitle = ['Choose your exam', 'Choose subjects', 'Select chapters', 'Configure your test'][step - 1];

  return (
    <>
      <Helmet>
        <title>Build Custom Test - Impulse</title>
        <meta name="description" content="Build a timed custom test from previous year questions." />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Link to="/custom-test" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">Custom tests</Link>
                <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">Build your test</h1>
                <p className="mt-2 text-muted-foreground">{stepTitle}</p>
              </div>
              <Badge variant="outline" className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider">
                <ShieldCheck className="mr-2 h-4 w-4" /> Step {step} of 4
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-2" aria-label="Builder steps">
              {STEPS.map((label, index) => (
                <div key={label} className="space-y-2">
                  <div className={`h-1.5 rounded-full ${step >= index + 1 ? 'bg-foreground' : 'bg-secondary'}`} />
                  <div className={`text-[10px] font-black uppercase tracking-wider ${step === index + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</div>
                </div>
              ))}
            </div>

            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Select an exam</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Only exams with PYQ questions are shown.</p>
                </div>
                {isLoading ? (
                  <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading available PYQ exams…</p>
                ) : loadError ? (
                  <div className="rounded-2xl border border-destructive/40 p-6 text-sm text-destructive">
                    <p>{loadError}</p>
                    <Button type="button" variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-3">
                      Retry loading questions
                    </Button>
                  </div>
                ) : exams.length === 0 ? (
                  <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No PYQ questions are available yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {exams.map(({ name, count }) => {
                      const Icon = EXAM_ICONS[name] || FileCheck2;
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={selectedExam === name}
                          onClick={() => handleExamSelect(name)}
                          className={`flex min-h-28 items-center gap-4 rounded-3xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${selectedExam === name ? 'border-foreground bg-secondary/50' : 'border-border bg-card hover:border-foreground/50'}`}
                        >
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ColoredIcon icon={Icon} name={name} size={7} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-black uppercase tracking-wide">{name}</span>
                            <span className="mt-1 block text-xs font-bold text-muted-foreground">{count} PYQ questions</span>
                          </span>
                          {selectedExam === name && <Check className="h-5 w-5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Select subjects</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose one or more subjects. Chapter options open in the next step.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((subject) => {
                    const Icon = SUBJECT_ICONS[subject.name] || BookOpen;
                    const active = selectedSubjects.includes(subject.name);
                    const count = activeYears.reduce(
                      (total, year) => total + Number(subject.questionCountByYear?.[year] || 0),
                      0,
                    );
                    return (
                      <button
                        key={subject.name}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleSubject(subject)}
                        className={`flex min-h-36 flex-col items-center justify-center rounded-3xl border-2 p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-foreground bg-secondary/50' : 'border-border hover:border-foreground/50'}`}
                      >
                        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary"><ColoredIcon icon={Icon} name={subject.name} size={7} /></span>
                        <span className="font-black uppercase tracking-wide">{subject.name}</span>
                        <span className="mt-1 text-xs text-muted-foreground">{subject.chapters.length} chapters · {count} questions</span>
                        {active && <span className="mt-2 text-[10px] font-black uppercase tracking-widest">Selected</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Select chapters</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Each subject opens in this dedicated step; choices stay selected as you switch subjects.</p>
                </div>
                <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                  <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Selected subjects">
                    {selectedSubjects.map((name) => {
                      const Icon = SUBJECT_ICONS[name] || BookOpen;
                      const count = selectedChapters[name]?.length || 0;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setChapterSubject(name)}
                          aria-current={(activeChapterSubject?.name || chapterSubject) === name ? 'step' : undefined}
                          className={`flex shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors lg:w-full ${(activeChapterSubject?.name || chapterSubject) === name ? 'border-foreground bg-secondary/50' : 'border-border hover:bg-secondary/30'}`}
                        >
                          <ColoredIcon icon={Icon} name={name} size={5} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-black uppercase">{name}</span>
                            <span className="text-[10px] text-muted-foreground">{count} selected</span>
                          </span>
                        </button>
                      );
                    })}
                  </nav>

                  {activeChapterSubject ? (
                    <Card className="rounded-3xl">
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg font-black uppercase">{activeChapterSubject.name} chapters</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {activeYears.reduce(
                                (total, year) => total + Number(activeChapterSubject.questionCountByYear?.[year] || 0),
                                0,
                              )} PYQs match selected years.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`count-${activeChapterSubject.name}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Questions</Label>
                            <Input
                              id={`count-${activeChapterSubject.name}`}
                              type="number"
                              min="1"
                              max={MAX_QUESTIONS_PER_SUBJECT}
                              value={questionCounts[activeChapterSubject.name] ?? 10}
                              onChange={(event) => setQuestionCounts((current) => ({
                                ...current,
                                [activeChapterSubject.name]: Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.max(1, Number(event.target.value) || 1)),
                              }))}
                              className="h-10 w-24 rounded-xl text-center font-black"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Maximum {MAX_QUESTIONS_PER_SUBJECT} questions per subject</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid max-h-[55vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                          {activeChapterSubject.chapters.map((chapter) => {
                            const chapterCount = activeYears.reduce(
                              (total, year) => total + Number(chapter.questionCountByYear?.[year] || 0),
                              0,
                            );
                            const checked = (selectedChapters[activeChapterSubject.name] || []).includes(chapter.name);
                            return (
                              <label key={chapter.name} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${checked ? 'border-foreground/50 bg-secondary/50' : 'border-border hover:bg-secondary/30'}`}>
                                <Checkbox checked={checked} onCheckedChange={() => toggleChapter(activeChapterSubject.name, chapter.name)} aria-label={`Include ${chapter.name}`} />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-bold">{chapter.name}</span>
                                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{chapterCount} available</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex min-h-60 items-center justify-center rounded-3xl border border-dashed border-border text-sm text-muted-foreground">Choose a subject in the previous step.</div>
                  )}
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Configure your paper</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Set a difficulty mix, PYQ years, time limit, and scoring.</p>
                </div>
                <div className="grid gap-5 xl:grid-cols-3">
                  <Card className="rounded-3xl xl:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base font-black uppercase tracking-wide">Difficulty</CardTitle>
                      <p className="text-sm text-muted-foreground">Guides the Easy / Medium / Hard mix from your PYQ bank.</p>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-5">
                      {CUSTOM_DIFFICULTIES.map((item) => (
                        <button key={item.id} type="button" aria-pressed={difficulty === item.id} onClick={() => setDifficulty(item.id)} className={`rounded-2xl border-2 px-3 py-3 text-sm font-black transition-colors ${difficulty === item.id ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/50'}`}>
                          {item.label}
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide"><Timer className="h-4 w-4" /> Duration</CardTitle></CardHeader>
                    <CardContent className="flex items-center gap-3">
                      <Input type="number" min="1" max="360" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.min(360, Math.max(1, Number(event.target.value) || 1)))} className="h-12 rounded-2xl text-lg font-black" aria-label="Test duration in minutes" />
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">minutes</span>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl">
                    <CardContent className="p-5">
                      <Button type="button" variant="outline" onClick={() => setShowYears((current) => !current)} aria-expanded={showYears} className="h-auto w-full justify-between rounded-2xl py-3 font-black uppercase tracking-wide">
                        <span className="flex items-center gap-2"><Bookmark className="h-4 w-4" /> PYQ years</span>
                        <Badge variant="secondary">{activeYears.length}/{availableYears.length} selected</Badge>
                      </Button>
                      {showYears && (
                        <div className="mt-4 space-y-3">
                          <div className="flex justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Choose years to include.</span>
                            <button type="button" className="text-xs font-black underline underline-offset-4" onClick={() => setSelectedYears([...availableYears])}>Select all</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {availableYears.map((year) => (
                              <label key={year} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                                <Checkbox checked={activeYears.includes(year)} onCheckedChange={() => toggleYear(year)} aria-label={`Include PYQ year ${year}`} />
                                <span className="text-sm font-bold">{year}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl xl:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide"><FileCheck2 className="h-4 w-4" /> Marking scheme</CardTitle>
                      <p className="text-sm text-muted-foreground">Default: single-correct +4 / −1; numerical +4 / 0. Adjust types available in your selected questions.</p>
                    </CardHeader>
                    <CardContent>
                      {questionTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No question type is available for the chosen years.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {questionTypes.map((type) => (
                            <div key={type} className="grid grid-cols-[1fr_1fr_1fr] items-end gap-3 rounded-2xl border border-border p-4">
                              <div className="text-xs font-black uppercase tracking-widest">{type === 'NUM' ? 'Numerical' : 'Single correct'}</div>
                              <div>
                                <Label htmlFor={`correct-${type}`} className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Correct</Label>
                                <Input id={`correct-${type}`} type="number" value={marks[type]?.correct ?? 4} onChange={(event) => updateMark(type, 'correct', event.target.value)} className="h-9 rounded-xl" />
                              </div>
                              <div>
                                <Label htmlFor={`wrong-${type}`} className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Wrong</Label>
                                <Input id={`wrong-${type}`} type="number" value={marks[type]?.wrong ?? (type === 'NUM' ? 0 : -1)} onChange={(event) => updateMark(type, 'wrong', event.target.value)} className="h-9 rounded-xl" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
              <Button variant="outline" onClick={() => step === 1 ? navigate('/custom-test') : setStep((current) => current - 1)} className="rounded-xl font-bold">
                <ChevronLeft className="mr-2 h-4 w-4" /> {step === 1 ? 'Cancel' : 'Back'}
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
                  <span>{selectedSubjects.length} subjects</span>
                  <span>Up to {selectedQuestionCount} questions</span>
                  {step === 4 && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {durationMinutes} min</span>}
                </div>
                {step < 4 ? (
                  <Button onClick={continueBuilder} disabled={isLoading || (step === 1 && !selectedExam)} className="rounded-xl px-6 font-black uppercase tracking-wide">
                    Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={startTest} disabled={isLoading || isStarting || !activeYears.length} className="rounded-xl px-6 font-black uppercase tracking-wide">
                    {isStarting ? 'Preparing test…' : 'Start custom test'} <Check className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default CustomTestBuilderPage;
