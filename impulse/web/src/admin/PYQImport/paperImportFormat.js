const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const EXAMS = new Map([
  ['jee mains', { label: 'JEE MAINS', subjects: ['Physics', 'Chemistry', 'Mathematics'] }],
  ['neet', { label: 'NEET', subjects: ['Physics', 'Chemistry', 'Biology'] }],
  ['mhtcet', { label: 'MHTCET', subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'] }],
  ['mht cet', { label: 'MHTCET', subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'] }],
]);
const SUBJECTS = new Map([
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['mathematics', 'Mathematics'],
  ['biology', 'Biology'],
  ['botany', 'Biology'],
  ['zoology', 'Biology'],
]);
const DIFFICULTIES = new Map([
  ['easy', 'Easy'],
  ['medium', 'Medium'],
  ['hard', 'Hard'],
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parsePaperImport(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  if (!isRecord(manifest)) {
    throw new Error('The JSON file must contain a paper manifest object.');
  }
  return manifest;
}

export function getSupportedPaperImageExtension(filename) {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? extension : '';
}

export function validatePaperImport(manifest, imageFiles, existingQuestions = [], expectedExam = null) {
  const errors = [];
  const warnings = [];
  if (!isRecord(manifest)) {
    return { errors: ['The import file must contain a JSON object.'], warnings: [] };
  }
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  const examKey = typeof manifest.exam === 'string' ? manifest.exam.trim().toLocaleLowerCase() : '';
  const exam = EXAMS.get(examKey);
  if (!exam) {
    errors.push('exam must be "JEE MAINS", "NEET", or "MHTCET".');
  } else if (expectedExam && exam.label !== expectedExam) {
    errors.push(`exam must be "${expectedExam}" for this importer.`);
  }
  if (expectedExam && !EXAMS.has(expectedExam.toLocaleLowerCase())) {
    errors.push(`Unsupported importer exam "${expectedExam}".`);
  }
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(manifest.year) || manifest.year < 2002 || manifest.year > currentYear) {
    errors.push(`year must be a whole number from 2002 through ${currentYear}.`);
  }
  if (typeof manifest.shiftName !== 'string' || !manifest.shiftName.trim()) {
    errors.push('shiftName is required and must identify this paper shift.');
  }
  if (!Number.isInteger(manifest.expectedQuestionCount) || manifest.expectedQuestionCount < 1 || manifest.expectedQuestionCount > 300) {
    errors.push('expectedQuestionCount must be a whole number from 1 to 300.');
  }
  if (!Array.isArray(manifest.questions)) {
    errors.push('questions must be an array.');
    return { errors, warnings };
  }
  if (manifest.questions.length !== manifest.expectedQuestionCount) {
    errors.push(`expectedQuestionCount is ${manifest.expectedQuestionCount}, but the JSON contains ${manifest.questions.length} question(s).`);
  }

  const imageFilesByName = new Map();
  for (const file of imageFiles) {
    const normalizedName = file.name.toLocaleLowerCase();
    if (imageFilesByName.has(normalizedName)) {
      errors.push(`More than one uploaded image is named "${file.name}" (filenames are case-insensitive).`);
    } else {
      imageFilesByName.set(normalizedName, file);
    }
  }

  const referencedImages = new Set();
  const sourceIds = new Set();
  const existingSourceIds = new Set(existingQuestions
    .filter((question) => (
      String(question.exam || '').trim().toLocaleUpperCase() === exam?.label
      && Number(question.year) === manifest.year
      && String(question.shift || '').trim().toLocaleLowerCase() === String(manifest.shiftName || '').trim().toLocaleLowerCase()
    ))
    .map((question) => String(question.source_id || '').trim().toLocaleLowerCase())
    .filter(Boolean));

  const checkImage = (value, context) => {
    if (value == null || value === '') return;
    if (typeof value !== 'string' || value !== value.trim() || /[\\/]/.test(value)) {
      errors.push(`${context}: image must be a filename in the uploaded image list.`);
      return;
    }
    const extension = getSupportedPaperImageExtension(value);
    if (!extension) {
      errors.push(`${context}: unsupported image type "${value}". Use SVG, PNG, JPG, or WEBP.`);
      return;
    }
    const normalizedName = value.toLocaleLowerCase();
    referencedImages.add(normalizedName);
    if (!imageFilesByName.has(normalizedName)) {
      errors.push(`${context}: referenced image "${value}" was not uploaded.`);
    }
  };

  manifest.questions.forEach((question, index) => {
    const context = `questions[${index}]`;
    if (!isRecord(question)) {
      errors.push(`${context} must be an object.`);
      return;
    }
    if (typeof question.id !== 'string' || !question.id.trim() || question.id !== question.id.trim()) {
      errors.push(`${context}.id is required and must be a non-empty string without surrounding whitespace.`);
    } else {
      const sourceId = question.id.toLocaleLowerCase();
      if (sourceIds.has(sourceId)) errors.push(`${context}.id "${question.id}" is duplicated in this paper.`);
      if (existingSourceIds.has(sourceId)) errors.push(`${context}.id "${question.id}" already exists for this exam, year, and shift.`);
      sourceIds.add(sourceId);
    }

    if (Object.hasOwn(question, 'year')) {
      errors.push(`${context}.year must not be set; use the paper-level year so the paper has one year.`);
    }
    if (Object.hasOwn(question, 'shift') || Object.hasOwn(question, 'shiftName')) {
      errors.push(`${context} must not set a shift; use the single paper-level shiftName.`);
    }

    const subjectKey = typeof question.subject === 'string' ? question.subject.trim().toLocaleLowerCase() : '';
    if (!SUBJECTS.has(subjectKey) || !exam?.subjects.includes(SUBJECTS.get(subjectKey))) {
      errors.push(`${context}.subject must be ${exam?.subjects.join(', ') || 'a supported subject for the selected exam'}.`);
    }
    if (typeof question.chapter !== 'string' || !question.chapter.trim()) {
      errors.push(`${context}.chapter is required.`);
    }
    const difficultyKey = typeof question.difficulty === 'string'
      ? question.difficulty.trim().toLocaleLowerCase()
      : '';
    if (!DIFFICULTIES.has(difficultyKey)) {
      errors.push(`${context}.difficulty must be Easy, Medium, or Hard.`);
    }

    const type = typeof question.type === 'string' ? question.type.trim().toUpperCase() : '';
    if (!['MCQ', 'NUM', 'NUMERIC'].includes(type)) {
      errors.push(`${context}.type must be MCQ or NUM.`);
    }
    if (question.text !== undefined && typeof question.text !== 'string') {
      errors.push(`${context}.text must be a string.`);
    }
    checkImage(question.image, `${context}.image`);
    if (!(typeof question.text === 'string' && question.text.trim()) && !question.image) {
      errors.push(`${context} must contain question text or an image.`);
    }

    if (type === 'MCQ') {
      if (!isRecord(question.options)) {
        errors.push(`${context}.options must contain A, B, C, and D.`);
      } else {
        const optionKeys = Object.keys(question.options);
        if (optionKeys.length !== OPTION_KEYS.length || OPTION_KEYS.some((key) => !Object.hasOwn(question.options, key))) {
          errors.push(`${context}.options must contain exactly A, B, C, and D.`);
        }
        OPTION_KEYS.forEach((key) => {
          const option = question.options[key];
          const optionContext = `${context}.options.${key}`;
          const optionData = typeof option === 'string' ? { text: option } : option;
          if (!isRecord(optionData)) {
            errors.push(`${optionContext} must be text or an object with text and/or image.`);
            return;
          }
          if (optionData.text !== undefined && typeof optionData.text !== 'string') {
            errors.push(`${optionContext}.text must be a string.`);
          }
          checkImage(optionData.image, `${optionContext}.image`);
          if (!(typeof optionData.text === 'string' && optionData.text.trim()) && !optionData.image) {
            errors.push(`${optionContext} must contain text or an image.`);
          }
        });
      }
      if (typeof question.answer !== 'string' || !OPTION_KEYS.includes(question.answer.trim().toUpperCase())) {
        errors.push(`${context}.answer must be one option key: A, B, C, or D.`);
      }
    } else if (type === 'NUM' || type === 'NUMERIC') {
      const validNumber = (
        (typeof question.answer === 'number' && Number.isFinite(question.answer))
        || (typeof question.answer === 'string' && question.answer.trim() !== '' && Number.isFinite(Number(question.answer)))
      );
      if (!validNumber) errors.push(`${context}.answer must be a finite number.`);
    }

    if (question.solution !== undefined && typeof question.solution !== 'string') {
      errors.push(`${context}.solution must be a string.`);
    }
    if (typeof question.solution !== 'string' || !question.solution.trim()) {
      warnings.push(`${context} (${question.id || 'unnamed question'}) has no solution text.`);
    }
  });

  for (const [normalizedName, file] of imageFilesByName) {
    if (!referencedImages.has(normalizedName)) {
      warnings.push(`Uploaded image "${file.name}" is not referenced by the paper JSON.`);
    }
  }
  return { errors, warnings };
}

export function buildImportedPaperQuestions(manifest, imageUrls, contributedBy) {
  const examKey = typeof manifest.exam === 'string' ? manifest.exam.trim().toLocaleLowerCase() : '';
  const exam = EXAMS.get(examKey);
  const resolveImage = (name) => (name ? imageUrls[name.toLocaleLowerCase()] || '' : '');
  return manifest.questions.map((question) => {
    const type = question.type.trim().toUpperCase() === 'NUMERIC'
      ? 'NUM'
      : question.type.trim().toUpperCase();
    const options = type === 'MCQ' ? Object.fromEntries(OPTION_KEYS.map((key) => {
      const option = typeof question.options[key] === 'string'
        ? { text: question.options[key] }
        : question.options[key];
      return [key, option.text || ''];
    })) : Object.fromEntries(OPTION_KEYS.map((key) => [key, '']));
    const optionImages = type === 'MCQ' ? Object.fromEntries(OPTION_KEYS.map((key) => {
      const option = typeof question.options[key] === 'string'
        ? { image: '' }
        : question.options[key];
      return [key, resolveImage(option.image)];
    })) : Object.fromEntries(OPTION_KEYS.map((key) => [key, '']));
    const solution = typeof question.solution === 'string' ? question.solution.trim() : '';
    const image = resolveImage(question.image);

    return {
      source_id: question.id.trim(),
      exam: exam.label,
      exam_slug: exam.label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      year: manifest.year,
      shift: manifest.shiftName.trim(),
      subject: SUBJECTS.get(question.subject.trim().toLocaleLowerCase()),
      chapter: question.chapter.trim(),
      difficulty: DIFFICULTIES.get(question.difficulty.trim().toLocaleLowerCase()),
      type,
      question_text: question.text?.trim() || '',
      image,
      question_image: image,
      options,
      option_images: optionImages,
      correct_answer: type === 'MCQ'
        ? question.answer.trim().toUpperCase()
        : String(question.answer).trim(),
      explanation: solution,
      solution,
      contributed_by: contributedBy,
    };
  });
}

const PAPER_SUBJECT_ORDER = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export function buildDynamicPaperSections(questions) {
  const subjects = [...new Set(questions.map((question) => question.subject))]
    .sort((left, right) => PAPER_SUBJECT_ORDER.indexOf(left) - PAPER_SUBJECT_ORDER.indexOf(right));
  const sections = [];

  subjects.forEach((subject) => {
    ['MCQ', 'NUM'].forEach((type) => {
      const subjectQuestions = questions.filter((question) => (
        question.subject === subject
        && String(question.type || '').trim().toUpperCase() === type
      ));
      if (!subjectQuestions.length) return;

      const subjectSlug = subject.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const sectionName = `${subjectSlug.toUpperCase()}-${type}`;
      sections.push({
        id: `imported-paper-${subjectSlug}-${type.toLocaleLowerCase()}`,
        subject,
        name: sectionName,
        sectionName,
        type,
        questionCount: subjectQuestions.length,
        questionCountPerSubject: subjectQuestions.length,
        posMarks: 4,
        negMarks: type === 'NUM' ? 0 : 1,
        unansweredMarks: 0,
        markingScheme: {
          correct: 4,
          wrong: type === 'NUM' ? 0 : -1,
          unanswered: 0,
        },
        questions: subjectQuestions.map((question) => ({
          id: question.id,
          sourceId: question.source_id,
          sourceNumber: question.source_id,
          text: question.question_text || '',
          imageUrl: question.image || '',
          type,
          options: type === 'NUM'
            ? []
            : OPTION_KEYS.map((key) => ({
              key,
              text: question.options?.[key] || '',
              imageUrl: question.option_images?.[key] || '',
            })),
          answer: type === 'NUM'
            ? question.correct_answer
            : String(question.correct_answer || '').trim().toUpperCase(),
          solution: question.solution || question.explanation || '',
          explanation: question.explanation || question.solution || '',
          section: sectionName,
          subject,
        })),
      });
    });
  });

  return sections;
}

export const parseJeeMainsPaperImport = parsePaperImport;
export const getSupportedJeeMainsImageExtension = getSupportedPaperImageExtension;
export const validateJeeMainsPaperImport = (manifest, imageFiles, existingQuestions = []) => (
  validatePaperImport(manifest, imageFiles, existingQuestions, 'JEE MAINS')
);
export const buildImportedJeeMainsPaperQuestions = buildImportedPaperQuestions;
