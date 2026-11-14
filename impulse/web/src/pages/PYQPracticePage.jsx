import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import QuestionCard from '@/components/QuestionCard.jsx';
import { loadPublicQuestionCatalog, loadPublicQuestionsPage } from '@/lib/portalServer';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Calculator, Microscope, GraduationCap, BookOpen, 
  Cpu, Globe, Zap, FlaskConical, Dna, 
  Languages, BrainCircuit, ArrowLeft, Filter, X,
  Atom, Sigma, Triangle, Infinity, Ruler, CircleDashed
} from 'lucide-react';
import ColoredIcon from '@/components/ColoredIcon';

// Configuration Data
const EXAMS = [
  { id: 'JEE MAINS', label: 'JEE MAINS', icon: Calculator },
  { id: 'NEET', label: 'NEET', icon: Microscope },
  { id: 'JEE ADVANCED', label: 'JEE ADVANCED', icon: GraduationCap },
  { id: 'MHTCET', label: 'MHTCET', icon: BookOpen },
  { id: 'BITSAT', label: 'BITSAT', icon: Cpu },
  { id: 'COMEDK', label: 'COMEDK', icon: Globe }
];

const SUBJECTS_MAP = {
  'NEET': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Biology', label: 'Biology', icon: Dna }
  ],
  'COMEDK': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Mathematics', label: 'Mathematics', icon: Calculator }
  ],
  'MHTCET': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Mathematics', label: 'Mathematics', icon: Calculator },
    { id: 'Biology', label: 'Biology', icon: Dna }
  ],
  'BITSAT': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Mathematics', label: 'Mathematics', icon: Calculator },
    { id: 'English', label: 'English', icon: Languages },
    { id: 'Logical Reasoning', label: 'Logical Reasoning', icon: BrainCircuit }
  ],
  'JEE': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Mathematics', label: 'Mathematics', icon: Calculator }
  ],
  'DEFAULT': [
    { id: 'Physics', label: 'Physics', icon: Zap },
    { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical },
    { id: 'Mathematics', label: 'Mathematics', icon: Calculator },
    { id: 'English', label: 'English', icon: Languages },
    { id: 'Logical Reasoning', label: 'Logical Reasoning', icon: BrainCircuit }
  ]
};

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const QUESTIONS_PAGE_SIZE = 20;

const MATH_CHAPTERS = [
  'Basic Math',
  'Quadratic Equations',
  'Complex Numbers',
  'P&C',
  'Sequences & Series',
  'Math Induction',
  'Binomial Theorem',
  'Trigonometry',
  'Trigonometric Equations',
  'Straight Lines',
  'Pair of Lines',
  'Circle',
  'Parabola',
  'Ellipse',
  'Hyperbola',
  'Limits',
  'Mathematical Reasoning',
  'Statistics',
  'Heights & Distances',
  'Properties of Triangles',
  'Sets & Relations',
  'Matrices',
  'Determinants',
  'ITF',
  'Functions',
  'C&D',
  'Differentiation',
  'AOD',
  'Indefinite Integration',
  'Definite Integration',
  'Area Under Curves',
  'Differential Eqns',
  'Vector Algebra',
  '3D Geometry',
  'Linear Programming',
  'Probability',
];

const MATH_CHAPTER_ICONS = [
  Atom,
  Sigma,
  Triangle,
  Infinity,
  Ruler,
  CircleDashed,
  Calculator,
  BookOpen,
  BrainCircuit,
];

const MATH_CHAPTER_CARDS = MATH_CHAPTERS.map((chapter, index) => ({
  chapter,
  icon: MATH_CHAPTER_ICONS[index % MATH_CHAPTER_ICONS.length],
}));

const CHEMISTRY_CHAPTERS = [
  'Mole Concept',
  'Atomic Structure',
  'Periodic Table',
  'Chemical Bonding',
  'States of Matter',
  'Thermodynamics (C)',
  'Chemical Equilibrium',
  'Ionic Equilibrium',
  'Redox Reactions',
  'Hydrogen',
  's Block',
  'p Block (G13-14)',
  'GOC',
  'Hydrocarbons',
  'Env. Chemistry',
  'Solid State',
  'Solutions',
  'Electrochemistry',
  'Chemical Kinetics',
  'Surface Chemistry',
  'Metallurgy',
  'p Block (G15-18)',
  'd & f Block',
  'Coordination Compounds',
  'Haloalkanes & Haloarenes',
  'Alcohols, Phenols & Ethers',
  'Aldehydes & Ketones',
  'Carboxylic Acids',
  'Amines',
  'Biomolecules',
  'Polymers',
  'Everyday Chemistry',
  'Practical Chemistry',
];

