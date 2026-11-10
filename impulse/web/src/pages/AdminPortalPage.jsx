import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Activity,
  BadgePlus,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Eye,
  Edit3,
  Flame,
  Gauge,
  HardDrive,
  LayoutDashboard,
  PencilLine,
  Plus,
  Moon,
  RefreshCw,
  Radio,
  Server,
  Shield,
  Sparkles,
  Star,
  Sun,
  TriangleAlert,
  Trash2,
  Upload,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ColoredIcon from '@/components/ColoredIcon';
import { useSolvedQuestions } from '@/hooks/useSolvedQuestions';
import {
  loadSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  createTest,
  deleteTest,
  loadTests,
  loadAdminStorageUsage,
  loadAdminAssetMetrics,
  loadAdminOperations,
  loadAdminProjectMetrics,
  startClientSessionHeartbeat,
  uploadImage,
} from '@/lib/portalServer';
import TestSeriesManager from '@/admin/TestSeriesManager';
import BillingAdminPanel from '@/admin/BillingAdminPanel';
import PYQImportDialog from '@/admin/PYQImport/PYQImportDialog';
import PaperImportDialog from '@/admin/PYQImport/PaperImportDialog';
import { buildDynamicPaperSections } from '@/admin/PYQImport/paperImportFormat';
import {
  getPaperImportChaptersRemovedByGroup,
  getPaperImportGroups,
  getPaperImportId,
} from '@/admin/PYQImport/paperImportManagement';
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
const QUESTION_TYPE_OPTIONS = ['MCQ', 'NUM'];
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
    type: question.type || 'MCQ',
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
    correct_answer: question.correct_answer || (question.type === 'NUMERIC' ? '' : 'A'),
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

function formatStorageSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 bytes';
  if (size < 1024) return `${size} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatLatency(value) {
  const latency = Number(value) || 0;
  return latency > 5000 ? '>5,000 ms' : `${formatNumber(latency)} ms`;
}

function formatCappedCount(value, capped) {
  return `${capped ? '≥' : ''}${formatNumber(value)}`;
}

const SUPABASE_PLAN_REFERENCES = {
  free: {
    name: 'Free',
    description: 'For prototypes and early usage',
    databaseGB: 0.5,
    fileStorageGB: 1,
    monthlyEgressGB: 5,
    monthlyActiveUsers: 50_000,
    realtimeConnections: 200,
  },
  pro: {
    name: 'Pro',
    description: 'For production workloads',
    databaseGB: 8,
    fileStorageGB: 100,
    monthlyEgressGB: 250,
    monthlyActiveUsers: 100_000,
    realtimeConnections: 500,
  },
};

const STORAGE_ADDON_GB = 50;
const GIGABYTE_BYTES = 1024 ** 3;
const DEFAULT_ASSET_ALERTS = {
  storagePercent: 80,
  serverErrorPercent: 5,
  p95LatencyMs: 1000,
  concurrentSessions: 100,
};

function readAssetAlertThresholds() {
  try {
    const saved = window.localStorage.getItem('impulse_asset_alert_thresholds');
    return { ...DEFAULT_ASSET_ALERTS, ...(saved ? JSON.parse(saved) : {}) };
  } catch (error) {
    console.error('Could not read saved asset alert thresholds.', error);
    return DEFAULT_ASSET_ALERTS;
  }
}

function readAssetPlanner() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('impulse_asset_planner') || '{}');
    return {
      tier: saved.tier === 'pro' ? 'pro' : 'free',
      storageAddons: Math.max(0, Math.min(999, Number(saved.storageAddons) || 0)),
      costs: {
        freeMonthlyUsd: Math.max(0, Number(saved.costs?.freeMonthlyUsd) || 0),
        proMonthlyUsd: Math.max(0, Number(saved.costs?.proMonthlyUsd) || 0),
        storageAddonUsd: Math.max(0, Number(saved.costs?.storageAddonUsd) || 0),
      },
    };
  } catch (error) {
    console.error('Could not read saved asset planner settings.', error);
    return { tier: 'free', storageAddons: 0, costs: { freeMonthlyUsd: 0, proMonthlyUsd: 0, storageAddonUsd: 0 } };
  }
}

function AssetManagementSection() {
  const [usage, setUsage] = React.useState(null);
  const [assetMetrics, setAssetMetrics] = React.useState(null);
  const [operations, setOperations] = React.useState(null);
  const [projectMetrics, setProjectMetrics] = React.useState(null);
  const [selectedTier, setSelectedTier] = React.useState(() => readAssetPlanner().tier);
  const [storageAddons, setStorageAddons] = React.useState(() => readAssetPlanner().storageAddons);
  const [costInputs, setCostInputs] = React.useState(() => readAssetPlanner().costs);
  const [alertThresholds, setAlertThresholds] = React.useState(readAssetAlertThresholds);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [storageError, setStorageError] = React.useState('');
  const [metricsError, setMetricsError] = React.useState('');
  const [operationsError, setOperationsError] = React.useState('');
  const [projectMetricsError, setProjectMetricsError] = React.useState('');

  const refreshStorage = React.useCallback(async () => {
    setStorageError('');
    try {
      setUsage(await loadAdminStorageUsage());
    } catch (loadError) {
      console.error('Could not load storage usage.', loadError);
      setStorageError(loadError.message || 'Storage usage could not be loaded.');
    }
  }, []);

  const refreshMetrics = React.useCallback(async () => {
    setMetricsError('');
    try {
      setAssetMetrics(await loadAdminAssetMetrics());
    } catch (loadError) {
      console.error('Could not load API traffic metrics.', loadError);
      setMetricsError(loadError.message || 'API traffic metrics could not be loaded.');
    }
  }, []);

  const refreshOperations = React.useCallback(async () => {
    setOperationsError('');
    try {
      setOperations(await loadAdminOperations());
    } catch (loadError) {
      console.error('Could not load operations health.', loadError);
      setOperationsError(loadError.message || 'Operations health could not be loaded.');
    }
  }, []);

  const refreshProjectMetrics = React.useCallback(async () => {
    setProjectMetricsError('');
    try {
      setProjectMetrics(await loadAdminProjectMetrics());
    } catch (loadError) {
      console.error('Could not load Supabase project metrics.', loadError);
      setProjectMetricsError(loadError.message || 'Supabase project metrics could not be loaded.');
    }
  }, []);

  const refreshUsage = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshStorage(), refreshMetrics(), refreshOperations(), refreshProjectMetrics()]);
    setRefreshing(false);
    setLoading(false);
  }, [refreshMetrics, refreshOperations, refreshProjectMetrics, refreshStorage]);

  React.useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshMetrics, 30_000);
    return () => window.clearInterval(intervalId);
  }, [refreshMetrics]);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshOperations, 60_000);
    return () => window.clearInterval(intervalId);
  }, [refreshOperations]);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshProjectMetrics, 5 * 60_000);
    return () => window.clearInterval(intervalId);
  }, [refreshProjectMetrics]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('impulse_asset_alert_thresholds', JSON.stringify(alertThresholds));
    } catch (error) {
      console.error('Could not save asset alert thresholds.', error);
    }
  }, [alertThresholds]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('impulse_asset_planner', JSON.stringify({
        tier: selectedTier,
        storageAddons,
        costs: costInputs,
      }));
    } catch (error) {
      console.error('Could not save asset planner settings.', error);
    }
  }, [costInputs, selectedTier, storageAddons]);

  const plan = SUPABASE_PLAN_REFERENCES[selectedTier];
  const fileStorageLimitBytes = (plan.fileStorageGB + (storageAddons * STORAGE_ADDON_GB)) * GIGABYTE_BYTES;
  const fileStoragePercent = usage
    ? Math.min(100, (usage.uploadBytes / fileStorageLimitBytes) * 100)
    : 0;
  const traffic = assetMetrics?.traffic24h;
  const traffic7d = assetMetrics?.traffic7d;
  const traffic30d = assetMetrics?.traffic30d;
  const trafficSeries = assetMetrics?.series || [];
  const trafficSeries7d = assetMetrics?.series7d || [];
  const routeMetrics = assetMetrics?.routes || [];
  const slowestRoutes = [...routeMetrics]
    .filter((route) => route.requests >= 3)
    .sort((left, right) => right.p95LatencyMs - left.p95LatencyMs)
    .slice(0, 5);
  const maxTrafficRequests = Math.max(1, ...trafficSeries.map((bucket) => bucket.requests));
  const maxTrafficRequests7d = Math.max(1, ...trafficSeries7d.map((bucket) => bucket.requests));
  const selectedMonthlyPrice = selectedTier === 'free' ? costInputs.freeMonthlyUsd : costInputs.proMonthlyUsd;
  const estimatedMonthlyCost = selectedMonthlyPrice + (storageAddons * costInputs.storageAddonUsd);
  const costInputsComplete = selectedTier === 'free'
    ? storageAddons === 0 || costInputs.storageAddonUsd > 0
    : costInputs.proMonthlyUsd > 0 && (storageAddons === 0 || costInputs.storageAddonUsd > 0);
  const currentStorageGb = usage ? usage.uploadBytes / GIGABYTE_BYTES : null;
  const storageGrowth = usage?.storageTrend?.bytesPerDay || 0;
  const storageDaysRemaining = currentStorageGb !== null && storageGrowth > 0
    ? Math.max(0, Math.floor(((fileStorageLimitBytes - usage.uploadBytes) / storageGrowth)))
    : null;
  const errorRate = traffic?.requests
    ? Number(((traffic.serverErrors / traffic.requests) * 100).toFixed(2))
    : 0;
  const projectMetric = (pattern) => projectMetrics?.metrics?.find((metric) => pattern.test(metric.metric));
  const formatProjectMetric = (metric, fallback = projectMetrics?.configured ? 'Not reported by API' : 'Not connected') => {
    if (!metric) return fallback;
    if (typeof metric.value === 'number' && /bytes|size|egress|storage/i.test(metric.metric)) {
      return formatStorageSize(metric.value);
    }
    return String(metric.value);
  };
  const activeAlerts = [
    usage && fileStoragePercent >= Number(alertThresholds.storagePercent) && {
      label: `Tracked file storage is at ${fileStoragePercent.toFixed(1)}% of the selected plan.`,
    },
    traffic?.requests >= 10 && errorRate >= Number(alertThresholds.serverErrorPercent) && {
      label: `API error rate is ${errorRate.toFixed(1)}% over the last 24 hours.`,
    },
    traffic?.requests > 0 && traffic.p95LatencyMs >= Number(alertThresholds.p95LatencyMs) && {
      label: `API p95 latency is at least ${formatNumber(traffic.p95LatencyMs)} ms.`,
    },
    assetMetrics?.activeSessions >= Number(alertThresholds.concurrentSessions) && {
      label: `Active browser sessions reached ${formatNumber(assetMetrics.activeSessions)}.`,
    },
  ].filter(Boolean);
  const resourceRows = [
    {
      label: 'Database',
      current: formatProjectMetric(projectMetric(/database.*size|db.*size/i)),
      limit: formatProjectMetric(projectMetric(/database.*(limit|quota)|db.*(limit|quota)/i), `${plan.databaseGB} GB planning reference`),
      icon: Database,
    },
    {
      label: 'File storage',
      current: usage ? formatStorageSize(usage.uploadBytes) : 'Not measured',
      limit: `${plan.fileStorageGB + (storageAddons * STORAGE_ADDON_GB)} GB`,
      icon: HardDrive,
    },
    {
      label: 'API response traffic · 30d',
      current: traffic30d ? formatStorageSize(traffic30d.responseBytes) : 'Not measured',
      limit: 'App API only',
      icon: Activity,
    },
    {
      label: 'Supabase project egress',
      current: formatProjectMetric(projectMetric(/egress|bandwidth/i)),
      limit: `${plan.monthlyEgressGB} GB planning reference`,
      icon: Activity,
    },
    {
      label: 'Observed browser sessions · 30d',
      current: assetMetrics ? formatCappedCount(assetMetrics.observedMonthlyActiveSessions, assetMetrics.monthlyActiveSessionsCapped) : 'Not measured',
      limit: 'Unique app sessions',
      icon: Users,
    },
    {
      label: 'Supabase monthly active users',
      current: formatProjectMetric(projectMetric(/monthly.*active|active.*users|mau/i)),
      limit: `${formatNumber(plan.monthlyActiveUsers)} planning reference`,
      icon: Users,
    },
    {
      label: 'Supabase Realtime peak connections',
      current: formatProjectMetric(projectMetric(/realtime.*connection/i)),
      limit: `${formatNumber(plan.realtimeConnections)} planning reference`,
      icon: Radio,
    },
    {
      label: 'Peak concurrent app sessions',
      current: assetMetrics ? formatCappedCount(assetMetrics.peakActiveSessions, assetMetrics.peakActiveSessionsCapped) : 'Not measured',
      limit: `${formatNumber(alertThresholds.concurrentSessions)} alert threshold`,
      icon: Users,
    },
  ];

  function setAddonCount(value) {
    const count = Number(value);
    setStorageAddons(Number.isFinite(count) ? Math.max(0, Math.min(999, Math.floor(count))) : 0);
  }

  function updateCostInput(field, value) {
    const amount = Number(value);
    setCostInputs((current) => ({
      ...current,
      [field]: Number.isFinite(amount) ? Math.max(0, amount) : 0,
    }));
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Infrastructure & capacity"
        title="Asset management"
        description="Monitor observed app traffic and storage, then compare tracked assets with a Supabase capacity plan."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {usage?.measuredAt
            ? `Storage last checked ${formatDistanceToNow(new Date(usage.measuredAt), { addSuffix: true })}.`
            : 'Storage usage is checked directly from Supabase.'}
        </p>
        <Button type="button" variant="outline" onClick={refreshUsage} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh metrics'}
        </Button>
      </div>
      {loading && !usage && !assetMetrics ? (
        <Card className="rounded-[1.75rem] border-border/80">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading resource metrics…</CardContent>
        </Card>
      ) : (
        <>
          {storageError && (
            <Card className="rounded-[1.75rem] border-destructive/40">
              <CardContent className="p-5 text-sm text-destructive" role="alert">{storageError}</CardContent>
            </Card>
          )}
          {metricsError && (
            <Card className="rounded-[1.75rem] border-destructive/40">
              <CardContent className="p-5 text-sm text-destructive" role="alert">{metricsError}</CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Active sessions',
                value: assetMetrics ? formatCappedCount(assetMetrics.activeSessions, assetMetrics.activeSessionsCapped) : '—',
                detail: `Seen in the last ${Math.round((assetMetrics?.activeWindowSeconds || 300) / 60)} minutes`,
                icon: Users,
              },
              {
                label: 'API requests · 24h',
                value: traffic ? formatNumber(traffic.requests) : '—',
                detail: `${formatNumber(traffic?.clientErrors || 0)} 4xx · ${formatNumber(traffic?.serverErrors || 0)} 5xx`,
                icon: Activity,
              },
              {
                label: 'API latency · p95',
                value: traffic ? formatLatency(traffic.p95LatencyMs) : '—',
                detail: `p50 ${formatLatency(traffic?.p50LatencyMs || 0)} · avg ${formatLatency(traffic?.averageLatencyMs || 0)}`,
                icon: Gauge,
              },
              {
                label: 'API response traffic · 24h',
                value: traffic ? formatStorageSize(traffic.responseBytes) : '—',
                detail: `${formatStorageSize(traffic?.requestBytes || 0)} received`,
                icon: Gauge,
              },
              {
                label: 'Concurrent sessions · peak',
                value: assetMetrics ? formatCappedCount(assetMetrics.peakActiveSessions, assetMetrics.peakActiveSessionsCapped) : '—',
                detail: `${formatCappedCount(assetMetrics?.activeSessions || 0, assetMetrics?.activeSessionsCapped)} active now · approx. 30-day sessions ${formatCappedCount(assetMetrics?.observedMonthlyActiveSessions || 0, assetMetrics?.monthlyActiveSessionsCapped)}`,
                icon: Users,
              },
              {
                label: 'Tracked file storage',
                value: usage ? formatStorageSize(usage.uploadBytes) : '—',
                detail: `${formatNumber(usage?.uploadCount || 0)} files in admin-uploads`,
                icon: HardDrive,
              },
            ].map((metric) => (
              <Card key={metric.label} className="rounded-[1.75rem] border-border/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                  <metric.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black">{metric.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-[1.75rem] border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Activity className="h-5 w-5 text-primary" />
                API traffic · last 24 hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-1" role="img" aria-label="API requests grouped into 30-minute periods over the last 24 hours">
                {trafficSeries.map((bucket) => (
                  <div
                    key={bucket.timestamp}
                    className="min-w-0 flex-1 rounded-t-sm bg-primary/70 transition-all"
                    title={`${format(new Date(bucket.timestamp), 'MMM d, h:mm a')}: ${formatNumber(bucket.requests)} requests`}
                    style={{ height: `${Math.max(3, (bucket.requests / maxTrafficRequests) * 100)}%` }}
                  />
                ))}
                {!trafficSeries.length && (
                  <p className="self-center text-sm text-muted-foreground">Traffic history will appear as requests are received.</p>
                )}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>24 hours ago</span>
                <span>Now</span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">HTTP status codes · 24h</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(traffic?.statusCodes || {}).sort(([left], [right]) => left.localeCompare(right)).map(([code, count]) => (
                  <Badge key={code} variant="outline" className={`rounded-full ${Number(code) >= 500 ? 'border-destructive/50 text-destructive' : Number(code) >= 400 ? 'border-amber-500/50 text-amber-700' : ''}`}>
                    {code}: {formatNumber(count)}
                  </Badge>
                ))}
                {!Object.keys(traffic?.statusCodes || {}).length && (
                  <span className="text-xs text-muted-foreground">No API requests measured yet.</span>
                )}
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Peak active sessions · 30-minute samples</p>
              <div className="mt-2 flex h-16 items-end gap-1" role="img" aria-label="Peak active browser sessions sampled every thirty minutes over the last twenty-four hours">
                {trafficSeries.map((bucket) => (
                  <div
                    key={`sessions-${bucket.timestamp}`}
                    className="min-w-0 flex-1 rounded-t-sm bg-sky-500/70"
                    title={`${format(new Date(bucket.timestamp), 'MMM d, h:mm a')}: ${formatNumber(bucket.peakActiveSessions)} peak sessions`}
                    style={{ height: `${Math.max(bucket.peakActiveSessions ? 4 : 0, (bucket.peakActiveSessions / Math.max(1, assetMetrics?.peakActiveSessions || 1)) * 100)}%` }}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                API-level response bytes are not Supabase egress. Percentiles use latency histogram buckets. Metrics are in-process and instance-local; history resets when the API restarts and is not shared across multiple API instances.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[1.75rem] border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-black">Requests by endpoint · 24h</CardTitle>
                <p className="text-sm text-muted-foreground">Paths are normalized; query strings and record IDs are not retained.</p>
              </CardHeader>
              <CardContent>
                {routeMetrics.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>API route</TableHead>
                          <TableHead className="text-right">Requests</TableHead>
                          <TableHead className="text-right">4xx / 5xx</TableHead>
                          <TableHead className="text-right">p95</TableHead>
                          <TableHead className="text-right">Response</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routeMetrics.map((route) => (
                          <TableRow key={route.path}>
                            <TableCell className="font-mono text-xs">{route.path}</TableCell>
                            <TableCell className="text-right">{formatNumber(route.requests)}</TableCell>
                            <TableCell className="text-right">{formatNumber(route.clientErrors)} / {formatNumber(route.serverErrors)}</TableCell>
                            <TableCell className="text-right">{formatLatency(route.p95LatencyMs)}</TableCell>
                            <TableCell className="text-right">{formatStorageSize(route.responseBytes)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Endpoint details appear as API requests arrive.</p>}
                {slowestRoutes.length > 0 && (
                  <div className="mt-5 border-t border-border/70 pt-4">
                    <p className="mb-2 text-sm font-bold">Slowest routes by p95</p>
                    <div className="space-y-2">
                      {slowestRoutes.map((route) => (
                        <div key={`slow-${route.path}`} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-mono">{route.path}</span>
                          <span className="shrink-0 font-bold">{formatLatency(route.p95LatencyMs)} · {formatNumber(route.requests)} req</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-black">Traffic &amp; errors · last 7 days</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {traffic7d ? `${formatNumber(traffic7d.requests)} requests · ${formatNumber(traffic7d.clientErrors)} client errors · ${formatNumber(traffic7d.serverErrors)} server errors` : 'Waiting for traffic data'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex h-36 items-end gap-2" role="img" aria-label="Daily API traffic over the last seven days; red indicates server errors">
                  {trafficSeries7d.map((day) => (
                    <div key={day.timestamp} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`${format(new Date(day.timestamp), 'MMM d')}: ${formatNumber(day.requests)} requests, ${formatNumber(day.serverErrors)} server errors`}>
                      <div className="flex-1 rounded-t-sm bg-primary/70" style={{ height: `${Math.max(3, ((day.requests - day.serverErrors) / maxTrafficRequests7d) * 100)}%` }} />
                      <div className="w-1/4 rounded-t-sm bg-destructive/80" style={{ height: `${Math.max(day.serverErrors ? 3 : 0, (day.serverErrors / maxTrafficRequests7d) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>6 days ago</span><span>Today</span></div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Last 30 days: {formatNumber(traffic30d?.requests || 0)} API requests · {formatStorageSize(traffic30d?.responseBytes || 0)} API responses. This is not a Supabase MAU or egress measurement.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[1.75rem] border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Shield className="h-5 w-5 text-primary" />
                Capacity alerts
              </CardTitle>
              <p className="text-sm text-muted-foreground">Thresholds are saved in this browser and evaluated against observed app metrics.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeAlerts.length > 0 ? (
                <div className="space-y-2" role="status">
                  {activeAlerts.map((alert) => (
                    <div key={alert.label} className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>{alert.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleCheck className="h-4 w-4 text-emerald-600" /> No configured thresholds exceeded.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { key: 'storagePercent', label: 'Storage warning (%)', min: 1, max: 100 },
                  { key: 'serverErrorPercent', label: 'API error warning (%)', min: 0, max: 100 },
                  { key: 'p95LatencyMs', label: 'p95 latency warning (ms)', min: 1, max: 120000 },
                  { key: 'concurrentSessions', label: 'Concurrent sessions warning', min: 1, max: 1000000 },
                ].map((threshold) => (
                  <label key={threshold.key} className="space-y-2 text-xs font-bold">
                    <span>{threshold.label}</span>
                    <Input
                      type="number"
                      min={threshold.min}
                      max={threshold.max}
                      value={alertThresholds[threshold.key]}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setAlertThresholds((current) => ({
                          ...current,
                          [threshold.key]: Number.isFinite(value)
                            ? Math.min(threshold.max, Math.max(threshold.min, value))
                            : threshold.min,
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Alerts are shown here only; no email, SMS, or push notification channel is configured.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-[1.75rem] border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-black">Supabase plan comparison</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Planning references only. Verify current quotas and pricing in your Supabase dashboard.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(SUPABASE_PLAN_REFERENCES).map(([key, option]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selectedTier === key}
                      onClick={() => setSelectedTier(key)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${selectedTier === key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-secondary/60'}`}
                    >
                      <span className="block font-black">{option.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-border/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">Extra file storage</p>
                      <p className="text-xs text-muted-foreground">Plan an additional {STORAGE_ADDON_GB} GB per block</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAddonCount(storageAddons - 1)} aria-label="Remove storage block">−</Button>
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        value={storageAddons}
                        onChange={(event) => setAddonCount(event.target.value)}
                        aria-label="Additional storage blocks"
                        className="w-20 text-center"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setAddonCount(storageAddons + 1)} aria-label="Add storage block">+</Button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Planned file capacity: <strong className="text-foreground">{plan.fileStorageGB + (storageAddons * STORAGE_ADDON_GB)} GB</strong>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is a comparison planner only; it does not change your Supabase subscription or provision storage.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { field: 'freeMonthlyUsd', label: 'Free plan price (USD/mo)' },
                    { field: 'proMonthlyUsd', label: 'Pro plan price (USD/mo)' },
                    { field: 'storageAddonUsd', label: 'Per extra block (USD/mo)' },
                  ].map(({ field, label }) => (
                    <label key={field} className="space-y-2 text-xs font-bold">
                      <span>{label}</span>
                      <Input type="number" min="0" step="0.01" value={costInputs[field]} onChange={(event) => updateCostInput(field, event.target.value)} />
                    </label>
                  ))}
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-sm font-bold">
                    {costInputsComplete
                      ? `Estimated monthly total: $${estimatedMonthlyCost.toFixed(2)} USD`
                      : 'Enter a Pro rate and any add-on rate to estimate monthly cost.'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Enter prices from your actual quote; tax, overages, compute add-ons, and usage-based charges are not included.</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold">Tracked admin-uploads bucket</span>
                    <span className="text-muted-foreground">
                      {usage ? `${formatStorageSize(usage.uploadBytes)} / ${plan.fileStorageGB + (storageAddons * STORAGE_ADDON_GB)} GB` : 'Not measured'}
                    </span>
                  </div>
                  <Progress value={fileStoragePercent} aria-label="Tracked file storage against selected plan" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {usage?.storageTrend?.samples >= 2
                      ? storageGrowth > 0
                        ? `Recent observed growth: ${formatStorageSize(storageGrowth)} per day · at this rate, approximately ${storageDaysRemaining} day(s) to the selected limit.`
                        : 'No storage growth was measured between the latest samples.'
                      : 'Storage growth projection appears after at least two measurements spaced 6+ hours apart.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80">
              <CardHeader>
                <CardTitle className="text-lg font-black">{plan.name} resource limits</CardTitle>
                <p className="text-sm text-muted-foreground">Observed usage is shown only where this app can measure it.</p>
              </CardHeader>
              <CardContent className="space-y-1">
                {resourceRows.map((resource) => (
                  <div key={resource.label} className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <resource.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-semibold">{resource.label}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">{resource.current}</p>
                      <p className="text-xs text-muted-foreground">limit {resource.limit}</p>
                    </div>
                  </div>
                ))}
                <p className="pt-3 text-xs leading-relaxed text-muted-foreground">
                  Storage usage covers only the <code>admin-uploads</code> bucket. Database size, Supabase egress, monthly active users, and Realtime connections require Supabase project-level metrics and are not available to this app yet.
                </p>
                {usage && (
                  <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                    Admin content JSON is separately estimated at {formatStorageSize(usage.adminContentBytes)} across {formatNumber(usage.adminDocumentCount)} document(s); it is database content, not file-bucket storage.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[1.75rem] border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Server className="h-5 w-5 text-primary" />
                Operations &amp; project health
              </CardTitle>
              <p className="text-sm text-muted-foreground">API process health and live checks of the Supabase database and storage APIs.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {operationsError && <p className="text-sm text-destructive" role="alert">{operationsError}</p>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Application API',
                    status: operations?.api?.status,
                    detail: operations?.api
                      ? `${formatNumber(operations.api.uptimeSeconds)} sec uptime · ${operations.api.nodeVersion} · ${formatStorageSize(operations.api.memoryBytes)} memory`
                      : 'Not checked',
                  },
                  {
                    label: 'Supabase database API',
                    status: operations?.supabase?.database?.status,
                    detail: operations?.supabase?.database?.latencyMs !== undefined
                      ? `${operations.supabase.database.latencyMs} ms`
                      : operations?.supabase?.configured === false ? 'Not configured' : 'Not connected',
                  },
                  {
                    label: 'Supabase storage API',
                    status: operations?.supabase?.storage?.status,
                    detail: operations?.supabase?.storage?.latencyMs !== undefined
                      ? `${operations.supabase.storage.latencyMs} ms`
                      : operations?.supabase?.configured === false ? 'Not configured' : 'Not connected',
                  },
                  {
                    label: 'Supabase backups',
                    status: operations?.backups?.status,
                    detail: operations?.backups?.message || 'Not checked',
                  },
                ].map((service) => {
                  const healthy = service.status === 'healthy';
                  const unavailable = service.status === 'not_available' || service.status === 'not_configured';
                  return (
                    <div key={service.label} className="rounded-xl border border-border/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        {healthy
                          ? <CircleCheck className="h-4 w-4 text-emerald-600" />
                          : unavailable
                            ? <Clock3 className="h-4 w-4 text-muted-foreground" />
                            : <CircleX className="h-4 w-4 text-destructive" />}
                        {service.label}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{service.detail}</p>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border border-border/80 p-4">
                <p className="text-sm font-bold">Project-level billing &amp; resource metrics</p>
                {projectMetricsError && <p className="mt-2 text-sm text-destructive" role="alert">{projectMetricsError}</p>}
                {projectMetrics?.status === 'error' ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">{projectMetrics.message}</p>
                ) : projectMetrics?.configured && projectMetrics.status === 'healthy' ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Live numeric usage values returned by the Supabase Management API, measured {projectMetrics.measuredAt ? formatDistanceToNow(new Date(projectMetrics.measuredAt), { addSuffix: true }) : 'recently'}. Metric names and units come from Supabase.
                    </p>
                    {projectMetrics.metrics?.length ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {projectMetrics.metrics.map((metric, index) => {
                          const label = metric.metric.replace(/\[\d+\]/g, '').replace(/[._-]+/g, ' ');
                          const value = typeof metric.value === 'number' && /bytes|size|egress|storage/i.test(metric.metric)
                            ? formatStorageSize(metric.value)
                            : String(metric.value);
                          return (
                            <div key={`${metric.metric}-${index}`} className="rounded-lg bg-secondary/60 px-3 py-2">
                              <p className="text-xs capitalize text-muted-foreground">{label}</p>
                              <p className="text-sm font-bold">{value}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="mt-2 text-xs text-muted-foreground">The Management API returned no numeric usage metrics.</p>}
                  </>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Database size, Supabase egress, billable MAUs, actual Realtime connections, current invoice, and backup history require project-level access. Configure <code>SUPABASE_PROJECT_REF</code> and a private <code>SUPABASE_MANAGEMENT_ACCESS_TOKEN</code> on the API host as described in <code>supabase/SETUP.md</code>. These values are deliberately not inferred from app traffic.
                    {projectMetrics?.message ? ` ${projectMetrics.message}` : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
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
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState(() => new Set());
  const [questionDeleteOpen, setQuestionDeleteOpen] = React.useState(false);
  const [pendingQuestionDeleteIds, setPendingQuestionDeleteIds] = React.useState([]);
  const [questionDeleteConfirmation, setQuestionDeleteConfirmation] = React.useState('');
  const [isDeletingQuestions, setIsDeletingQuestions] = React.useState(false);
  const [isPyqImportOpen, setIsPyqImportOpen] = React.useState(false);
  const [paperImportExam, setPaperImportExam] = React.useState(null);
  const [removingPaperId, setRemovingPaperId] = React.useState('');
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

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    return startClientSessionHeartbeat();
  }, [isAuthenticated]);

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
      try {
        const remote = await loadAdminPortalState();
        if (active) setPortal(remote);
      } catch (error) {
        if (active) {
          toast.error(error.message || 'Could not load the saved admin library.');
          setAuthReady(true);
        }
        return;
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
  const pyqExamOptions = React.useMemo(() => {
    const knownExams = Object.keys(EXAM_SUBJECT_OPTIONS).flatMap((exam) => (
      exam === 'JEE' ? ['JEE MAINS', 'JEE ADVANCED'] : [exam]
    ));
    return [...new Set([
      ...knownExams,
      ...examOptions,
      ...portal.questions.map((question) => question.exam).filter(Boolean),
    ])].sort((left, right) => left.localeCompare(right));
  }, [examOptions, portal.questions]);

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
  const paperImportGroups = React.useMemo(
    () => getPaperImportGroups(portal.questions, portal.activity),
    [portal.questions, portal.activity]
  );

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

    try {
      const result = await uploadImage(file);
      if (!result?.url) throw new Error('Image upload failed');
      updateQuestionDraft('image', result.url);
    } catch (error) {
      toast.error(error.message || 'Failed to upload question image.');
    }
  };

  const handleOptionImageChange = async (option, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadImage(file);
      if (!result?.url) throw new Error('Image upload failed');
      updateQuestionDraft(`option${option}Image`, result.url);
    } catch (error) {
      toast.error(error.message || 'Failed to upload option image.');
    }
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
      type: questionDraft.type || 'MCQ',
      question_text: questionDraft.question_text.trim(),
      image: questionDraft.image.trim(),
      options: questionDraft.type === 'NUMERIC' ? {
        A: '',
        B: '',
        C: '',
        D: '',
      } : {
        A: questionDraft.optionA.trim(),
        B: questionDraft.optionB.trim(),
        C: questionDraft.optionC.trim(),
        D: questionDraft.optionD.trim(),
      },
      option_images: questionDraft.type === 'NUMERIC' ? {
        A: '',
        B: '',
        C: '',
        D: '',
      } : {
        A: questionDraft.optionAImage.trim(),
        B: questionDraft.optionBImage.trim(),
        C: questionDraft.optionCImage.trim(),
        D: questionDraft.optionDImage.trim(),
      },
      correct_answer: questionDraft.correct_answer.trim(),
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
    try {
      await savePortalState(nextPortal);
    } catch (error) {
      toast.error(error.message || 'Question could not be saved.');
      return;
    }
    toast.success(editingQuestionId ? 'Question updated.' : 'Question added.');
    resetQuestionForm();
  };

  const handlePyqImport = async (questions, target) => {
    const timestamp = new Date().toISOString();
    const importedQuestions = questions.map((question) => normalizeQuestion({
      ...question,
      created_at: timestamp,
      updated_at: timestamp,
      contributed_by: portal.profile.name,
    }));
    const importedActivity = importedQuestions.map((question) => createActivityEntry({
      type: 'question.created',
      title: `Imported ${question.exam} ${question.year}`,
      description: `${target.subject} / ${target.chapter} / ${question.shift}`,
      exam: question.exam,
      questionId: question.id,
      source: 'pyq-json-import',
    }));
    const nextPortal = {
      ...portal,
      questions: [...importedQuestions, ...portal.questions],
      activity: [...importedActivity, ...portal.activity],
    };
    const savedPortal = await savePortalState(nextPortal);
    syncPortal(savedPortal);
    toast.success(`Added ${importedQuestions.length} PYQ question(s) to ${target.exam} / ${target.subject} / ${target.chapter}.`);
  };

  const handlePaperImport = async (questions, paper) => {
    const timestamp = new Date().toISOString();
    const paperImportId = getPaperImportId(paper);
    const importedQuestions = questions.map((question) => normalizeQuestion({
      ...question,
      id: generateId('question'),
      paper_import_id: paperImportId,
      created_at: timestamp,
      updated_at: timestamp,
      contributed_by: portal.profile.name,
    }));
    const examKey = paper.exam === 'MHTCET' ? 'mht-cet' : slugify(paper.exam);
    const durationMinutes = paper.exam === 'NEET' && Number(paper.year) < 2025 ? 200 : 180;
    const addToDynamicPreviousPapers = ['JEE MAINS', 'NEET', 'MHTCET'].includes(paper.exam);
    let series = null;
    let createdSeries = null;
    let importedTest = null;
    let portalSaveAttempted = false;

    try {
      if (addToDynamicPreviousPapers) {
        createdSeries = await createSeries(
          `${paper.exam} ${paper.year} - ${paper.shiftName}`,
          `Imported ${paper.exam} ${paper.year}, ${paper.shiftName}.`
        );
        if (!createdSeries?.id) throw new Error('Could not create the dynamic paper series.');
        series = await updateSeries(createdSeries.id, {
          published: false,
          durationMinutes,
          meta: {
            kind: 'previous-papers',
            examKey,
            exam: paper.exam,
            year: paper.year,
            shiftName: paper.shiftName,
            paperImportId,
          },
        });
        if (!series?.id) throw new Error('Could not prepare the dynamic paper series.');
      }

      const importedActivity = importedQuestions.map((question) => createActivityEntry({
        type: 'question.created',
        title: `Imported ${question.exam} ${question.year}`,
        description: `${question.subject} / ${question.chapter} / ${question.shift}`,
        exam: question.exam,
        questionId: question.id,
        source: `${slugify(paper.exam)}-paper-json-import`,
      }));
      const nextPortal = {
        ...portal,
        questions: [...importedQuestions, ...portal.questions],
        activity: [...importedActivity, ...portal.activity],
      };
      portalSaveAttempted = true;
      const savedPortal = await savePortalState(nextPortal);
      syncPortal(savedPortal);
      if (addToDynamicPreviousPapers) {
        importedTest = await createTest({
          title: `${paper.year} - ${paper.shiftName}`,
          seriesId: series.id,
          durationMinutes,
          sections: buildDynamicPaperSections(importedQuestions),
          published: true,
          publish_at: timestamp,
          meta: {
            kind: 'previous-paper',
            paperImportId,
            exam: paper.exam,
            examKey,
            year: paper.year,
            shiftName: paper.shiftName,
          },
        });
        if (!importedTest?.id) throw new Error('Could not save the imported paper to the dynamic exam engine.');
        series = await updateSeries(series.id, {
          published: true,
          publish_at: timestamp,
        });
        if (!series?.id) throw new Error('Could not publish the imported paper series.');
      }
      toast.success(addToDynamicPreviousPapers
        ? `Imported ${importedQuestions.length} questions and added ${paper.exam} ${paper.year}, ${paper.shiftName} to Previous Papers.`
        : `Imported ${importedQuestions.length} questions from ${paper.exam} ${paper.year}, ${paper.shiftName}.`);
    } catch (error) {
      const cleanupErrors = [];
      let testCleanupFailed = false;
      if (portalSaveAttempted) {
        try {
          syncPortal(await savePortalState(portal));
        } catch (cleanupError) {
          cleanupErrors.push(`Could not restore the original PYQ library state: ${cleanupError.message}`);
        }
      }
      if (importedTest?.id) {
        try {
          await deleteTest(importedTest.id);
        } catch (cleanupError) {
          testCleanupFailed = true;
          cleanupErrors.push(`Could not remove the partially created test: ${cleanupError.message}`);
        }
      }
      if (createdSeries?.id && !testCleanupFailed) {
        try {
          await deleteSeries(createdSeries.id);
        } catch (cleanupError) {
          cleanupErrors.push(`Could not remove the partially created series: ${cleanupError.message}`);
        }
      }
      if (cleanupErrors.length) {
        throw new Error(`${error.message} ${cleanupErrors.join(' ')}`);
      }
      throw error;
    }
  };

  const handlePaperImportDelete = async (group) => {
    if (removingPaperId) return;

    const chaptersRemoved = getPaperImportChaptersRemovedByGroup(group, portal.questions);
    const chapterDetails = chaptersRemoved.length
      ? `\n\nThese chapters will also disappear from PYQ Practice because no other questions use them:\n${chaptersRemoved.join('\n')}`
      : '\n\nChapters still used by other questions will remain available.';
    const confirmed = window.confirm(
      `Permanently remove the entire ${group.exam} ${group.year} paper "${group.shift}", its ${group.questionIds.length} imported questions, and its dynamic exam-engine paper when present?${chapterDetails}`
    );
    if (!confirmed) return;

    setRemovingPaperId(group.id);
    const removedQuestionIds = new Set(group.questionIds);
    const nextPortal = {
      ...portal,
      questions: portal.questions.filter((question) => !removedQuestionIds.has(question.id)),
      activity: [
        createActivityEntry({
          type: 'paper.deleted',
          title: `Removed ${group.exam} ${group.year} paper`,
          description: `${group.shift} / ${group.questionIds.length} question(s)`,
          exam: group.exam,
          source: 'paper-json-import-removal',
        }),
        ...portal.activity.filter((entry) => (
          !removedQuestionIds.has(entry.questionId)
          || !String(entry.source || '').endsWith('-paper-json-import')
        )),
      ],
    };

    let portalSaveAttempted = false;
    try {
      const dynamicTests = (await loadTests()).filter((test) => (
        test.meta?.paperImportId === group.id
      ));
      const dynamicSeries = (await loadSeries()).filter((series) => (
        series.meta?.paperImportId === group.id
      ));
      const removedTests = [];
      const removedSeries = [];
      try {
        for (const test of dynamicTests) {
          await deleteTest(test.id);
          removedTests.push(test);
        }
        for (const series of dynamicSeries) {
          await deleteSeries(series.id);
          removedSeries.push(series);
        }
        portalSaveAttempted = true;
        const savedPortal = await savePortalState(nextPortal);
        syncPortal(savedPortal);
      } catch (error) {
        const restoreErrors = [];
        const restoredSeriesIds = new Map(dynamicSeries.map((series) => [series.id, series.id]));
        for (const series of removedSeries) {
          restoredSeriesIds.delete(series.id);
          let recreatedSeries = null;
          try {
            recreatedSeries = await createSeries(series.title, series.description || '');
            if (!recreatedSeries?.id) throw new Error('Could not recreate the paper series.');
            const restoredSeries = await updateSeries(recreatedSeries.id, {
              published: series.published,
              publish_at: series.publish_at,
              durationMinutes: series.durationMinutes,
              meta: series.meta,
            });
            if (!restoredSeries?.id) throw new Error('Could not republish the paper series.');
            restoredSeriesIds.set(series.id, restoredSeries.id);
          } catch (restoreError) {
            restoreErrors.push(`Could not restore paper series "${series.title}": ${restoreError.message}`);
            if (recreatedSeries?.id) {
              try {
                await deleteSeries(recreatedSeries.id);
              } catch (cleanupError) {
                restoreErrors.push(`Could not remove the incomplete replacement series: ${cleanupError.message}`);
              }
            }
          }
        }
        for (const test of removedTests) {
          const seriesId = restoredSeriesIds.get(test.seriesId);
          if (!seriesId) {
            restoreErrors.push(`Could not restore test "${test.title}" because its paper series is unavailable.`);
            continue;
          }
          try {
            await createTest({
              title: test.title,
              seriesId,
              durationMinutes: test.durationMinutes,
              sections: test.sections,
              published: test.published,
              publish_at: test.publish_at,
              meta: test.meta,
            });
          } catch (restoreError) {
            restoreErrors.push(restoreError.message);
          }
        }
        if (portalSaveAttempted) {
          try {
            syncPortal(await savePortalState(portal));
          } catch (restoreError) {
            restoreErrors.push(`Could not restore the original PYQ library state: ${restoreError.message}`);
          }
        }
        if (restoreErrors.length) {
          throw new Error(`${error.message} Could not restore the dynamic paper: ${restoreErrors.join('; ')}`);
        }
        throw error;
      }
      toast.success(`Removed ${group.exam} ${group.year} paper from PYQ Practice and Previous Papers.`);
    } catch (error) {
      toast.error(error.message || 'Could not remove the imported paper.');
    } finally {
      setRemovingPaperId('');
    }
  };

  const handleQuestionEdit = (question) => {
    setEditingQuestionId(question.id);
    setQuestionDraft(buildQuestionDraftFromQuestion(question));
    setTab('questions');
  };

  const openQuestionDeleteDialog = (questionIds) => {
    const existingIds = new Set(portal.questions.map((question) => question.id));
    const uniqueIds = [...new Set(questionIds)].filter((id) => existingIds.has(id));
    if (!uniqueIds.length) return;
    setPendingQuestionDeleteIds(uniqueIds);
    setQuestionDeleteConfirmation('');
    setQuestionDeleteOpen(true);
  };

  const toggleQuestionSelection = (questionId, checked) => {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (checked) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  };

  const toggleVisibleQuestionSelection = (checked) => {
    const visibleIds = filteredQuestions.map((question) => question.id);
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const confirmQuestionDelete = async () => {
    if (questionDeleteConfirmation !== 'DELETE' || isDeletingQuestions) return;

    const idsToDelete = new Set(pendingQuestionDeleteIds);
    const deletedQuestions = portal.questions.filter((question) => idsToDelete.has(question.id));
    if (!deletedQuestions.length) {
      setQuestionDeleteOpen(false);
      return;
    }

    const nextPortal = {
      ...portal,
      questions: portal.questions.filter((question) => !idsToDelete.has(question.id)),
      activity: portal.activity.filter((entry) => !idsToDelete.has(entry.questionId)),
    };

    setIsDeletingQuestions(true);
    try {
      const savedPortal = await savePortalState(nextPortal);
      syncPortal(savedPortal);
      setSelectedQuestionIds((current) => new Set([...current].filter((id) => !idsToDelete.has(id))));
      if (deletedQuestions.some((question) => question.id === editingQuestionId)) resetQuestionForm();
      setQuestionDeleteOpen(false);
      setPendingQuestionDeleteIds([]);
      toast.success(`${deletedQuestions.length} question${deletedQuestions.length === 1 ? '' : 's'} permanently deleted.`);
    } catch (error) {
      toast.error(error.message || 'The selected questions could not be deleted.');
    } finally {
      setIsDeletingQuestions(false);
    }
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <p role="status" className="text-sm text-muted-foreground">Checking admin session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p role="alert" className="text-sm text-destructive">
          The admin API session could not be established. Sign out and sign in again.
        </p>
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
                        <button type="button" onClick={() => setTab('papers')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'papers' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <ClipboardList className="h-4 w-4" />
                          {!collapsed && 'Imported papers'}
                        </button>
                        <button type="button" onClick={() => setTab('exams')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'exams' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <BadgePlus className="h-4 w-4" />
                          {!collapsed && 'Exams'}
                        </button>
                        <button type="button" onClick={() => setTab('series')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'series' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <BookOpen className="h-4 w-4" />
                          {!collapsed && 'Series'}
                        </button>
                        <button type="button" onClick={() => setTab('profile')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'profile' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <UserCircle2 className="h-4 w-4" />
                          {!collapsed && 'Profile'}
                        </button>
                        <button type="button" onClick={() => setTab('billing')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'billing' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <BadgeDollarSign className="h-4 w-4" />
                          {!collapsed && 'Premium & billing'}
                        </button>
                        <button type="button" onClick={() => setTab('storage')} className={`flex ${collapsed ? 'justify-center' : 'items-center'} w-full gap-3 rounded-xl ${collapsed ? 'px-0 py-2' : 'px-4 py-3'} text-left text-sm font-black uppercase tracking-[0.18em] ${tab === 'storage' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                          <HardDrive className="h-4 w-4" />
                          {!collapsed && 'Assets'}
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

              {tab === 'billing' && <BillingAdminPanel />}
              {tab === 'storage' && <AssetManagementSection />}

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

                        <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Question type</label>
                          <div className="flex flex-wrap gap-2">
                            {QUESTION_TYPE_OPTIONS.map((questionType) => (
                              <PillButton
                                key={questionType}
                                active={questionDraft.type === questionType}
                                onClick={() => updateQuestionDraft('type', questionType)}
                              >
                                {questionType === 'NUM' ? 'Numeric' : questionType}
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

                        {questionDraft.type === 'NUM' ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">Numeric answer</label>
                              <Input
                                value={questionDraft.correct_answer}
                                onChange={(event) => updateQuestionDraft('correct_answer', event.target.value)}
                                placeholder="Enter numeric answer, e.g. 4.5"
                                className="rounded-2xl border-border"
                              />
                              <p className="text-xs text-muted-foreground">The user will enter this answer through the numeric pad while solving.</p>
                            </div>
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}

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
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Badge variant="outline" className="rounded-full border-border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
                            {filteredQuestions.length} shown
                          </Badge>
                          {selectedQuestionIds.size > 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => openQuestionDeleteDialog([...selectedQuestionIds])}
                              className="rounded-full px-4 text-xs font-black uppercase tracking-[0.14em]"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete selected ({selectedQuestionIds.size})
                            </Button>
                          )}
                          <Button type="button" onClick={() => setIsPyqImportOpen(true)} className="rounded-full px-4 text-xs font-black uppercase tracking-[0.14em]">
                            <Upload className="mr-2 h-4 w-4" />
                            Import PYQs
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setPaperImportExam('JEE MAINS')} className="rounded-full px-4 text-xs font-black uppercase tracking-[0.14em]">
                            <Upload className="mr-2 h-4 w-4" />
                            Import JEE Main paper
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setPaperImportExam('NEET')} className="rounded-full px-4 text-xs font-black uppercase tracking-[0.14em]">
                            <Upload className="mr-2 h-4 w-4" />
                            Import NEET paper
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setPaperImportExam('MHTCET')} className="rounded-full px-4 text-xs font-black uppercase tracking-[0.14em]">
                            <Upload className="mr-2 h-4 w-4" />
                            Import MHT CET paper
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Deleted questions are removed from the live library and will not be reseeded from this website.
                      </p>
                    </CardHeader>
                    <CardContent className="overflow-hidden">
                      <div className="overflow-x-auto rounded-[1.25rem] border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={filteredQuestions.length > 0 && filteredQuestions.every((question) => selectedQuestionIds.has(question.id))
                                    ? true
                                    : filteredQuestions.some((question) => selectedQuestionIds.has(question.id)) ? 'indeterminate' : false}
                                  onCheckedChange={(checked) => toggleVisibleQuestionSelection(checked === true)}
                                  aria-label="Select all shown questions"
                                />
                              </TableHead>
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
                                <TableCell className="align-top">
                                  <Checkbox
                                    checked={selectedQuestionIds.has(question.id)}
                                    onCheckedChange={(checked) => toggleQuestionSelection(question.id, checked === true)}
                                    aria-label={`Select ${question.exam} ${question.year} question`}
                                  />
                                </TableCell>
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
                                    <Button size="sm" variant="outline" onClick={() => openQuestionDeleteDialog([question.id])} className="rounded-full border-border px-3 font-black uppercase tracking-[0.16em] text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
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

              {tab === 'papers' && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Whole-paper imports"
                    title="Imported papers"
                    description="Review and remove complete JEE Main, NEET, and MHT CET paper imports. Removing a paper deletes its imported questions and its dynamic exam-engine paper."
                  />
                  {paperImportGroups.length ? (
                    <div className="space-y-4">
                      {paperImportGroups.map((group) => (
                        <Card key={group.id} className="rounded-[1.75rem] border-border/80">
                          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-black uppercase tracking-tight">
                                  {group.exam} {group.year} · {group.shift}
                                </h2>
                                <Badge variant="outline" className="rounded-full">
                                  {group.questionIds.length} questions
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {group.chapters.length
                                  ? `Chapters: ${group.chapters.join(', ')}`
                                  : 'No chapter tags'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Removing this paper also removes chapters no longer used by any remaining questions.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handlePaperImportDelete(group)}
                              disabled={Boolean(removingPaperId)}
                              className="rounded-full border-border px-3 font-black uppercase tracking-[0.12em] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              {removingPaperId === group.id ? 'Removing...' : 'Remove paper'}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="rounded-[1.75rem] border-border/80">
                      <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        No whole-paper JSON imports have been added yet.
                      </CardContent>
                    </Card>
                  )}
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
      <AlertDialog
        open={questionDeleteOpen}
        onOpenChange={(open) => {
          if (isDeletingQuestions) return;
          setQuestionDeleteOpen(open);
          if (!open) {
            setPendingQuestionDeleteIds([]);
            setQuestionDeleteConfirmation('');
          }
        }}
      >
        <AlertDialogContent className="rounded-[1.75rem] border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-destructive">
              Permanently delete {pendingQuestionDeleteIds.length} question{pendingQuestionDeleteIds.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">
                This removes the selected question records from the saved library, public practice list, and related admin activity. The questions will not be restored from a website seed or old browser cache.
              </span>
              <span className="block font-semibold text-foreground">
                This action cannot be undone. Type <code className="rounded bg-secondary px-1.5 py-0.5">DELETE</code> to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={questionDeleteConfirmation}
            onChange={(event) => setQuestionDeleteConfirmation(event.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
            aria-label="Type DELETE to confirm permanent deletion"
            className="rounded-xl border-border bg-background"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingQuestions}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmQuestionDelete}
              disabled={questionDeleteConfirmation !== 'DELETE' || isDeletingQuestions}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeletingQuestions ? 'Deleting…' : `Delete ${pendingQuestionDeleteIds.length} permanently`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isPyqImportOpen ? (
        <PYQImportDialog
          exams={pyqExamOptions}
          getSubjects={(exam) => getSubjectOptionsForExam(exam, portal.questions)}
          getChapters={(subject, exam) => getChapterOptionsForSubject(subject, portal.questions, exam)}
          existingQuestions={portal.questions}
          contributedBy={portal.profile.name}
          onClose={() => setIsPyqImportOpen(false)}
          onImported={handlePyqImport}
        />
      ) : null}
      {paperImportExam ? (
        <PaperImportDialog
          exam={paperImportExam}
          existingQuestions={portal.questions}
          contributedBy={portal.profile.name}
          onClose={() => setPaperImportExam(null)}
          onImported={handlePaperImport}
        />
      ) : null}
    </>
  );
}

export default AdminPortalPage;
