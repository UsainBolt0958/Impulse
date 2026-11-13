import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  BadgePlus,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  Edit3,
  Flame,
  LayoutDashboard,
  PencilLine,
  Plus,
  Moon,
  Shield,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserCircle2,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import ColoredIcon from '@/components/ColoredIcon';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { loadSeries, createSeries, updateSeries, deleteSeries } from '@/lib/portalServer';
import TestSeriesManager from '@/admin/TestSeriesManager';
import BillingAdminPanel from '@/admin/BillingAdminPanel';
import {
  ADMIN_PROFILE_DEFAULT,
  buildExamCards,
  createActivityEntry,
  createExamDraft,
  createQuestionDraft,
  generateId,
  loadAdminPortalState,
  loadAdminSession,
  normalizeExam,
  normalizeQuestion,
  readAdminPortalState,
  savePortalState,
  slugify,
  titleCase,
} from '@/lib/adminPortal';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];
const EXAM_STATUS_OPTIONS = ['Active', 'Draft', 'Archived'];
const EXAM_SUBJECT_OPTIONS = {
  'NEET': ['Physics', 'Chemistry', 'Biology'],
  'COMEDK': ['Physics', 'Chemistry', 'Mathematics'],
  'MHTCET': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'BITSAT': ['Physics', 'Chemistry', 'Mathematics', 'English', 'Logical Reasoning'],
  'JEE': ['Physics', 'Chemistry', 'Mathematics'],
  'DEFAULT': ['Physics', 'Chemistry', 'Mathematics', 'English', 'Logical Reasoning'],
};
const SUBJECT_CHAPTER_OPTIONS = {
  Physics: [
    'Math in Physics', 'Units & Dimensions', 'Motion in 1D', 'Motion in 2D', 'Laws of Motion',
    'Work Power Energy', 'COM & Collisions', 'Rotational Motion', 'Gravitation', 'Properties of Solids',
    'Properties of Fluids', 'Thermal Properties', 'Thermodynamics', 'KTG', 'Oscillations', 'Waves & Sound',
    'Electrostatics', 'Capacitance', 'Current Electricity', 'Magnetic Properties', 'Magnetism & Current',
    'EMI', 'AC Circuits', 'EM Waves', 'Ray Optics', 'Wave Optics', 'Dual Nature', 'Atomic Physics',
    'Nuclear Physics', 'Semiconductors', 'Communication System', 'Experimental Physics',
  ],
  Chemistry: [
    'Mole Concept', 'Atomic Structure', 'Periodic Table', 'Chemical Bonding', 'States of Matter',
    'Thermodynamics (C)', 'Chemical Equilibrium', 'Ionic Equilibrium', 'Redox Reactions', 'Hydrogen', 's Block',
    'p Block (G13-14)', 'GOC', 'Hydrocarbons', 'Env. Chemistry', 'Solid State', 'Solutions', 'Electrochemistry',
    'Chemical Kinetics', 'Surface Chemistry', 'Metallurgy', 'p Block (G15-18)', 'd & f Block',
    'Coordination Compounds', 'Haloalkanes & Haloarenes', 'Alcohols, Phenols & Ethers', 'Aldehydes & Ketones',
    'Carboxylic Acids', 'Amines', 'Biomolecules', 'Polymers', 'Everyday Chemistry', 'Practical Chemistry',
  ],
  Mathematics: [
    'Basic Math', 'Quadratic Equations', 'Complex Numbers', 'P&C', 'Sequences & Series', 'Math Induction',
    'Binomial Theorem', 'Trigonometry', 'Trigonometric Equations', 'Straight Lines', 'Pair of Lines', 'Circle',
    'Parabola', 'Ellipse', 'Hyperbola', 'Limits', 'Mathematical Reasoning', 'Statistics', 'Heights & Distances',
    'Properties of Triangles', 'Sets & Relations', 'Matrices', 'Determinants', 'ITF', 'Functions', 'C&D',
    'Differentiation', 'AOD', 'Indefinite Integration', 'Definite Integration', 'Area Under Curves',
    'Differential Eqns', 'Vector Algebra', '3D Geometry', 'Linear Programming', 'Probability',
  ],
  Biology: [
    'The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom',
    'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals',
    'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Photosynthesis in Higher Plants',
    'Respiration in Plants', 'Plant Growth and Development', 'Breathing and Exchange of Gases',
    'Body Fluids and Circulation', 'Excretory Products and their Elimination', 'Locomotion and Movement',
    'Neural Control and Coordination', 'Chemical Coordination and Integration',
    'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health',
    'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution',
    'Human Health and Disease', 'Microbes in Human Welfare', 'Biotechnology: Principles and Processes',
    'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation',
  ],
  English: ['Grammar', 'Vocabulary', 'Reading Comprehension', 'Sentence Improvement', 'Fill in the Blanks'],
  'Logical Reasoning': ['Syllogisms', 'Coding-Decoding', 'Seating Arrangement', 'Blood Relations', 'Puzzles', 'Series'],
};
const ACTIVITY_TYPES = {
  'question.created': 'Created',
  'question.updated': 'Updated',
  'question.deleted': 'Deleted',
  'exam.created': 'Exam added',
  'exam.updated': 'Exam updated',
  'exam.deleted': 'Exam removed',
  'series.created': 'Series added',
  'series.updated': 'Series updated',
  'series.deleted': 'Series removed',
};

function initials(value = '') {
  const parts = value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return 'IA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatDateTime(value) {
  if (!value) return 'Never';
}

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function countSince(items, since) {
  return items.filter((entry) => new Date(entry.timestamp).getTime() >= since.getTime()).length;
}

function buildDailySeries(activity, days = 14) {
  const series = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const value = activity.filter((entry) => entry.type.startsWith('question.') && isSameDay(new Date(entry.timestamp), day)).length;

    series.push({
      label: format(day, 'MMM d'),
      value,
    });
  }

  return series;
}

