const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function imageName(value, context, errors) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value !== value.trim() || /[\\/]/.test(value)) {
    errors.push(`${context}: image must be a filename in the uploaded images list.`);
    return null;
  }

  const extension = value.slice(value.lastIndexOf('.')).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    errors.push(`${context}: unsupported image type "${value}". Use SVG, PNG, JPG, or WEBP.`);
    return null;
  }
  return value;
}

function validateAnswer(question, type, optionKeys, context, errors) {
  if (type === 'MCQ') {
    if (typeof question.answer !== 'string' || !optionKeys.includes(question.answer)) {
      errors.push(`${context}: MCQ answer must be one option key: ${optionKeys.join(', ')}.`);
    }
    return;
  }

  if (type === 'MULTI') {
    if (
      !Array.isArray(question.answer)
      || question.answer.length === 0
      || question.answer.some((key) => typeof key !== 'string' || !optionKeys.includes(key))
      || new Set(question.answer).size !== question.answer.length
    ) {
      errors.push(`${context}: MULTI answer must be a non-empty array of distinct option keys.`);
    }
    return;
  }

  if (typeof question.answer === 'string') {
    if (!question.answer.trim() || !Number.isFinite(Number(question.answer))) {
      errors.push(`${context}: NUM answer must be a finite number or a { min, max } range.`);
    }
    return;
  }
  if (isFiniteNumber(question.answer)) return;
  if (
    isRecord(question.answer)
    && isFiniteNumber(question.answer.min)
    && isFiniteNumber(question.answer.max)
    && question.answer.min <= question.answer.max
    && (question.answer.allowSign === undefined || typeof question.answer.allowSign === 'boolean')
  ) {
    return;
  }
  errors.push(`${context}: NUM answer must be a finite number or a { min, max } range.`);
}

export function parseTestImport(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  return manifest;
}

