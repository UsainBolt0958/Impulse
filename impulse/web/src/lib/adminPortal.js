import { seedQuestionsToLocalStorage } from '@/data/seedQuestions';
import { loadAdminSessionFromServer, loadPortalStateFromServer, loginToAdminServer, logoutFromAdminServer, savePortalStateToServer } from './portalServer';

export const ADMIN_STORAGE_KEYS = {
  questions: 'impulse_questions',
  exams: 'impulse_admin_exams',
  profile: 'impulse_admin_profile',
  activity: 'impulse_admin_activity',
};

export const ADMIN_PROFILE_DEFAULT = {
  name: 'Impulse Admin',
  role: 'Content Curator',
  email: 'admin@impulse.local',
  bio: 'Managing PYQ content, exam catalogs, and the question pipeline.',
  focus: 'Previous papers, shift tagging, and answer quality control.',
  weeklyGoal: 25,
  avatarSeed: 'Impulse Admin',
};

export const QUESTION_DRAFT_TEMPLATE = {
  exam: '',
  year: new Date().getFullYear(),
  shift: 'Shift 1',
  subject: '',
  chapter: '',
  difficulty: 'Medium',
  type: 'MCQ',
  question_text: '',
  image: '',
  optionA: '',
  optionAImage: '',
  optionB: '',
  optionBImage: '',
  optionC: '',
  optionCImage: '',
  optionD: '',
  optionDImage: '',
  correct_answer: 'A',
  explanation: '',
};

export const EXAM_DRAFT_TEMPLATE = {
  label: '',
  description: '',
  status: 'Active',
  notes: '',
};