function buildGroupedSeries(items, getter) {
  const totals = new Map();

  items.forEach((item) => {
    const key = getter(item) || 'Unknown';
    totals.set(key, (totals.get(key) || 0) + 1);
  });

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function getSubjectOptionsForExam(exam, questions = []) {
  const preset = EXAM_SUBJECT_OPTIONS[exam === 'JEE MAINS' || exam === 'JEE ADVANCED' ? 'JEE' : exam];
  if (preset) return preset;

  const fallback = [...new Set(questions.filter((question) => question.exam === exam).map((question) => question.subject).filter(Boolean))];
  return fallback.length > 0 ? fallback : EXAM_SUBJECT_OPTIONS.DEFAULT;
}

function getChapterOptionsForSubject(subject, questions = [], exam = '') {
  const preset = SUBJECT_CHAPTER_OPTIONS[subject];
  if (preset) return preset;

  const fallback = [...new Set(
    questions
      .filter((question) => (!exam || question.exam === exam) && question.subject === subject)
      .map((question) => question.chapter)
      .filter(Boolean),
  )];

  return fallback;
}

function buildQuestionDraftFromQuestion(question) {
  return {
    exam: question.exam || '',
    year: question.year || new Date().getFullYear(),
    shift: question.shift || 'Shift 1',
    subject: question.subject || '',
    chapter: question.chapter || '',
    difficulty: question.difficulty || 'Medium',
    question_text: question.question_text || '',
    image: question.image || question.question_image || '',
    optionA: question.options?.A || '',
    optionAImage: question.option_images?.A || question.optionAImage || '',
    optionB: question.options?.B || '',
    optionBImage: question.option_images?.B || question.optionBImage || '',
    optionC: question.options?.C || '',
    optionCImage: question.option_images?.C || question.optionCImage || '',
    optionD: question.options?.D || '',
    optionDImage: question.option_images?.D || question.optionDImage || '',
    correct_answer: question.correct_answer || 'A',
    explanation: question.solution || question.explanation || '',
  };
}

function buildExamDraftFromExam(exam) {
  return {
    label: exam.label || '',
    description: exam.description || '',
    status: exam.status || 'Active',
    notes: exam.notes || '',
  };
}

function StatCard({ icon: Icon, label, value, tone = 'default', caption }) {
  const toneClass = {
    default: 'bg-foreground text-background',
    muted: 'bg-secondary text-foreground',
    outline: 'border border-border bg-background text-foreground',
  }[tone];

  return (
    <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
          <ColoredIcon icon={Icon} name={label} size={5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-black uppercase tracking-tight">{value}</p>
          {caption ? <p className="mt-1 text-sm text-muted-foreground">{caption}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TopStats({ summary, portal, weeklyProgress }) {
  return (
    <>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpen} label="Questions" value={summary.totalQuestions} caption="Live items in storage" tone="default" />
        <StatCard icon={ClipboardList} label="Exams" value={summary.totalExams} caption="Manual plus derived" tone="outline" />
        <StatCard icon={Flame} label="Today" value={summary.todayContributions} caption="Question entries added" tone="muted" />
        <StatCard icon={Star} label="Weekly goal" value={`${weeklyProgress}%`} caption={`${portal.profile.weeklyGoal || ADMIN_PROFILE_DEFAULT.weeklyGoal} target`} tone="outline" />
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="space-y-1.5">
      {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p> : null}
      <h2 className="text-3xl font-black uppercase tracking-tight">{title}</h2>
      {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function PillButton({ active, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition-all ${active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-foreground hover:bg-secondary'} ${className}`}
    >
      {children}
    </button>
  );
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function AdminPortalPage() {
  const { getTotalSolved, getAccuracy, getCurrentStreak } = useSolvedQuestions();
  const [portal, setPortal] = React.useState(() => readAdminPortalState());
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authReady, setAuthReady] = React.useState(false);
  const [tab, setTab] = React.useState('overview');
  const [collapsed, setCollapsed] = React.useState(false);
  const [questionDraft, setQuestionDraft] = React.useState(() => createQuestionDraft());
  const [examDraft, setExamDraft] = React.useState(() => createExamDraft());
  const [profileDraft, setProfileDraft] = React.useState(() => ({ ...ADMIN_PROFILE_DEFAULT }));
  const [editingQuestionId, setEditingQuestionId] = React.useState(null);
  const [editingExamId, setEditingExamId] = React.useState(null);
  const [questionSearch, setQuestionSearch] = React.useState('');
  const [questionExamFilter, setQuestionExamFilter] = React.useState('all');
  const [questionYearFilter, setQuestionYearFilter] = React.useState('all');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = React.useState('all');
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const applyTheme = React.useCallback((theme) => {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
    }

    setIsDark(nextTheme === 'dark');
  }, []);

  const toggleTheme = React.useCallback(() => {
    applyTheme(isDark ? 'light' : 'dark');
  }, [applyTheme, isDark]);

  React.useEffect(() => {
    applyTheme(getStoredTheme());
  }, [applyTheme]);

  // Series state
  const [seriesList, setSeriesList] = React.useState([]);
  const [seriesDraft, setSeriesDraft] = React.useState({ title: '', description: '' });
  const [editingSeriesId, setEditingSeriesId] = React.useState('');
  const [seriesSearch, setSeriesSearch] = React.useState('');
  const [seriesLoading, setSeriesLoading] = React.useState(false);

  const resetSeriesForm = React.useCallback(() => {
    setSeriesDraft({ title: '', description: '' });
    setEditingSeriesId('');
  }, []);

  const filteredSeriesList = React.useMemo(() => {
    const search = String(seriesSearch || '').trim().toLowerCase();
    if (!search) return seriesList;
    return seriesList.filter((item) => {
      const haystack = [item.title, item.description, item.id]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');
      return haystack.includes(search);
    });
  }, [seriesList, seriesSearch]);

  const handleCreateSeries = async (event) => {
    event?.preventDefault?.();
    if (!seriesDraft.title.trim()) {
      toast.error('Series title is required.');
      return;
    }

    setSeriesLoading(true);
    const payload = {
      title: seriesDraft.title.trim(),
      description: String(seriesDraft.description || '').trim(),
    };
    const result = editingSeriesId
      ? await updateSeries(editingSeriesId, payload)
      : await createSeries(payload.title, payload.description);
    setSeriesLoading(false);

    if (!result) {
      toast.error(editingSeriesId ? 'Failed to update series.' : 'Failed to create series.');
      return;
    }

    setSeriesList((current) => {
      if (editingSeriesId) {
        return current.map((item) => (item.id === result.id ? result : item));
      }
      return [result, ...(current || [])];
    });

    const nextPortal = {
      ...portal,
      activity: [
        createActivityEntry({
          type: editingSeriesId ? 'series.updated' : 'series.created',
          title: editingSeriesId ? `Updated ${result.title}` : `Added ${result.title}`,
          description: result.description || 'Test series updated',
        }),
        ...(portal.activity || []),
      ],
    };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);

    resetSeriesForm();
    toast.success(editingSeriesId ? 'Series updated.' : 'Series created.');
  };

  const handleSeriesEdit = (series) => {
    setEditingSeriesId(series.id || '');
    setSeriesDraft({
      title: String(series.title || ''),
      description: String(series.description || ''),
    });
  };

  const handleSeriesDelete = async (series) => {
    const confirmed = window.confirm(`Delete ${series.title || 'this series'}?`);
    if (!confirmed) return;

    const result = await deleteSeries(series.id);
    if (!result) {
      toast.error('Failed to delete series.');
      return;
    }

    setSeriesList((current) => current.filter((item) => item.id !== series.id));
    if (editingSeriesId === series.id) resetSeriesForm();

    const nextPortal = {
      ...portal,
      activity: [
        createActivityEntry({
          type: 'series.deleted',
          title: `Removed ${series.title || 'series'}`,
          description: series.description || 'Series entry removed',
        }),
        ...(portal.activity || []),
      ],
    };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);

    toast.success('Series removed.');
  };

  React.useEffect(() => {
    setProfileDraft(portal.profile);
  }, [portal.profile]);

  React.useEffect(() => {
    let active = true;

    (async () => {
      const session = await loadAdminSession();

      if (!active) return;

      if (!session?.authenticated) {
        setIsAuthenticated(false);
        setAuthReady(true);
        return;
      }

      setIsAuthenticated(true);
      const remote = await loadAdminPortalState();
      if (active && remote) {
        setPortal(remote);
      }
      // load series for admin
      try {
        const s = await loadSeries();
        if (active) setSeriesList(s || []);
      } catch (e) {
        // ignore
      }
      setAuthReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  const examCards = React.useMemo(() => buildExamCards(portal.questions, portal.exams), [portal.questions, portal.exams]);
  const examOptions = React.useMemo(() => examCards.map((exam) => exam.label), [examCards]);

  const filteredQuestions = React.useMemo(() => {
    const search = questionSearch.trim().toLowerCase();

    return [...portal.questions]
      .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())
      .filter((question) => {
        if (questionExamFilter !== 'all' && question.exam !== questionExamFilter) return false;
        if (questionYearFilter !== 'all' && String(question.year) !== String(questionYearFilter)) return false;
        if (questionDifficultyFilter !== 'all' && question.difficulty !== questionDifficultyFilter) return false;

        if (!search) return true;

        return [question.exam, question.subject, question.chapter, question.question_text, question.shift, question.year]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
  }, [portal.questions, questionSearch, questionExamFilter, questionYearFilter, questionDifficultyFilter]);

  const activityFeed = React.useMemo(() => {
    return [...portal.activity]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 12);
  }, [portal.activity]);

  const now = new Date();
  const last24Hours = new Date(now);
  last24Hours.setHours(last24Hours.getHours() - 24);
  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);
  const last365Days = new Date(now);
  last365Days.setDate(last365Days.getDate() - 365);

  const questionCreatedActivity = React.useMemo(() => portal.activity.filter((entry) => entry.type.startsWith('question.')), [portal.activity]);

  const summary = React.useMemo(() => ({
    totalQuestions: portal.questions.length,
    totalExams: examCards.length,
    totalContributions: questionCreatedActivity.filter((entry) => entry.type === 'question.created').length,
    todayContributions: countSince(questionCreatedActivity.filter((entry) => entry.type === 'question.created'), last24Hours),
    weeklyContributions: countSince(questionCreatedActivity.filter((entry) => entry.type === 'question.created'), last7Days),
    yearlyContributions: countSince(questionCreatedActivity.filter((entry) => entry.type === 'question.created'), last365Days),
    solvedQuestions: getTotalSolved(),
    studyAccuracy: Number.parseFloat(getAccuracy() || '0'),
    currentStreak: getCurrentStreak(),
  }), [portal.questions.length, examCards.length, questionCreatedActivity, last24Hours, last7Days, last365Days, getTotalSolved, getAccuracy, getCurrentStreak]);

  const examSeries = React.useMemo(() => buildGroupedSeries(portal.questions, (question) => question.exam || 'Unknown'), [portal.questions]);
  const subjectSeries = React.useMemo(() => buildGroupedSeries(portal.questions, (question) => question.subject || 'Unknown'), [portal.questions]);
  const difficultySeries = React.useMemo(() => buildGroupedSeries(portal.questions, (question) => question.difficulty || 'Unknown'), [portal.questions]);

  const questionYearOptions = React.useMemo(() => {
    return [...new Set(portal.questions.map((question) => question.year))].sort((left, right) => Number(right) - Number(left));
  }, [portal.questions]);

  const subjectsForExam = React.useMemo(() => getSubjectOptionsForExam(questionDraft.exam, portal.questions), [portal.questions, questionDraft.exam]);
  const chaptersForExamSubject = React.useMemo(() => getChapterOptionsForSubject(questionDraft.subject, portal.questions, questionDraft.exam), [portal.questions, questionDraft.exam, questionDraft.subject]);

  const chapterValueIsPreset = chaptersForExamSubject.includes(questionDraft.chapter);

  const updateQuestionDraft = (field, value) => {
    setQuestionDraft((current) => ({ ...current, [field]: value }));
  };

  const handleQuestionImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateQuestionDraft('image', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleOptionImageChange = async (option, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateQuestionDraft(`option${option}Image`, String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const updateExamDraft = (field, value) => {
    setExamDraft((current) => ({ ...current, [field]: value }));
  };

  const resetQuestionForm = (prefill = {}) => {
    setEditingQuestionId(null);
    setQuestionDraft(createQuestionDraft(prefill));
  };

  const resetExamForm = (prefill = {}) => {
    setEditingExamId(null);
    setExamDraft(createExamDraft(prefill));
  };

  const syncPortal = (nextState) => {
    setPortal(nextState);
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();

    if (!questionDraft.exam.trim() || !questionDraft.question_text.trim()) {
      toast.error('Exam and question text are required.');
      return;
    }

    const timestamp = new Date().toISOString();
    const normalizedQuestion = normalizeQuestion({
      ...(portal.questions.find((question) => question.id === editingQuestionId) || {}),
      id: editingQuestionId || generateId('question'),
      exam: questionDraft.exam.trim(),
      exam_slug: slugify(questionDraft.exam.trim()),
      year: Number(questionDraft.year) || new Date().getFullYear(),
      shift: questionDraft.shift.trim() || 'Shift 1',
      subject: questionDraft.subject.trim(),
      chapter: questionDraft.chapter.trim(),
      difficulty: questionDraft.difficulty,
      question_text: questionDraft.question_text.trim(),
      image: questionDraft.image.trim(),
      options: {
        A: questionDraft.optionA.trim(),
        B: questionDraft.optionB.trim(),
        C: questionDraft.optionC.trim(),
        D: questionDraft.optionD.trim(),
      },
      option_images: {
        A: questionDraft.optionAImage.trim(),
        B: questionDraft.optionBImage.trim(),
        C: questionDraft.optionCImage.trim(),
        D: questionDraft.optionDImage.trim(),
      },
      correct_answer: questionDraft.correct_answer,
      explanation: questionDraft.explanation.trim(),
      solution: questionDraft.explanation.trim(),
      created_at: portal.questions.find((question) => question.id === editingQuestionId)?.created_at || timestamp,
      updated_at: timestamp,
      contributed_by: portal.profile.name,
    });

    const nextQuestions = editingQuestionId
      ? portal.questions.map((question) => (question.id === editingQuestionId ? normalizedQuestion : question))
      : [normalizedQuestion, ...portal.questions];

    const nextActivity = [
      createActivityEntry({
        type: editingQuestionId ? 'question.updated' : 'question.created',
        title: editingQuestionId ? `Updated ${normalizedQuestion.exam} ${normalizedQuestion.year}` : `Added ${normalizedQuestion.exam} ${normalizedQuestion.year}`,
        description: `${normalizedQuestion.subject || 'General'} / ${normalizedQuestion.chapter || 'No chapter'}`,
        exam: normalizedQuestion.exam,
        questionId: normalizedQuestion.id,
      }),
      ...portal.activity,
    ];

    const nextPortal = { ...portal, questions: nextQuestions, activity: nextActivity };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);
    toast.success(editingQuestionId ? 'Question updated.' : 'Question added.');
    resetQuestionForm();
  };

  const handleQuestionEdit = (question) => {
    setEditingQuestionId(question.id);
    setQuestionDraft(buildQuestionDraftFromQuestion(question));
    setTab('questions');
  };

  const handleQuestionDelete = async (question) => {
    const confirmed = window.confirm(`Delete ${question.exam} ${question.year}? This only removes the question record.`);
    if (!confirmed) return;

    const nextQuestions = portal.questions.filter((item) => item.id !== question.id);
    const nextActivity = [
      createActivityEntry({
        type: 'question.deleted',
        title: `Deleted ${question.exam} ${question.year}`,
        description: `${question.subject || 'General'} / ${question.chapter || 'No chapter'}`,
        exam: question.exam,
        questionId: question.id,
      }),
      ...portal.activity,
    ];

    const nextPortal = { ...portal, questions: nextQuestions, activity: nextActivity };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);
    toast.success('Question deleted.');
  };

  const handleExamSubmit = async (event) => {
    event.preventDefault();

    if (!examDraft.label.trim()) {
      toast.error('Exam label is required.');
      return;
    }

    const timestamp = new Date().toISOString();
    const normalizedExam = normalizeExam({
      ...(portal.exams.find((exam) => exam.id === editingExamId) || {}),
      id: editingExamId || generateId('exam'),
      label: examDraft.label.trim(),
      slug: slugify(examDraft.label.trim()),
      description: examDraft.description.trim(),
      status: examDraft.status,
      notes: examDraft.notes.trim(),
      created_at: portal.exams.find((exam) => exam.id === editingExamId)?.created_at || timestamp,
      updated_at: timestamp,
    });

    const nextExams = editingExamId
      ? portal.exams.map((exam) => (exam.id === editingExamId ? normalizedExam : exam))
      : [normalizedExam, ...portal.exams];

    const nextActivity = [
      createActivityEntry({
        type: editingExamId ? 'exam.updated' : 'exam.created',
        title: editingExamId ? `Updated ${normalizedExam.label}` : `Added ${normalizedExam.label}`,
        description: normalizedExam.description || normalizedExam.status,
      }),
      ...portal.activity,
    ];

    const nextPortal = { ...portal, exams: nextExams, activity: nextActivity };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);
    toast.success(editingExamId ? 'Exam updated.' : 'Exam added.');
    resetExamForm();
  };

  const handleExamEdit = (exam) => {
    setEditingExamId(exam.id);
    setExamDraft(buildExamDraftFromExam(exam));
    setTab('exams');
  };

  const handleExamDelete = async (exam) => {
    const confirmed = window.confirm(`Delete the catalog record for ${exam.label}? Questions using this exam stay in the library.`);
    if (!confirmed) return;

    const nextExams = portal.exams.filter((item) => item.id !== exam.id);
    const nextActivity = [
      createActivityEntry({
        type: 'exam.deleted',
        title: `Removed ${exam.label}`,
        description: exam.description || 'Catalog record removed',
      }),
      ...portal.activity,
    ];

    const nextPortal = { ...portal, exams: nextExams, activity: nextActivity };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);
    toast.success('Exam catalog entry removed.');
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const nextProfile = {
      ...portal.profile,
      ...profileDraft,
      weeklyGoal: Number(profileDraft.weeklyGoal) || ADMIN_PROFILE_DEFAULT.weeklyGoal,
    };

    const nextPortal = { ...portal, profile: nextProfile };
    syncPortal(nextPortal);
    await savePortalState(nextPortal);
    toast.success('Profile updated.');
  };

  const weeklyProgress = Math.min(100, Math.round((summary.weeklyContributions / Math.max(1, portal.profile.weeklyGoal || ADMIN_PROFILE_DEFAULT.weeklyGoal)) * 100));
  const statusTone = summary.todayContributions > 0 ? 'bg-foreground text-background' : 'bg-secondary text-foreground';

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-[2rem] border-border/80 shadow-xl">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2 text-center">
              <Badge className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-background">Admin access</Badge>
              <h1 className="text-3xl font-black uppercase tracking-tight">Checking admin access</h1>
              <p role="status" className="text-sm text-muted-foreground">Verifying your approved Google sign-in.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-[2rem] border-border/80 shadow-xl">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2 text-center">
              <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em]">Locked</Badge>
              <h1 className="text-3xl font-black uppercase tracking-tight">Admin session unavailable</h1>
              <p className="text-sm text-muted-foreground">Refresh the portal and sign in with an approved Google account to continue.</p>
            </div>
            <Button className="w-full rounded-full px-5 font-black uppercase tracking-[0.18em]" onClick={() => window.location.reload()}>
              Reload portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Admin Portal - Impulse</title>
        <meta name="description" content="Manage exams, previous-year questions, and content analytics for Impulse." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background transition-all hover:bg-secondary"
                aria-label="Back to site"
              >
                <ColoredIcon icon={ArrowLeft} name="back" size={4} />
              </Link>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">Impulse control room</p>
                <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Admin Portal</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                onClick={toggleTheme}
                title={isDark ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle admin theme"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background transition-all hover:bg-secondary"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="outline"
                onClick={toggleTheme}
                title={isDark ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle admin theme"
                className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]"
              >
                {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {isDark ? 'Light' : 'Dark'}
              </Button>
              <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
                {summary.totalQuestions} questions
              </Badge>
              <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
                {summary.totalExams} exams
              </Badge>
              <Badge className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] ${statusTone}`}>
                {summary.todayContributions > 0 ? 'Live today' : 'Idle today'}
              </Badge>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-8xl px-6 py-10 sm:px-8 lg:px-12 lg:py-12">
          {/* Hero banner removed as requested */}

          <TopStats summary={summary} portal={portal} weeklyProgress={weeklyProgress} />

          {/* Module shortcut cards removed per request */}

          <section className="mt-8">
            <div>
                <div className={`grid gap-6 ${collapsed ? 'lg:grid-cols-[80px_1fr]' : 'lg:grid-cols-[200px_1fr]'}`}>
              <aside className={`sticky top-6 z-10 h-[calc(100vh-96px)] overflow-auto rounded-[1.5rem] bg-secondary/40 ${collapsed ? 'px-2 py-3' : 'p-3'}`}>
                  <div className="space-y-3">
                    <div className="px-1">
                      <div className="flex items-center justify-end">
                        <button type="button" onClick={() => setCollapsed((c) => !c)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                          <ChevronRight className={`${collapsed ? 'rotate-180' : ''} h-4 w-4`} />
                        </button>
                      </div>

                      <div className="mt-2 space-y-2">
                        <button type="button" onClick={() => setTab('overview')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'overview' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <LayoutDashboard className="h-4 w-4" />
                          {!collapsed && 'Overview'}
                        </button>
                        <button type="button" onClick={() => setTab('questions')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'questions' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <PencilLine className="h-4 w-4" />
                          {!collapsed && 'Questions'}
                        </button>
                        <button type="button" onClick={() => setTab('exams')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'exams' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <BadgePlus className="h-4 w-4" />
                          {!collapsed && 'Exams'}
                        </button>
                        <button type="button" onClick={() => setTab('series')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'series' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <BookOpen className="h-4 w-4" />
                          {!collapsed && 'Series'}
                        </button>
                        <button type="button" onClick={() => setTab('pro')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'pro' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <Shield className="h-4 w-4" />
                          {!collapsed && 'Pro access'}
                        </button>
                        <button type="button" onClick={() => setTab('profile')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'profile' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <UserCircle2 className="h-4 w-4" />
                          {!collapsed && 'Profile'}
                        </button>
                      </div>
                    </div>

                    {!collapsed && (
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground px-1">Quick actions</p>
                        <div className="mt-3 flex flex-col gap-2 px-1">
                          <Button onClick={() => { setTab('questions'); resetQuestionForm(); }} className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em]">New question</Button>
                          <Button variant="outline" onClick={() => { setTab('exams'); resetExamForm(); }} className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em]">New exam</Button>
                          <Button variant="ghost" onClick={() => { setTab('overview'); }} className="rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em]">Refresh data</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </aside>

                <div className="workspace pr-2">
                  {tab === 'overview' && (
                    <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <BarChart3 className="h-5 w-5" />
                        Content snapshot
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Daily</p>
                          <p className="mt-1 text-3xl font-black">{summary.todayContributions}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Weekly</p>
                          <p className="mt-1 text-3xl font-black">{summary.weeklyContributions}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Yearly</p>
                          <p className="mt-1 text-3xl font-black">{summary.yearlyContributions}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Solved</p>
                          <p className="mt-1 text-3xl font-black">{summary.solvedQuestions}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Top exams</p>
                        <div className="flex flex-wrap gap-2">
                          {examSeries.map((exam) => (
                            <Badge key={exam.name} variant="outline" className="rounded-full border-border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
                              {exam.name} <span className="ml-2 text-muted-foreground">{exam.value}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <Users className="h-5 w-5" />
                        Recent activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {activityFeed.length ? activityFeed.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/25 p-4">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
                            <ColoredIcon icon={entry.type.startsWith('question.') ? BookOpen : ClipboardList} name={entry.type} size={4} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black uppercase tracking-tight">{entry.title}</p>
                              <Badge variant="outline" className="rounded-full border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]">
                                {ACTIVITY_TYPES[entry.type] || titleCase(entry.type)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.description || entry.exam || 'Question pipeline activity'}</p>
                            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          No activity has been recorded yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                  </div>
                  )}

              {tab === 'questions' && (
                <div className="space-y-6">
                <SectionHeading
                  eyebrow="Question studio"
                  title="Add, edit, and remove PYQs"
                  description="Each question stores the exam, year, shift, subject, chapter, correct option, and solution text. Updates are saved locally and reflected across the app after navigation or refresh."
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    value={questionSearch}
                    onChange={(event) => setQuestionSearch(event.target.value)}
                    placeholder="Search by exam, year, subject, or chapter"
                    className="max-w-md rounded-full border-border bg-background px-4"
                  />
                  <Button variant="outline" onClick={() => { setQuestionSearch(''); setQuestionExamFilter('all'); setQuestionYearFilter('all'); setQuestionDifficultyFilter('all'); }} className="rounded-full border-border px-5 font-black uppercase tracking-[0.18em]">
                    Clear filters
                  </Button>
                  <Button onClick={() => resetQuestionForm()} className="rounded-full px-5 font-black uppercase tracking-[0.18em]">
                    <Plus className="mr-2 h-4 w-4" />
                    New question
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PillButton active={questionExamFilter === 'all'} onClick={() => setQuestionExamFilter('all')}>All exams</PillButton>
                  {examOptions.map((exam) => (
                    <PillButton key={exam} active={questionExamFilter === exam} onClick={() => setQuestionExamFilter(exam)}>
                      {exam}
                    </PillButton>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <PillButton active={questionYearFilter === 'all'} onClick={() => setQuestionYearFilter('all')}>All years</PillButton>
                  {questionYearOptions.map((year) => (
                    <PillButton key={year} active={questionYearFilter === String(year)} onClick={() => setQuestionYearFilter(String(year))}>
                      {year}
                    </PillButton>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <PillButton active={questionDifficultyFilter === 'all'} onClick={() => setQuestionDifficultyFilter('all')}>All difficulty</PillButton>
                  {DIFFICULTY_OPTIONS.map((difficulty) => (
                    <PillButton key={difficulty} active={questionDifficultyFilter === difficulty} onClick={() => setQuestionDifficultyFilter(difficulty)}>
                      {difficulty}
                    </PillButton>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <PencilLine className="h-5 w-5" />
                        {editingQuestionId ? 'Edit question' : 'Create question'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-5" onSubmit={handleQuestionSubmit}>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Exam</label>
                          {examOptions.length > 0 ? (
                            <select
                              value={questionDraft.exam}
                              onChange={(event) => {
                                updateQuestionDraft('exam', event.target.value);
                                updateQuestionDraft('subject', '');
                                updateQuestionDraft('chapter', '');
                              }}
                              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium"
                            >
                              <option value="">Select exam</option>
                              {examOptions.map((exam) => (
                                <option key={exam} value={exam}>{exam}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              value={questionDraft.exam}
                              onChange={(event) => updateQuestionDraft('exam', event.target.value)}
                              placeholder="e.g. JEE MAINS"
                              className="rounded-2xl border-border"
                            />
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Year</label>
                            <Input
                              type="number"
                              value={questionDraft.year}
                              onChange={(event) => updateQuestionDraft('year', event.target.value)}
                              className="rounded-2xl border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Shift</label>
                            <Input
                              value={questionDraft.shift}
                              onChange={(event) => updateQuestionDraft('shift', event.target.value)}
                              placeholder="Shift 1"
                              className="rounded-2xl border-border"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Subject</label>
                            {subjectsForExam.length > 0 ? (
                              <select
                                value={questionDraft.subject}
                                onChange={(event) => {
                                  updateQuestionDraft('subject', event.target.value);
                                  updateQuestionDraft('chapter', '');
                                }}
                                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium"
                              >
                                <option value="">Select subject</option>
                                {subjectsForExam.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                value={questionDraft.subject}
                                onChange={(event) => updateQuestionDraft('subject', event.target.value)}
                                placeholder="Physics"
                                className="rounded-2xl border-border"
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Chapter</label>
                            {chaptersForExamSubject.length > 0 ? (
                              <>
                                <select
                                  value={chapterValueIsPreset ? questionDraft.chapter : ''}
                                  onChange={(event) => updateQuestionDraft('chapter', event.target.value)}
                                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium"
                                >
                                  <option value="">Select chapter</option>
                                  {chaptersForExamSubject.map((chapter) => (
                                    <option key={chapter} value={chapter}>{chapter}</option>
                                  ))}
                                </select>
                                {!chapterValueIsPreset ? (
                                  <Input
                                    value={questionDraft.chapter}
                                    onChange={(event) => updateQuestionDraft('chapter', event.target.value)}
                                    placeholder="Or type a custom chapter"
                                    className="rounded-2xl border-border"
                                  />
                                ) : null}
                              </>
                            ) : (
                              <Input
                                value={questionDraft.chapter}
                                onChange={(event) => updateQuestionDraft('chapter', event.target.value)}
                                placeholder="Mechanics"
                                className="rounded-2xl border-border"
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Difficulty</label>
                          <div className="flex flex-wrap gap-2">
                            {DIFFICULTY_OPTIONS.map((difficulty) => (
                              <PillButton key={difficulty} active={questionDraft.difficulty === difficulty} onClick={() => updateQuestionDraft('difficulty', difficulty)}>
                                {difficulty}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Question text</label>
                          <Textarea
                            value={questionDraft.question_text}
                            onChange={(event) => updateQuestionDraft('question_text', event.target.value)}
                            placeholder="Write the full question statement here"
                            className="min-h-[120px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Question image</label>
                          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 space-y-3">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleQuestionImageChange}
                              className="rounded-2xl border-border bg-background"
                            />
                            {questionDraft.image ? (
                              <div className="space-y-3">
                                <img
                                  src={questionDraft.image}
                                  alt="Question preview"
                                  className="max-h-[280px] w-full rounded-2xl border border-border object-contain bg-background"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => updateQuestionDraft('image', '')}
                                  className="rounded-full border-border px-4 text-xs font-black uppercase tracking-[0.18em]"
                                >
                                  Remove image
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Upload a diagram or question image. It will appear below the question text in practice mode.</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {ANSWER_OPTIONS.map((option) => (
                            <div key={option} className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Option {option}</label>
                                <label
                                  htmlFor={`option-${option}-image`}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-secondary text-foreground text-lg font-black cursor-pointer hover:border-foreground"
                                >
                                  +
                                </label>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input
                                  value={questionDraft[`option${option}`]}
                                  onChange={(event) => updateQuestionDraft(`option${option}`, event.target.value)}
                                  placeholder={`Answer option ${option}`}
                                  className="flex-1 rounded-2xl border-border"
                                />
                                <input
                                  id={`option-${option}-image`}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => handleOptionImageChange(option, event)}
                                />
                              </div>
                              {questionDraft[`option${option}Image`] ? (
                                <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-3">
                                  <img
                                    src={questionDraft[`option${option}Image`]}
                                    alt={`Option ${option} preview`}
                                    className="max-h-[180px] w-full rounded-2xl border border-border object-contain bg-background"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => updateQuestionDraft(`option${option}Image`, '')}
                                    className="rounded-full border-border px-3 text-xs font-black uppercase tracking-[0.18em]"
                                  >
                                    Remove image
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Add an image to option {option}.</p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Correct option</label>
                          <div className="flex flex-wrap gap-2">
                            {ANSWER_OPTIONS.map((option) => (
                              <PillButton key={option} active={questionDraft.correct_answer === option} onClick={() => updateQuestionDraft('correct_answer', option)}>
                                {option}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Solution / explanation</label>
                          <Textarea
                            value={questionDraft.explanation}
                            onChange={(event) => updateQuestionDraft('explanation', event.target.value)}
                            placeholder="Explain why the selected option is correct"
                            className="min-h-[120px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" className="rounded-full px-5 font-black uppercase tracking-[0.18em]">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {editingQuestionId ? 'Save changes' : 'Save question'}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => resetQuestionForm()} className="rounded-full border-border px-5 font-black uppercase tracking-[0.18em]">
                            Reset form
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                          <BookOpen className="h-5 w-5" />
                          Question library
                        </CardTitle>
                        <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
                          {filteredQuestions.length} shown
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click edit to load a question into the studio, or delete to remove it from storage.
                      </p>
                    </CardHeader>
                    <CardContent className="overflow-hidden">
                      <div className="overflow-x-auto rounded-[1.25rem] border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[180px]">Question</TableHead>
                              <TableHead>Exam</TableHead>
                              <TableHead>Year / shift</TableHead>
                              <TableHead>Correct</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredQuestions.length ? filteredQuestions.map((question) => (
                              <TableRow key={question.id}>
                                <TableCell className="max-w-[220px] align-top">
                                  <div className="space-y-1">
                                    <p className="line-clamp-3 text-sm font-medium leading-relaxed">{question.question_text}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <Badge variant="outline" className="rounded-full border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]">
                                        {question.subject || 'General'}
                                      </Badge>
                                      <Badge variant="outline" className="rounded-full border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]">
                                        {question.chapter || 'No chapter'}
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top font-black uppercase tracking-tight">{question.exam}</TableCell>
                                <TableCell className="align-top">
                                  <div className="space-y-1 text-sm">
                                    <p className="font-black">{question.year}</p>
                                    <p className="text-muted-foreground">{question.shift}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <Badge className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-background">
                                    {question.correct_answer}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleQuestionEdit(question)} className="rounded-full border-border px-3 font-black uppercase tracking-[0.16em]">
                                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                                      Edit
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleQuestionDelete(question)} className="rounded-full border-border px-3 font-black uppercase tracking-[0.16em] text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                  No questions match the current filters.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                </div>
              )}

              {tab === 'exams' && (
                <div className="space-y-6">
                <SectionHeading
                  eyebrow="Exam catalog"
                  title="Add and manage exam shells"
                  description="This catalog stores the exam label, description, notes, and status. Removing a catalog entry only deletes the manual exam record, not the questions attached to that exam."
                />

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]">
                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <BadgePlus className="h-5 w-5" />
                        {editingExamId ? 'Edit exam' : 'Create exam'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-5" onSubmit={handleExamSubmit}>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Exam label</label>
                          <Input
                            value={examDraft.label}
                            onChange={(event) => updateExamDraft('label', event.target.value)}
                            placeholder="JEE Main"
                            className="rounded-2xl border-border"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Description</label>
                          <Textarea
                            value={examDraft.description}
                            onChange={(event) => updateExamDraft('description', event.target.value)}
                            placeholder="What does this exam cover?"
                            className="min-h-[110px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Status</label>
                          <div className="flex flex-wrap gap-2">
                            {EXAM_STATUS_OPTIONS.map((status) => (
                              <PillButton key={status} active={examDraft.status === status} onClick={() => updateExamDraft('status', status)}>
                                {status}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Notes</label>
                          <Textarea
                            value={examDraft.notes}
                            onChange={(event) => updateExamDraft('notes', event.target.value)}
                            placeholder="Internal notes, shift rules, year ranges, and publishing reminders"
                            className="min-h-[110px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" className="rounded-full px-5 font-black uppercase tracking-[0.18em]">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {editingExamId ? 'Save changes' : 'Save exam'}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => resetExamForm()} className="rounded-full border-border px-5 font-black uppercase tracking-[0.18em]">
                            Reset form
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                          <Users className="h-5 w-5" />
                          Exam catalog
                        </CardTitle>
                        <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
                          {examCards.length} cards
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {examCards.map((exam) => (
                        <div key={exam.id} className="rounded-[1.5rem] border border-border bg-secondary/20 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-black uppercase tracking-tight">{exam.label}</h3>
                                <Badge variant="outline" className="rounded-full border-border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                                  {exam.manual ? 'Manual' : 'Derived'}
                                </Badge>
                                <Badge className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-background">
                                  {exam.status}
                                </Badge>
                              </div>
                              <p className="max-w-2xl text-sm text-muted-foreground">{exam.description}</p>
                              <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                                <span>{exam.questionCount} questions</span>
                                <span>•</span>
                                <span>{exam.subjects.length || 0} subjects</span>
                                <span>•</span>
                                <span>{exam.shifts.length || 0} shifts</span>
                                <span>•</span>
                                <span>{exam.years.length || 0} years</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {exam.years.slice(0, 5).map((year) => (
                                  <Badge key={`${exam.slug}-${year}`} variant="outline" className="rounded-full border-border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                                    {year}
                                  </Badge>
                                ))}
                                {exam.subjects.slice(0, 4).map((subject) => (
                                  <Badge key={`${exam.slug}-${subject}`} variant="outline" className="rounded-full border-border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                                    {subject}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              <Button size="sm" variant="outline" onClick={() => handleExamEdit(exam)} className="rounded-full border-border px-3 font-black uppercase tracking-[0.16em]">
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleExamDelete(exam)} className="rounded-full border-border px-3 font-black uppercase tracking-[0.16em] text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
                </div>
              )}

              {tab === 'series' && (
                <TestSeriesManager />
              )}

              {tab === 'pro' && (
                <BillingAdminPanel />
              )}

              {tab === 'profile' && (
                <div className="space-y-6">
                <SectionHeading
                  eyebrow="Profile tracker"
                  title="Monitor admin output and study impact"
                  description="The profile area keeps the account details, publishing goals, and contribution tracker in one place. The progress bar is tied to the weekly question contribution goal."
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
                  <Card className="rounded-[1.75rem] border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <UserCircle2 className="h-5 w-5" />
                        Profile editor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-5" onSubmit={handleProfileSave}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Name</label>
                            <Input
                              value={profileDraft.name}
                              onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
                              className="rounded-2xl border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Role</label>
                            <Input
                              value={profileDraft.role}
                              onChange={(event) => setProfileDraft((current) => ({ ...current, role: event.target.value }))}
                              className="rounded-2xl border-border"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Email</label>
                            <Input
                              value={profileDraft.email}
                              onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))}
                              className="rounded-2xl border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Weekly goal</label>
                            <Input
                              type="number"
                              value={profileDraft.weeklyGoal}
                              onChange={(event) => setProfileDraft((current) => ({ ...current, weeklyGoal: event.target.value }))}
                              className="rounded-2xl border-border"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Bio</label>
                          <Textarea
                            value={profileDraft.bio}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
                            className="min-h-[100px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Focus</label>
                          <Textarea
                            value={profileDraft.focus}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, focus: event.target.value }))}
                            className="min-h-[100px] rounded-2xl border-border"
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" className="rounded-full px-5 font-black uppercase tracking-[0.18em]">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Save profile
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setProfileDraft({ ...portal.profile })} className="rounded-full border-border px-5 font-black uppercase tracking-[0.18em]">
                            Revert
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card className="rounded-[1.75rem] border-border/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                          <Shield className="h-5 w-5" />
                          Profile tracker
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16 border border-border bg-secondary">
                            <AvatarFallback className="bg-foreground text-lg font-black text-background">
                              {initials(profileDraft.name || portal.profile.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-2xl font-black uppercase tracking-tight">{profileDraft.name || portal.profile.name}</h3>
                            <p className="text-sm text-muted-foreground">{profileDraft.role || portal.profile.role}</p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{profileDraft.email || portal.profile.email}</p>
                          </div>
                        </div>

                        {/* Top-level stats are shown in the persistent header; removed duplicate summary cards here. */}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Bio</p>
                            <p className="mt-2 text-sm leading-relaxed text-foreground">{profileDraft.bio || portal.profile.bio}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Focus</p>
                            <p className="mt-2 text-sm leading-relaxed text-foreground">{profileDraft.focus || portal.profile.focus}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[1.75rem] border-border/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                          <CalendarDays className="h-5 w-5" />
                          Content cadence
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Today', value: summary.todayContributions, icon: Flame },
                          { label: 'This week', value: summary.weeklyContributions, icon: ChevronRight },
                          { label: 'This year', value: summary.yearlyContributions, icon: Sparkles },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
                                <ColoredIcon icon={item.icon} name={item.label} size={4} />
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                                <p className="text-sm text-muted-foreground">Question pipeline activity</p>
                              </div>
                            </div>
                            <p className="text-2xl font-black">{item.value}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[1.75rem] border-border/80">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                          <Eye className="h-5 w-5" />
                          Activity log
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activityFeed.length ? activityFeed.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-black uppercase tracking-tight">{entry.title}</p>
                              <Badge variant="outline" className="rounded-full border-border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]">
                                {ACTIVITY_TYPES[entry.type] || titleCase(entry.type)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.description || 'Local action recorded in the portal.'}</p>
                            <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            No activity recorded yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
                </div>
              )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default AdminPortalPage;