const CHEMISTRY_CHAPTER_ICONS = [
  FlaskConical,
  Atom,
  Sigma,
  CircleDashed,
  Ruler,
  Infinity,
  BrainCircuit,
  Dna,
  Triangle,
  Calculator,
  BookOpen,
  Zap,
];

const CHEMISTRY_CHAPTER_CARDS = CHEMISTRY_CHAPTERS.map((chapter, index) => ({
  chapter,
  icon: CHEMISTRY_CHAPTER_ICONS[index % CHEMISTRY_CHAPTER_ICONS.length],
}));

const PHYSICS_CHAPTERS = [
  'Math in Physics',
  'Units & Dimensions',
  'Motion in 1D',
  'Motion in 2D',
  'Laws of Motion',
  'Work Power Energy',
  'COM & Collisions',
  'Rotational Motion',
  'Gravitation',
  'Properties of Solids',
  'Properties of Fluids',
  'Thermal Properties',
  'Thermodynamics',
  'KTG',
  'Oscillations',
  'Waves & Sound',
  'Electrostatics',
  'Capacitance',
  'Current Electricity',
  'Magnetic Properties',
  'Magnetism & Current',
  'EMI',
  'AC Circuits',
  'EM Waves',
  'Ray Optics',
  'Wave Optics',
  'Dual Nature',
  'Atomic Physics',
  'Nuclear Physics',
  'Semiconductors',
  'Communication System',
  'Experimental Physics',
];

const PHYSICS_CHAPTER_ICONS = [
  Atom,
  Zap,
  Calculator,
  Ruler,
  Infinity,
  CircleDashed,
  Triangle,
  Sigma,
  BrainCircuit,
  BookOpen,
  Globe,
  Microscope,
];

const PHYSICS_CHAPTER_CARDS = PHYSICS_CHAPTERS.map((chapter, index) => ({
  chapter,
  icon: PHYSICS_CHAPTER_ICONS[index % PHYSICS_CHAPTER_ICONS.length],
}));

const BIOLOGY_CHAPTERS = [
  'The Living World',
  'Biological Classification',
  'Plant Kingdom',
  'Animal Kingdom',
  'Morphology of Flowering Plants',
  'Anatomy of Flowering Plants',
  'Structural Organisation in Animals',
  'Cell: The Unit of Life',
  'Biomolecules',
  'Cell Cycle and Cell Division',
  'Photosynthesis in Higher Plants',
  'Respiration in Plants',
  'Plant Growth and Development',
  'Breathing and Exchange of Gases',
  'Body Fluids and Circulation',
  'Excretory Products and their Elimination',
  'Locomotion and Movement',
  'Neural Control and Coordination',
  'Chemical Coordination and Integration',
  'Sexual Reproduction in Flowering Plants',
  'Human Reproduction',
  'Reproductive Health',
  'Principles of Inheritance and Variation',
  'Molecular Basis of Inheritance',
  'Evolution',
  'Human Health and Disease',
  'Microbes in Human Welfare',
  'Biotechnology: Principles and Processes',
  'Biotechnology and its Applications',
  'Organisms and Populations',
  'Ecosystem',
  'Biodiversity and Conservation',
];

const BIOLOGY_CHAPTER_ICONS = [
  Dna,
  Microscope,
  Atom,
  BrainCircuit,
  FlaskConical,
  BookOpen,
  Zap,
  Triangle,
  CircleDashed,
];

const BIOLOGY_CHAPTER_CARDS = BIOLOGY_CHAPTERS.map((chapter, index) => ({
  chapter,
  icon: BIOLOGY_CHAPTER_ICONS[index % BIOLOGY_CHAPTER_ICONS.length],
}));

const SUBJECT_CHAPTER_ICON_POOLS = {
  Physics: PHYSICS_CHAPTER_ICONS,
  Chemistry: CHEMISTRY_CHAPTER_ICONS,
  Mathematics: MATH_CHAPTER_ICONS,
  Biology: BIOLOGY_CHAPTER_ICONS,
  English: [Languages, BookOpen, Globe],
  'Logical Reasoning': [BrainCircuit, Triangle, Sigma],
};