function readJSON(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function hashString(value = '') {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function slugify(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleCase(value = '') {
  return value
    .toString()
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function generateId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTimestamp(seed, offset = 0) {
  const hash = hashString(`${seed}-${offset}`);
  const date = new Date();
  const dayOffset = hash % 220;
  const hour = 7 + (hash % 11);
  const minute = hash % 60;

  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizeOptions(question = {}) {
  const rawOptions = question.options || {};

  return {
    A: rawOptions.A ?? question.optionA ?? '',
    B: rawOptions.B ?? question.optionB ?? '',
    C: rawOptions.C ?? question.optionC ?? '',
    D: rawOptions.D ?? question.optionD ?? '',
  };
}

function normalizeOptionImages(question = {}) {
  const rawImages = question.option_images || {};

  return {
    A: rawImages.A ?? question.optionAImage ?? question.optionA_image ?? '',
    B: rawImages.B ?? question.optionBImage ?? question.optionB_image ?? '',
    C: rawImages.C ?? question.optionCImage ?? question.optionC_image ?? '',
    D: rawImages.D ?? question.optionDImage ?? question.optionD_image ?? '',
  };
}

export function normalizeQuestion(question, index = 0) {
  const exam = question.exam || question.exam_label || question.examName || '';
  const questionText = question.question_text || question.question || '';
  const explanation = question.explanation || question.solution || '';
  const solution = question.solution || question.explanation || '';
  const image = question.image || question.question_image || question.imageUrl || '';
  const createdAt = question.created_at || question.createdAt || deriveTimestamp(question.id || questionText || exam, index);
  const updatedAt = question.updated_at || question.updatedAt || createdAt;

  return {
    ...question,
    id: question.id || generateId('question'),
    exam,
    exam_slug: question.exam_slug || slugify(exam),
    year: Number(question.year) || new Date().getFullYear(),
    shift: question.shift || question.shift_name || 'Shift 1',
    subject: question.subject || '',
    chapter: question.chapter || '',
    difficulty: question.difficulty || 'Medium',
    type: question.type || question.question_type || 'MCQ',
    question_text: questionText,
    image,
    question_image: image,
    options: normalizeOptions(question),
    option_images: normalizeOptionImages(question),
    correct_answer: question.correct_answer || question.correctAnswer || 'A',
    explanation,
    solution,
    created_at: createdAt,
    updated_at: updatedAt,
    contributed_by: question.contributed_by || 'Impulse Admin',
  };
}

export function normalizeExam(exam, index = 0) {
  const label = exam.label || exam.name || exam.exam || '';
  const createdAt = exam.created_at || exam.createdAt || deriveTimestamp(label || 'exam', index);
  const updatedAt = exam.updated_at || exam.updatedAt || createdAt;

  return {
    ...exam,
    id: exam.id || generateId('exam'),
    label,
    slug: exam.slug || slugify(label),
    description: exam.description || '',
    status: exam.status || 'Active',
    notes: exam.notes || '',
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function buildSeededActivity(questions) {
  return questions.map((question, index) => ({
    id: generateId('activity'),
    type: 'question.created',
    title: `Imported ${question.exam} ${question.year}`,
    description: question.subject ? `${question.subject} / ${question.chapter}` : question.chapter,
    exam: question.exam,
    questionId: question.id,
    timestamp: question.created_at || deriveTimestamp(question.id, index),
    source: 'seed',
  }));
}

export function readAdminPortalState() {
  if (typeof window === 'undefined') {
    return {
      questions: [],
      exams: [],
      profile: { ...ADMIN_PROFILE_DEFAULT },
      activity: [],
    };
  }

  seedQuestionsToLocalStorage();

  const storedQuestions = readJSON(ADMIN_STORAGE_KEYS.questions, []);
  const normalizedQuestions = storedQuestions.map((question, index) => normalizeQuestion(question, index));
  writeJSON(ADMIN_STORAGE_KEYS.questions, normalizedQuestions);

  const storedExams = readJSON(ADMIN_STORAGE_KEYS.exams, []).map((exam, index) => normalizeExam(exam, index));
  writeJSON(ADMIN_STORAGE_KEYS.exams, storedExams);

  const storedProfile = readJSON(ADMIN_STORAGE_KEYS.profile, null);
  const profile = { ...ADMIN_PROFILE_DEFAULT, ...(storedProfile || {}) };
  writeJSON(ADMIN_STORAGE_KEYS.profile, profile);

  const storedActivity = readJSON(ADMIN_STORAGE_KEYS.activity, []);
  const activity = storedActivity.length > 0 ? storedActivity : buildSeededActivity(normalizedQuestions);
  if (storedActivity.length === 0 && activity.length > 0) {
    writeJSON(ADMIN_STORAGE_KEYS.activity, activity);
  }

  return {
    questions: normalizedQuestions,
    exams: storedExams,
    profile,
    activity,
  };
}

export async function loadAdminPortalState() {
  const remote = await loadPortalStateFromServer();

  if (remote && (
    (Array.isArray(remote.questions) && remote.questions.length > 0)
    || (Array.isArray(remote.exams) && remote.exams.length > 0)
    || (remote.profile && Object.keys(remote.profile).length > 0)
    || (Array.isArray(remote.activity) && remote.activity.length > 0)
  )) {
    const questions = Array.isArray(remote.questions) ? remote.questions.map((question, index) => normalizeQuestion(question, index)) : [];
    const exams = Array.isArray(remote.exams) ? remote.exams.map((exam, index) => normalizeExam(exam, index)) : [];
    const profile = { ...ADMIN_PROFILE_DEFAULT, ...(remote.profile || {}) };
    const activity = Array.isArray(remote.activity) ? remote.activity : [];

    return { questions, exams, profile, activity };
  }

  const local = readAdminPortalState();
  await savePortalState(local);
  return local;
}

export async function loadAdminSession() {
  return loadAdminSessionFromServer();
}

export async function loginAdmin(password) {
  return loginToAdminServer(password);
}

export async function logoutAdmin() {
  return logoutFromAdminServer();
}

export async function savePortalState(state) {
  const normalizedState = {
    questions: (state.questions || []).map((question, index) => normalizeQuestion(question, index)),
    exams: (state.exams || []).map((exam, index) => normalizeExam(exam, index)),
    profile: { ...ADMIN_PROFILE_DEFAULT, ...(state.profile || {}) },
    activity: state.activity || [],
  };

  writeJSON(ADMIN_STORAGE_KEYS.questions, normalizedState.questions);
  writeJSON(ADMIN_STORAGE_KEYS.exams, normalizedState.exams);
  writeJSON(ADMIN_STORAGE_KEYS.profile, normalizedState.profile);
  writeJSON(ADMIN_STORAGE_KEYS.activity, normalizedState.activity);

  await savePortalStateToServer(normalizedState);
  return normalizedState;
}

export function saveQuestions(questions) {
  writeJSON(ADMIN_STORAGE_KEYS.questions, questions.map((question, index) => normalizeQuestion(question, index)));
}

export function saveExams(exams) {
  writeJSON(ADMIN_STORAGE_KEYS.exams, exams.map((exam, index) => normalizeExam(exam, index)));
}

export function saveProfile(profile) {
  writeJSON(ADMIN_STORAGE_KEYS.profile, { ...ADMIN_PROFILE_DEFAULT, ...profile });
}

export function saveActivity(activity) {
  writeJSON(ADMIN_STORAGE_KEYS.activity, activity);
}

export function createQuestionDraft(base = {}) {
  return {
    ...QUESTION_DRAFT_TEMPLATE,
    ...base,
  };
}

export function createExamDraft(base = {}) {
  return {
    ...EXAM_DRAFT_TEMPLATE,
    ...base,
  };
}

export function buildExamCards(questions, exams) {
  const derived = new Map();

  questions.forEach((question, index) => {
    const normalized = normalizeQuestion(question, index);
    const slug = normalized.exam_slug || slugify(normalized.exam);
    const current = derived.get(slug) || {
      slug,
      label: normalized.exam,
      description: '',
      status: 'Derived',
      questionCount: 0,
      subjects: new Set(),
      years: new Set(),
      shifts: new Set(),
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
    };

    current.label = normalized.exam || current.label;
    current.questionCount += 1;
    if (normalized.subject) current.subjects.add(normalized.subject);
    if (normalized.year) current.years.add(normalized.year);
    if (normalized.shift) current.shifts.add(normalized.shift);
    if (normalized.created_at < current.created_at) current.created_at = normalized.created_at;
    if (normalized.updated_at > current.updated_at) current.updated_at = normalized.updated_at;

    derived.set(slug, current);
  });

  const manual = new Map();
  exams.forEach((exam, index) => {
    const normalized = normalizeExam(exam, index);
    manual.set(normalized.slug, normalized);
  });

  const allSlugs = new Set([...derived.keys(), ...manual.keys()]);

  return [...allSlugs]
    .map((slug) => {
      const derivedExam = derived.get(slug);
      const manualExam = manual.get(slug);
      const label = manualExam?.label || derivedExam?.label || titleCase(slug);

      return {
        id: manualExam?.id || derivedExam?.slug || slug,
        slug,
        label,
        description: manualExam?.description || derivedExam?.description || `${derivedExam?.questionCount || 0} questions tracked`,
        notes: manualExam?.notes || '',
        status: manualExam?.status || derivedExam?.status || 'Active',
        questionCount: derivedExam?.questionCount || 0,
        subjects: [...(derivedExam?.subjects || [])].sort(),
        years: [...(derivedExam?.years || [])].sort((left, right) => Number(right) - Number(left)),
        shifts: [...(derivedExam?.shifts || [])].sort(),
        created_at: manualExam?.created_at || derivedExam?.created_at || null,
        updated_at: manualExam?.updated_at || derivedExam?.updated_at || null,
        manual: Boolean(manualExam),
      };
    })
    .sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
}

export function createActivityEntry({ type, title, description = '', exam = '', questionId = '', source = 'manual' }) {
  return {
    id: generateId('activity'),
    type,
    title,
    description,
    exam,
    questionId,
    timestamp: new Date().toISOString(),
    source,
  };
}