export function validateTestImport(manifest, imageFiles = []) {
  const errors = [];
  const warnings = [];

  if (!isRecord(manifest)) {
    return { errors: ['The import file must contain a JSON object.'], warnings: [] };
  }
  if (manifest.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }
  if (!isRecord(manifest.test)) {
    errors.push('test must contain title, durationMinutes, and expectedQuestionCount.');
  } else {
    if (typeof manifest.test.title !== 'string' || !manifest.test.title.trim()) {
      errors.push('test.title is required.');
    }
    if (!Number.isInteger(manifest.test.durationMinutes) || manifest.test.durationMinutes < 1) {
      errors.push('test.durationMinutes must be a positive whole number.');
    }
    if (!Number.isInteger(manifest.test.expectedQuestionCount) || manifest.test.expectedQuestionCount < 1) {
      errors.push('test.expectedQuestionCount must be a positive whole number.');
    }
  }

  if (!Array.isArray(manifest.subjects) || manifest.subjects.length === 0) {
    errors.push('subjects must be a non-empty array.');
    return { errors, warnings };
  }

  const availableImages = new Map();
  for (const file of imageFiles) {
    const normalizedName = file.name.toLowerCase();
    if (availableImages.has(normalizedName)) {
      errors.push(`More than one uploaded image is named "${file.name}" (filenames are case-insensitive).`);
    } else {
      availableImages.set(normalizedName, file);
    }
  }

  const subjectNames = new Set();
  const sectionNames = new Set();
  const questionIds = new Set();
  const referencedImages = new Set();
  let totalQuestions = 0;

  const checkImage = (value, context) => {
    const name = imageName(value, context, errors);
    if (!name) return;
    const normalizedName = name.toLowerCase();
    referencedImages.add(normalizedName);
    if (!availableImages.has(normalizedName)) {
      errors.push(`${context}: referenced image "${name}" was not uploaded.`);
    }
  };

  manifest.subjects.forEach((subject, subjectIndex) => {
    const subjectContext = `subjects[${subjectIndex}]`;
    if (!isRecord(subject) || typeof subject.name !== 'string' || !subject.name.trim()) {
      errors.push(`${subjectContext}.name is required.`);
      return;
    }
    const subjectKey = subject.name.trim().toLocaleLowerCase();
    if (subjectKey !== subject.name.toLocaleLowerCase()) {
      errors.push(`${subjectContext}.name must not have leading or trailing whitespace.`);
    }
    if (subjectNames.has(subjectKey)) {
      errors.push(`Duplicate subject name "${subject.name}" (names are case-insensitive).`);
    }
    subjectNames.add(subjectKey);
    if (!Array.isArray(subject.sections) || subject.sections.length === 0) {
      errors.push(`${subjectContext}.sections must be a non-empty array.`);
      return;
    }

    subject.sections.forEach((section, sectionIndex) => {
      const sectionContext = `${subjectContext}.sections[${sectionIndex}]`;
      if (!isRecord(section) || typeof section.name !== 'string' || !section.name.trim()) {
        errors.push(`${sectionContext}.name is required.`);
        return;
      }
      if (section.name !== section.name.trim()) {
        errors.push(`${sectionContext}.name must not have leading or trailing whitespace.`);
      }
      const sectionKey = section.name.toLocaleLowerCase();
      if (sectionNames.has(sectionKey)) {
        errors.push(`Section name "${section.name}" is repeated; section names must be unique across the whole test.`);
      }
      sectionNames.add(sectionKey);

      if (!['MCQ', 'MULTI', 'NUM'].includes(section.type)) {
        errors.push(`${sectionContext}.type must be MCQ, MULTI, or NUM.`);
      }
      if (!Number.isInteger(section.expectedQuestionCount) || section.expectedQuestionCount < 1) {
        errors.push(`${sectionContext}.expectedQuestionCount must be a positive whole number.`);
      }
      if (
        !isRecord(section.marking)
        || !isFiniteNumber(section.marking.correct)
        || section.marking.correct <= 0
        || !isFiniteNumber(section.marking.wrong)
        || section.marking.wrong > 0
        || section.marking.unanswered !== 0
      ) {
        errors.push(`${sectionContext}.marking must use positive correct marks, non-positive wrong marks, and unanswered: 0.`);
      }
      if (!Array.isArray(section.questions)) {
        errors.push(`${sectionContext}.questions must be an array.`);
        return;
      }

      if (section.expectedQuestionCount !== section.questions.length) {
        errors.push(`${sectionContext} declares ${section.expectedQuestionCount} questions but contains ${section.questions.length}.`);
      }
      totalQuestions += section.questions.length;

      section.questions.forEach((question, questionIndex) => {
        const questionContext = `${sectionContext}.questions[${questionIndex}]`;
        if (!isRecord(question)) {
          errors.push(`${questionContext} must be an object.`);
          return;
        }
        if (
          typeof question.id !== 'string'
          || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(question.id)
        ) {
          errors.push(`${questionContext}.id must be a unique 1-100 character ID using letters, numbers, ".", "_", or "-".`);
        } else if (questionIds.has(question.id.toLocaleLowerCase())) {
          errors.push(`Question ID "${question.id}" is duplicated (IDs are case-insensitive).`);
        } else {
          questionIds.add(question.id.toLocaleLowerCase());
        }

        if (question.number != null && !['string', 'number'].includes(typeof question.number)) {
          errors.push(`${questionContext}.number must be a string or number when provided.`);
        }
        if (typeof question.text !== 'string') {
          errors.push(`${questionContext}.text must be a string.`);
        }
        checkImage(question.image, `${questionContext}.image`);
        if (!question.text?.trim() && !question.image) {
          errors.push(`${questionContext} must contain question text or a question image.`);
        }
        if (question.solution != null && typeof question.solution !== 'string') {
          errors.push(`${questionContext}.solution must be a string when provided.`);
        }
        if (!question.solution?.trim()) {
          warnings.push(`${questionContext} (${question.id || 'no ID'}) has no solution text.`);
        }

        let optionKeys = [];
        if (section.type === 'MCQ' || section.type === 'MULTI') {
          if (!Array.isArray(question.options) || question.options.length !== OPTION_KEYS.length) {
            errors.push(`${questionContext}.options must contain exactly four options: A, B, C, and D.`);
          } else {
            optionKeys = question.options.map((option) => option?.key);
            if (optionKeys.some((key, index) => key !== OPTION_KEYS[index])) {
              errors.push(`${questionContext}.options must be ordered and keyed A, B, C, D.`);
            }
            question.options.forEach((option, optionIndex) => {
              const optionContext = `${questionContext}.options[${optionIndex}]`;
              if (!isRecord(option) || typeof option.text !== 'string') {
                errors.push(`${optionContext}.text must be a string.`);
                return;
              }
              checkImage(option.image, `${optionContext}.image`);
              if (!option.text.trim() && !option.image) {
                errors.push(`${optionContext} must contain option text or an option image.`);
              }
            });
          }
        } else if (question.options != null && (!Array.isArray(question.options) || question.options.length > 0)) {
          errors.push(`${questionContext}.options must be omitted or an empty array for NUM questions.`);
        }
        validateAnswer(question, section.type, optionKeys, questionContext, errors);
      });
    });
  });

  if (
    Number.isInteger(manifest.test?.expectedQuestionCount)
    && manifest.test.expectedQuestionCount !== totalQuestions
  ) {
    errors.push(`test.expectedQuestionCount is ${manifest.test.expectedQuestionCount}, but the sections contain ${totalQuestions} questions.`);
  }

  for (const normalizedName of availableImages.keys()) {
    if (!referencedImages.has(normalizedName)) {
      warnings.push(`Uploaded image "${availableImages.get(normalizedName).name}" is not referenced by the manifest.`);
    }
  }

  return { errors, warnings };
}

export function buildImportedSections(manifest, testId, imageUrls = {}) {
  return manifest.subjects.flatMap((subject) => subject.sections.map((section) => ({
    id: `${testId}-${encodeURIComponent(section.name.trim().toLowerCase())}`,
    subject: subject.name.trim(),
    name: section.name,
    sectionName: section.name,
    type: section.type,
    questionCount: section.expectedQuestionCount,
    questionCountPerSubject: section.expectedQuestionCount,
    posMarks: section.marking.correct,
    negMarks: Math.abs(section.marking.wrong),
    unansweredMarks: 0,
    markingScheme: { ...section.marking },
    questions: section.questions.map((question) => ({
      id: `import-${question.id}`,
      sourceId: question.id,
      sourceNumber: question.number == null ? '' : String(question.number),
      text: question.text || '',
      imageUrl: question.image ? imageUrls[question.image.toLowerCase()] || '' : '',
      type: section.type,
      options: section.type === 'NUM'
        ? []
        : question.options.map((option) => ({
          key: option.key,
          text: option.text || '',
          imageUrl: option.image ? imageUrls[option.image.toLowerCase()] || '' : '',
        })),
      answer: section.type === 'MULTI' ? [...question.answer].sort().join('') : question.answer,
      solution: question.solution || '',
      explanation: question.solution || '',
      section: section.name,
      subject: subject.name.trim(),
    })),
  })));
}

export function getSupportedImageExtension(filename) {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? extension : null;
}