function createChapterCards(chapters, subject) {
  const iconPool = SUBJECT_CHAPTER_ICON_POOLS[subject] || [BookOpen, Calculator, Atom, FlaskConical];

  return chapters.map((entry, index) => ({
    chapter: entry.chapter,
    count: entry.count,
    icon: iconPool[index % iconPool.length],
  }));
}

function PYQPracticePage() {
  const { isQuestionSolved } = useSolvedQuestions();

  // Navigation State
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterCatalog, setChapterCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionPage, setQuestionPage] = useState(1);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [questionError, setQuestionError] = useState(null);
  const [questionRetry, setQuestionRetry] = useState(0);
  const questionRequestId = useRef(0);

  useLayoutEffect(() => {
    if (step === 4) {
      const scrollContainer = document.querySelector('.main-content');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      } else {
        window.scrollTo(0, 0);
      }
    }
  }, [step, selectedChapter]);

  // Filter State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({ difficulty: [], year: [] });
  const [appliedFilters, setAppliedFilters] = useState({ difficulty: [], year: [] });

  // Handlers
  const handleExamSelect = (examId) => {
    setSelectedExam(examId);
    setStep(2);
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedChapter(null);

    if ((selectedExam === 'JEE MAINS' || selectedExam === 'JEE ADVANCED' || selectedExam === 'NEET' || selectedExam === 'BITSAT' || selectedExam === 'MHTCET') && (subjectId === 'Mathematics' || subjectId === 'Chemistry' || subjectId === 'Physics' || subjectId === 'Biology')) {
      setStep(3);
      return;
    }

    setStep(4);
  };

  const handleChapterSelect = (chapterName) => {
    setSelectedChapter(chapterName);
    setStep(4);
  };

  const handleBack = () => {
    if (step === 2) {
      setSelectedExam(null);
      setStep(1);
    } else if (step === 3) {
      if ((selectedExam === 'JEE MAINS' || selectedExam === 'JEE ADVANCED' || selectedExam === 'NEET' || selectedExam === 'BITSAT' || selectedExam === 'MHTCET') && (selectedSubject === 'Mathematics' || selectedSubject === 'Chemistry' || selectedSubject === 'Physics' || selectedSubject === 'Biology')) {
        setSelectedChapter(null);
        setStep(2);
      } else {
        setSelectedSubject(null);
        setStep(2);
      }
    } else if (step === 4) {
      if ((selectedExam === 'JEE MAINS' || selectedExam === 'JEE ADVANCED' || selectedExam === 'NEET' || selectedExam === 'BITSAT' || selectedExam === 'MHTCET') && (selectedSubject === 'Mathematics' || selectedSubject === 'Chemistry' || selectedSubject === 'Physics' || selectedSubject === 'Biology')) {
        setSelectedChapter(null);
        setStep(3);
      } else {
        setSelectedSubject(null);
        setStep(2);
      }
    }
  };

  const handleFilterToggle = (category, value) => {
    setLocalFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const applyFilters = () => {
    setAppliedFilters(localFilters);
    setIsFilterModalOpen(false);
  };

  useEffect(() => {
    const savedPracticeState = location.state?.practiceState;
    if (savedPracticeState) {
      const {
        step: savedStep,
        selectedExam: savedExam,
        selectedSubject: savedSubject,
        selectedChapter: savedChapter,
        appliedFilters: savedAppliedFilters,
        localFilters: savedLocalFilters,
      } = savedPracticeState;

      setStep(savedStep || 1);
      setSelectedExam(savedExam || null);
      setSelectedSubject(savedSubject || null);
      setSelectedChapter(savedChapter || null);
      setAppliedFilters(savedAppliedFilters || { difficulty: [], year: [] });
      setLocalFilters(savedLocalFilters || { difficulty: [], year: [] });
      navigate({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }, { replace: true, state: null });
    }
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  const openFilterModal = () => {
    setLocalFilters(appliedFilters);
    setIsFilterModalOpen(true);
  };

  useEffect(() => {
    let active = true;
    if (!selectedExam || !selectedSubject) {
      setChapterCatalog([]);
      setCatalogError(null);
      setIsCatalogLoading(false);
      return () => {
        active = false;
      };
    }

    setChapterCatalog([]);
    setIsCatalogLoading(true);
    setCatalogError(null);
    loadPublicQuestionCatalog(selectedExam, selectedSubject)
      .then((catalog) => {
        if (active) setChapterCatalog(catalog);
      })
      .catch((error) => {
        console.error('Could not load question chapter catalog.', error);
        if (active) setCatalogError(error.message || 'Could not load chapters. Please try again.');
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedExam, selectedSubject, catalogRetry]);

  useEffect(() => {
    const requestId = ++questionRequestId.current;
    setIsLoadingMore(false);
    if (step !== 4 || !selectedExam || !selectedSubject) {
      setPracticeQuestions([]);
      setQuestionTotal(0);
      setQuestionPage(1);
      setQuestionError(null);
      setIsQuestionsLoading(false);
      return undefined;
    }

    let active = true;
    setPracticeQuestions([]);
    setQuestionTotal(0);
    setQuestionPage(1);
    setQuestionError(null);
    setIsQuestionsLoading(true);
    loadPublicQuestionsPage({
      exam: selectedExam,
      subject: selectedSubject,
      chapter: selectedChapter || undefined,
      difficulty: appliedFilters.difficulty,
      year: appliedFilters.year,
    }, 1, QUESTIONS_PAGE_SIZE)
      .then((result) => {
        if (active && requestId === questionRequestId.current) {
          setPracticeQuestions(result.questions);
          setQuestionTotal(result.total);
          setQuestionPage(result.page);
        }
      })
      .catch((error) => {
        console.error('Could not load practice questions.', error);
        if (active && requestId === questionRequestId.current) {
          setQuestionError(error.message || 'Could not load questions. Please try again.');
        }
      })
      .finally(() => {
        if (active && requestId === questionRequestId.current) setIsQuestionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [step, selectedExam, selectedSubject, selectedChapter, appliedFilters, questionRetry]);

  const loadMoreQuestions = async () => {
    if (isLoadingMore || isQuestionsLoading || practiceQuestions.length >= questionTotal) return;
    const requestId = ++questionRequestId.current;
    setIsLoadingMore(true);
    setQuestionError(null);
    try {
      const result = await loadPublicQuestionsPage({
        exam: selectedExam,
        subject: selectedSubject,
        chapter: selectedChapter || undefined,
        difficulty: appliedFilters.difficulty,
        year: appliedFilters.year,
      }, questionPage + 1, QUESTIONS_PAGE_SIZE);
      if (requestId === questionRequestId.current) {
        setPracticeQuestions((current) => [...current, ...result.questions]);
        setQuestionTotal(result.total);
        setQuestionPage(result.page);
      }
    } catch (error) {
      console.error('Could not load more practice questions.', error);
      if (requestId === questionRequestId.current) {
        setQuestionError(error.message || 'Could not load more questions. Please try again.');
      }
    } finally {
      if (requestId === questionRequestId.current) setIsLoadingMore(false);
    }
  };

  // Derived Data
  const availableSubjects = selectedExam === 'NEET'
    ? SUBJECTS_MAP['NEET']
    : selectedExam === 'COMEDK'
      ? SUBJECTS_MAP['COMEDK']
      : selectedExam === 'MHTCET'
        ? SUBJECTS_MAP['MHTCET']
        : selectedExam === 'BITSAT'
          ? SUBJECTS_MAP['BITSAT']
    : (selectedExam === 'JEE MAINS' || selectedExam === 'JEE ADVANCED')
      ? SUBJECTS_MAP['JEE']
      : SUBJECTS_MAP['DEFAULT'];
  const availableChapterCards = useMemo(() => {
    const presetCards = {
      Physics: PHYSICS_CHAPTER_CARDS,
      Chemistry: CHEMISTRY_CHAPTER_CARDS,
      Mathematics: MATH_CHAPTER_CARDS,
      Biology: BIOLOGY_CHAPTER_CARDS,
    }[selectedSubject] || [];

    if (!selectedExam || !selectedSubject) {
      return presetCards.map(({ chapter, icon }) => ({ chapter, icon, count: 0 }));
    }

    const questionChapterCounts = new Map(
      chapterCatalog.map(({ chapter, count }) => [chapter, count])
    );

    const presetChapterNames = new Set(presetCards.map(({ chapter }) => chapter));
    const chaptersWithCounts = presetCards.map(({ chapter, icon }) => ({
      chapter,
      icon,
      count: questionChapterCounts.get(chapter) || 0,
    }));
    const iconPool = SUBJECT_CHAPTER_ICON_POOLS[selectedSubject] || [BookOpen, Calculator, Atom, FlaskConical];
    const customChapterCards = [...questionChapterCounts.entries()]
      .filter(([chapter]) => chapter !== 'Unspecified' && !presetChapterNames.has(chapter))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([chapter, count], index) => ({
        chapter,
        count,
        icon: iconPool[(presetCards.length + index) % iconPool.length],
      }));
    return [...chaptersWithCounts, ...customChapterCards];
  }, [chapterCatalog, selectedExam, selectedSubject]);

  const availableQuestionYears = useMemo(() => {
    const relevantChapters = selectedChapter
      ? chapterCatalog.filter(({ chapter }) => chapter === selectedChapter)
      : chapterCatalog;
    const matchingQuestionYears = relevantChapters.flatMap(({ years = [] }) => years);
    return [...new Set([...YEARS, ...matchingQuestionYears])]
      .sort((left, right) => Number(right) - Number(left));
  }, [chapterCatalog, selectedChapter]);

  return (
    <>
      <Helmet>
        <title>PYQ Practice - Impulse</title>
        <meta name="description" content="Practice previous year questions from top competitive exams" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Header Area */}
            <div className="mb-12">
              <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">Practice Questions</h1>
              <p className="text-lg text-muted-foreground">Select your exam and subject to begin</p>
            </div>

            {/* Step 1: Exam Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold tracking-tight uppercase">Select Exam</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {EXAMS.map(exam => (
                    <div 
                      key={exam.id} 
                      className="icon-card group"
                      onClick={() => handleExamSelect(exam.id)}
                    >
                      <ColoredIcon icon={exam.icon} name={exam.id} size={12} className="mb-4 text-foreground group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-xl font-black tracking-widest uppercase text-center">{exam.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Subject Selection */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={handleBack} className="font-bold border-2">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <h2 className="text-2xl font-bold tracking-tight uppercase">
                    Select Subject for <span className="text-muted-foreground">{selectedExam}</span>
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableSubjects.map(subject => (
                    <div 
                      key={subject.id} 
                      className="icon-card group"
                      onClick={() => handleSubjectSelect(subject.id)}
                    >
                      <ColoredIcon icon={subject.icon} name={subject.id} size={12} className="mb-4 text-foreground group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-xl font-black tracking-widest uppercase text-center">{subject.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Chapter Selection for Mathematics */}
            {step === 3 && ((selectedExam === 'JEE MAINS' || selectedExam === 'JEE ADVANCED' || selectedExam === 'NEET' || selectedExam === 'BITSAT' || selectedExam === 'MHTCET') && (selectedSubject === 'Mathematics' || selectedSubject === 'Chemistry' || selectedSubject === 'Physics' || selectedSubject === 'Biology')) && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={handleBack} className="font-bold border-2">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <h2 className="text-2xl font-bold tracking-tight uppercase">
                    Select Chapter for <span className="text-muted-foreground">{selectedExam} / {selectedSubject}</span>
                  </h2>
                </div>

                <div className="space-y-3">
                  {isCatalogLoading && (
                    <p className="text-sm font-bold text-muted-foreground" role="status">Loading available chapters...</p>
                  )}
                  {catalogError && (
                    <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
                      <p className="text-sm font-semibold text-destructive">
                        Could not load chapter counts: {catalogError}
                      </p>
                      <Button variant="outline" onClick={() => setCatalogRetry((retry) => retry + 1)}>
                        Try again
                      </Button>
                    </div>
                  )}
                  {!isCatalogLoading && !catalogError && availableChapterCards.map(({ chapter, icon, count }) => (
                    <button
                      key={chapter}
                      type="button"
                      onClick={() => handleChapterSelect(chapter)}
                      className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card px-5 py-5 text-left transition-all hover:border-primary hover:bg-secondary/30"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/40">
                        <ColoredIcon icon={icon} name={chapter} size={5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xl font-black uppercase tracking-tight">{chapter}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {count > 0 ? `${count} question${count === 1 ? '' : 's'} available` : 'No data yet'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Questions Display */}
            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {/* Breadcrumbs & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-2 border-border bg-secondary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Button variant="outline" onClick={handleBack} className="font-bold border-2">
                      <ColoredIcon icon={ArrowLeft} name="arrowleft" size={4} className="mr-2" /> Back
                    </Button>
                    <div className="flex items-center flex-wrap gap-2 text-sm font-bold uppercase tracking-widest">
                      <button onClick={() => setStep(1)} className="hover:text-muted-foreground transition-colors">{selectedExam}</button>
                      <span className="text-muted-foreground">/</span>
                      <button onClick={() => setStep(2)} className="hover:text-muted-foreground transition-colors">{selectedSubject}</button>
                      {selectedChapter ? (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <button onClick={() => setStep(3)} className="hover:text-muted-foreground transition-colors">{selectedChapter}</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Button onClick={openFilterModal} className="font-bold">
                      <ColoredIcon icon={Filter} name="filter" size={4} className="mr-2" /> 
                      Filters {(appliedFilters.difficulty.length > 0 || appliedFilters.year.length > 0) && `(${(appliedFilters.difficulty.length + appliedFilters.year.length)})`}
                    </Button>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Showing {practiceQuestions.length} of {questionTotal} questions
                  </p>
                </div>

                {/* Questions List */}
                {questionError && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 p-4" role="alert">
                    <p className="text-sm font-semibold text-destructive">{questionError}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (practiceQuestions.length > 0) {
                          loadMoreQuestions();
                        } else {
                          setQuestionRetry((retry) => retry + 1);
                        }
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                )}
                {isQuestionsLoading ? (
                  <p className="py-12 text-center text-sm font-bold text-muted-foreground" role="status">
                    Loading questions...
                  </p>
                ) : practiceQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {practiceQuestions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        questionNumber={index + 1}
                        isSolved={isQuestionSolved(question.id)}
                        state={{
                          from: '/pyq-practice',
                          practiceState: {
                            step,
                            selectedExam,
                            selectedSubject,
                            selectedChapter,
                            appliedFilters,
                            localFilters,
                          },
                        }}
                      />
                    ))}
                    {practiceQuestions.length < questionTotal && (
                      <div className="flex justify-center pt-4">
                        <Button onClick={loadMoreQuestions} disabled={isLoadingMore}>
                          {isLoadingMore ? 'Loading more questions...' : 'Load more questions'}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : !questionError && (
                  <div className="text-center py-24 border-2 border-dashed border-border bg-secondary/10">
                    <ColoredIcon icon={BookOpen} name="bookopen" size={16} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">No questions found</h3>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters or selecting a different subject.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
        <Footer />
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight">Filter Questions</h3>
                <button 
                onClick={() => setIsFilterModalOpen(false)}
                className="p-2 hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <ColoredIcon icon={X} name="x" size={5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-8">
              {/* Difficulty Filter */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground border-b-2 border-border pb-2">Difficulty</h4>
                <div className="space-y-3">
                  {DIFFICULTIES.map(diff => (
                    <div key={diff} className="flex items-center gap-3">
                      <Checkbox
                        id={`diff-${diff}`}
                        checked={localFilters.difficulty.includes(diff)}
                        onCheckedChange={() => handleFilterToggle('difficulty', diff)}
                        className="border-2"
                      />
                      <Label htmlFor={`diff-${diff}`} className="text-base font-bold cursor-pointer">{diff}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Year Filter */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground border-b-2 border-border pb-2">Year</h4>
                <div className="grid grid-cols-2 gap-3">
                  {availableQuestionYears.map(year => (
                    <div key={year} className="flex items-center gap-3">
                      <Checkbox
                        id={`year-${year}`}
                        checked={localFilters.year.includes(year)}
                        onCheckedChange={() => handleFilterToggle('year', year)}
                        className="border-2"
                      />
                      <Label htmlFor={`year-${year}`} className="text-base font-bold cursor-pointer">{year}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t-2 border-border flex justify-end gap-4">
              <Button 
                variant="outline" 
                className="font-bold border-2"
                onClick={() => setLocalFilters({ difficulty: [], year: [] })}
              >
                Clear All
              </Button>
              <Button onClick={applyFilters} className="font-bold">
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PYQPracticePage;