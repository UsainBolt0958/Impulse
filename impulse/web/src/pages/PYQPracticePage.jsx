import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import QuestionCard from '@/components/QuestionCard.jsx';
import { useQuestions } from '@/hooks/useQuestions';
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
  const { questions } = useQuestions();
  const { isQuestionSolved } = useSolvedQuestions();

  // Navigation State
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

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
    if (location.state?.practiceState) {
      const {
        step: savedStep,
        selectedExam: savedExam,
        selectedSubject: savedSubject,
        selectedChapter: savedChapter,
        appliedFilters: savedAppliedFilters,
        localFilters: savedLocalFilters,
      } = location.state.practiceState;

      setStep(savedStep || 1);
      setSelectedExam(savedExam || null);
      setSelectedSubject(savedSubject || null);
      setSelectedChapter(savedChapter || null);
      setAppliedFilters(savedAppliedFilters || { difficulty: [], year: [] });
      setLocalFilters(savedLocalFilters || { difficulty: [], year: [] });
    }
  }, [location.state]);

  const openFilterModal = () => {
    setLocalFilters(appliedFilters);
    setIsFilterModalOpen(true);
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

    if (!questions || !selectedExam || !selectedSubject) {
      return presetCards.map(({ chapter, icon }) => ({ chapter, icon, count: 0 }));
    }

    const questionChapterCounts = questions
      .filter((question) => question.exam === selectedExam && question.subject === selectedSubject)
      .reduce((accumulator, question) => {
        const chapter = question.chapter || 'Unspecified';
        const current = accumulator.get(chapter) || 0;
        accumulator.set(chapter, current + 1);
        return accumulator;
      }, new Map());

    return presetCards.map(({ chapter, icon }) => ({
      chapter,
      icon,
      count: questionChapterCounts.get(chapter) || 0,
    }));
  }, [questions, selectedExam, selectedSubject]);

  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    return questions.filter(q => {
      if (q.exam !== selectedExam) return false;
      if (q.subject !== selectedSubject) return false;
      if (selectedChapter && q.chapter !== selectedChapter) return false;
      
      if (appliedFilters.difficulty.length > 0 && !appliedFilters.difficulty.includes(q.difficulty)) return false;
      
      // Note: Data seed year is a number, checking against string or number
      if (appliedFilters.year.length > 0 && !appliedFilters.year.includes(q.year.toString())) return false;
      
      return true;
    });
  }, [questions, selectedExam, selectedSubject, selectedChapter, appliedFilters]);

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
              <h1 className="text-5xl font-black uppercase tracking-tight mb-2">Practice Questions</h1>
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
                  {availableChapterCards.map(({ chapter, icon, count }) => (
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
                    Showing {filteredQuestions.length} questions
                  </p>
                </div>

                {/* Questions List */}
                {filteredQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {filteredQuestions.map(question => (
                      <QuestionCard
                        key={question.id}
                        question={question}
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
                  </div>
                ) : (
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
                  {YEARS.map(year => (
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