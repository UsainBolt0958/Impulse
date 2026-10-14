/**
 * Dynamic Test Series Engine - Makes exam engine flexible
 * Replaces hardcoded JEE 2025 configuration with configurable series setup
 */

export async function initTestSeriesEngine(testId, seriesId) {
  try {
    // 1. Fetch series configuration
    const seriesResponse = await fetch(`/api/series/${seriesId}`);
    if (!seriesResponse.ok) throw new Error('Series not found');
    const series = await seriesResponse.json();

    // 2. Fetch test details
    const testResponse = await fetch(`/api/tests/${testId}`);
    if (!testResponse.ok) throw new Error('Test not found');
    const test = await testResponse.json();

    // 3. Fetch test template with questions
    const templateResponse = await fetch(`/api/tests/${testId}/template`);
    if (!templateResponse.ok) throw new Error('Test template not found');
    const template = await templateResponse.json();

    return {
      series,
      test,
      template,
      config: buildExamConfig(series, test),
    };
  } catch (error) {
    console.error('Failed to initialize test series:', error);
    throw error;
  }
}

export function buildExamConfig(series, test) {
  /**
   * Build complete exam configuration from series and test
   * This replaces all the hardcoded values in app.js
   */
  return {
    subjects: series.subjects || [],
    sections: buildSectionConfig(series.sections || []),
    marking: buildMarkingScheme(series.sections || []),
    rankMapping: series.rankMapping || getDefaultRankMapping(),
    percentileMarks: test.percentileMarks || null,
    answerKey: null, // Will be built from questions
    storageNamespace: `test_series_${test.id}`,
    duration: (test.durationMinutes || (test.durationSec ? Math.round(test.durationSec / 60) : 0) || series.durationMinutes || 0),
    testId: test.id,
    seriesId: series.id,
    settings: series.settings || {},
  };
}

export function buildSectionConfig(sections) {
  /**
   * Convert series sections to SEC_CFG format
   * Format: { 'A': [count, type, +marks, -marks], ... }
   */
  const config = {};
  sections.forEach((section) => {
    config[section.name] = [
      section.questionCountPerSubject,
      section.type,
      section.posMarks,
      section.negMarks,
    ];
  });
  return config;
}

export function buildMarkingScheme(sections) {
  /**
   * Create marking lookup for all sections
   */
  const scheme = {};
  sections.forEach((section) => {
    scheme[section.name] = {
      type: section.type,
      posMarks: section.posMarks,
      negMarks: section.negMarks,
      questionCount: section.questionCountPerSubject,
    };
  });
  return scheme;
}

export function getDefaultRankMapping() {
  /**
   * JEE Advanced rank mapping (used as default)
   * Format: [[score, rank], ...]
   */
  return [
    [332, 1],
    [278, 100],
    [235, 500],
    [207, 1000],
    [193, 1500],
    [182, 2000],
    [173, 2500],
    [165, 3000],
    [159, 3500],
    [154, 4000],
    [149, 4500],
    [145, 5000],
    [142, 5500],
    [139, 6000],
    [135, 6500],
    [133, 7000],
    [130, 7500],
    [128, 8000],
    [126, 8500],
    [123, 9000],
    [121, 9500],
    [120, 10000],
    [118, 10500],
    [116, 11000],
    [114, 11500],
    [112, 12000],
    [110, 13000],
    [107, 14000],
    [104, 15000],
    [102, 16000],
    [100, 17000],
    [98, 18000],
    [96, 19000],
    [94, 20000],
    [92, 21000],
    [90, 22000],
    [88, 23000],
    [87, 24000],
    [86, 25000],
    [84, 26000],
    [82, 27000],
    [81, 28000],
    [80, 29000],
    [78, 30000],
    [77, 31000],
    [76, 32000],
    [76, 33801],
  ];
}

export function buildAnswerKeyFromQuestions(questions, template) {
  /**
   * Build answer key from questions data instead of hardcoding
   * Structure: { subject: { section: [ answers ] } }
   */
  const answerKey = {};

  if (!questions || !template) return answerKey;

  template.sections?.forEach((section) => {
    const subject = section.subject;
    const sectionName = section.sectionName;

    if (!answerKey[subject]) {
      answerKey[subject] = {};
    }
    if (!answerKey[subject][sectionName]) {
      answerKey[subject][sectionName] = [];
    }

    section.questions?.forEach((questionId) => {
      const question = questions.find((q) => q.id === questionId);
      if (question) {
        answerKey[subject][sectionName].push(question.answer);
      }
    });
  });

  return answerKey;
}

