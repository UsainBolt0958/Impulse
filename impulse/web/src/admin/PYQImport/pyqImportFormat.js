const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getSupportedPyqImageExtension(filename) {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? extension : '';
}

export function parsePyqImport(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  if (!isRecord(manifest)) {
    throw new Error('The JSON file must contain a manifest object.');
  }
  return manifest;
}

export function validatePyqImport(manifest, imageFiles, target, existingQuestions = []) {
  const errors = [];
  const warnings = [];
  if (!target.exam) errors.push('Select an exam.');
  if (!target.subject) errors.push('Select a subject.');
  if (!target.chapter) errors.push('Select a chapter.');
  if (!Number.isInteger(target.questionCount) || target.questionCount < 1 || target.questionCount > 200) {
    errors.push('The selected question count must be a whole number from 1 to 200.');
  }
  if (!isRecord(manifest)) {
    return { errors: ['The import file must contain a JSON object.'], warnings: [] };
  }
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!Number.isInteger(manifest.expectedQuestionCount) || manifest.expectedQuestionCount < 1) {
    errors.push('expectedQuestionCount must be a positive whole number.');
  } else if (manifest.expectedQuestionCount !== target.questionCount) {
    errors.push(`expectedQuestionCount (${manifest.expectedQuestionCount}) must match the selected import count (${target.questionCount}).`);
  }
  if (!Array.isArray(manifest.questions)) {
    errors.push('questions must be an array.');
    return { errors, warnings };
  }
  if (manifest.questions.length !== target.questionCount) {
    errors.push(`The JSON contains ${manifest.questions.length} question(s), but ${target.questionCount} were selected.`);
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
      question.exam === target.exam
      && question.subject === target.subject
      && question.chapter === target.chapter
    ))
    .map((question) => String(question.source_id || '').trim().toLocaleLowerCase())
    .filter(Boolean));

  const checkImage = (value, context) => {
    if (value == null || value === '') return;
    if (typeof value !== 'string' || value !== value.trim() || /[\\/]/.test(value)) {
      errors.push(`${context}: image must be a filename in the uploaded images list.`);
      return;
    }
    if (!getSupportedPyqImageExtension(value)) {
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
    if (question.id !== undefined) {
      if (typeof question.id !== 'string' || !question.id.trim() || question.id !== question.id.trim()) {
        errors.push(`${context}.id must be a non-empty string without surrounding whitespace.`);
      } else {
        const sourceId = question.id.toLocaleLowerCase();
        if (sourceIds.has(sourceId)) errors.push(`${context}.id "${question.id}" is duplicated in the JSON.`);
        if (existingSourceIds.has(sourceId)) errors.push(`${context}.id "${question.id}" already exists in the selected exam, subject, and chapter.`);
        sourceIds.add(sourceId);
      }
    }
    if (!Number.isInteger(question.year) || question.year < 1900) {
      errors.push(`${context}.year must be a whole number of 1900 or later.`);
    }
    if (typeof question.shift !== 'string' || !question.shift.trim()) {
      errors.push(`${context}.shift is required.`);
    }
    const normalizedDifficulty = typeof question.difficulty === 'string'
      ? question.difficulty.trim().toLocaleLowerCase().replace(/^./, (letter) => letter.toUpperCase())
      : '';
    if (!DIFFICULTIES.has(normalizedDifficulty)) {
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
      const answerIsNumeric = (
        (typeof question.answer === 'number' && Number.isFinite(question.answer))
        || (typeof question.answer === 'string' && question.answer.trim() !== '' && Number.isFinite(Number(question.answer)))
      );
      if (!answerIsNumeric) errors.push(`${context}.answer must be a finite number.`);
    }

    if (question.solution !== undefined && typeof question.solution !== 'string') {
      errors.push(`${context}.solution must be a string.`);
    }
    if (typeof question.solution !== 'string' || !question.solution.trim()) {
      warnings.push(`${context}${question.id ? ` (${question.id})` : ''} has no solution text.`);
    }
  });

  for (const [normalizedName, file] of imageFilesByName) {
    if (!referencedImages.has(normalizedName)) {
      warnings.push(`Uploaded image "${file.name}" is not referenced by the JSON.`);
    }
  }
  return { errors, warnings };
}

export function buildImportedPyqQuestion(question, target, imageUrls, contributedBy) {
  const resolveImage = (name) => (name ? imageUrls[name.toLocaleLowerCase()] || '' : '');
  const type = question.type.trim().toUpperCase() === 'NUMERIC' ? 'NUM' : question.type.trim().toUpperCase();
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
  const answer = type === 'MCQ'
    ? question.answer.trim().toUpperCase()
    : String(question.answer).trim();
  const solution = typeof question.solution === 'string' ? question.solution.trim() : '';

  return {
    ...(question.id ? { source_id: question.id.trim() } : {}),
    exam: target.exam,
    exam_slug: target.exam.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    year: question.year,
    shift: question.shift.trim(),
    subject: target.subject,
    chapter: target.chapter,
    difficulty: question.difficulty.trim().toLocaleLowerCase().replace(/^./, (letter) => letter.toUpperCase()),
    type,
    question_text: question.text?.trim() || '',
    image: resolveImage(question.image),
    question_image: resolveImage(question.image),
    options,
    option_images: optionImages,
    correct_answer: answer,
    explanation: solution,
    solution,
    contributed_by: contributedBy,
  };
}