export function getFirstQuestion(config) {
  /**
   * Get the first question reference from series config
   * Instead of hardcoding PHYSICS-A-0
   */
  if (!config.subjects || config.subjects.length === 0) {
    return { s: 'Physics', sec: 'A', i: 0 };
  }

  const firstSubject = config.subjects[0];
  const sections = Object.keys(config.sections);
  const firstSection = sections.length > 0 ? sections[0] : 'A';

  return { s: firstSubject, sec: firstSection, i: 0 };
}

export function getMarking(sectionName, questionType, config) {
  /**
   * Centralized marking lookup
   * Replaces scattered marking logic in scoreAnswer()
   */
  const sectionInfo = config.marking?.[sectionName];
  if (sectionInfo) {
    return {
      plusMarks: sectionInfo.posMarks,
      negMarks: sectionInfo.negMarks,
    };
  }

  // Fallback to old logic if not found
  if (questionType === 'MCQ') {
    return { plusMarks: 3, negMarks: -1 };
  }
  if (questionType === 'MULTI') {
    return { plusMarks: 4, negMarks: -2 };
  }
  if (questionType === 'NUM') {
    return { plusMarks: 4, negMarks: 0 };
  }

  return { plusMarks: 0, negMarks: 0 };
}

export function getStorageKeys(config) {
  /**
   * Generate storage keys based on test ID
   * Instead of hardcoded jee_adv_2025_* keys
   */
  const namespace = config.storageNamespace;
  return {
    DATA: `${namespace}_data_v1`,
    SESS: `${namespace}_sess_v1`,
    SESS_HASH: `${namespace}_sess_v1_hash`,
  };
}

export function initExamDatabase(config, template) {
  /**
   * Initialize exam session database dynamically
   * Based on series configuration, not hardcoded structure
   */
  const db = {
    cur: getFirstQuestion(config),
    data: {},
    meta: {
      testId: config.testId,
      seriesId: config.seriesId,
      duration: config.duration,
      subjects: config.subjects,
      sections: Object.keys(config.sections),
    },
  };

  // Initialize data structure for each subject and section
  config.subjects.forEach((subject) => {
    db.data[subject] = {};

    Object.keys(config.sections).forEach((sectionName) => {
      const [questionCount] = config.sections[sectionName];
      db.data[subject][sectionName] = {};

      for (let i = 0; i < questionCount; i++) {
        db.data[subject][sectionName][i] = {
          sel: null,
          st: 'not-visited',
          mt: false,
          ar: false,
        };
      }
    });
  });

  return db;
}

export function calculateScore(userAnswers, answerKey, config) {
  /**
   * Calculate test score based on series marking scheme
   */
  let totalScore = 0;
  const subjectScores = {};
  const stats = {
    correct: 0,
    wrong: 0,
    skipped: 0,
  };

  config.subjects.forEach((subject) => {
    subjectScores[subject] = 0;

    Object.keys(config.sections).forEach((sectionName) => {
      const [, sectionType, posMarks, negMarks] = config.sections[sectionName];

      const sectionAnswers = userAnswers[subject]?.[sectionName] || {};
      const correctAnswers = answerKey[subject]?.[sectionName] || [];

      Object.entries(sectionAnswers).forEach(([qIndex, userAns]) => {
        const correctAns = correctAnswers[qIndex];

        if (userAns === null || userAns === '') {
          stats.skipped++;
        } else if (userAns === correctAns) {
          const points = posMarks;
          totalScore += points;
          subjectScores[subject] += points;
          stats.correct++;
        } else {
          const points = negMarks;
          totalScore += points;
          subjectScores[subject] += points;
          stats.wrong++;
        }
      });
    });
  });

  return { totalScore, subjectScores, stats };
}

export function calculateRank(score, config) {
  /**
   * Calculate rank based on series rank mapping
   */
  const rankMapping = config.rankMapping || getDefaultRankMapping();

  for (let i = 0; i < rankMapping.length - 1; i++) {
    const [scoreA, rankA] = rankMapping[i];
    const [scoreB, rankB] = rankMapping[i + 1];

    if (score >= scoreB && score <= scoreA) {
      // Linear interpolation
      const scoreDiff = scoreA - scoreB;
      const rankDiff = rankA - rankB;
      const fraction = (score - scoreB) / scoreDiff;
      const estimatedRank = rankB + rankDiff * fraction;
      return Math.round(estimatedRank);
    }
  }

  if (score >= rankMapping[0][0]) return 1;
  return rankMapping[rankMapping.length - 1][1];
}
