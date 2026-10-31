/**
 * JEE 2025 Test Series Adapter
 * 
 * This module adapts the hardcoded JEE 2025 exam engine to work with
 * dynamic test series configuration. It acts as a bridge between the
 * existing app.js code and the new test series system.
 * 
 * Import this at the top of app.js and call initTestSeriesAdapter() early
 */

// Import from testSeriesEngine.js
// See: web/src/lib/testSeriesEngine.js

class TestSeriesAdapter {
  constructor() {
    this.config = null;
    this.series = null;
    this.test = null;
    this.answerKey = null;
    this.storageKeys = {
      DATA: 'jee_adv_2025_data_v1',
      SESS: 'jee_adv_2025_sess_v1',
      SESS_HASH: 'jee_adv_2025_sess_v1_hash'
    };
  }

  /**
   * Initialize adapter with test series data
   * This REPLACES the hardcoded values in app.js
   */
  async initialize(testId, seriesId) {
    console.log('🚀 [TestSeriesAdapter] Initializing:', { testId, seriesId });

    try {
      // Determine backend base URL (allow override via global)
      const _base = (
        window.__EXAM_SERVER_URL__
        || window.SERVER_URL
        || window.sessionStorage.getItem('impulse_api_origin')
        || ''
      ).toString().replace(/\/$/, '');
      const base = _base || '';

      const loadJson = async (path) => {
        const response = await fetch(`${base}/api${path}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`The server denied access to this test (${response.status}).`);
        }
        return response.json();
      };
      const [series, test, template] = await Promise.all([
        loadJson(`/series/${encodeURIComponent(seriesId)}`),
        loadJson(`/tests/${encodeURIComponent(testId)}`),
        loadJson(`/tests/${encodeURIComponent(testId)}/template`),
      ]);

      this.series = series;
      this.test = test;
      this.template = template;

      if (series.backgroundImage) {
        document.documentElement.style.setProperty(
          '--series-background-image',
          `url("${String(series.backgroundImage).replace(/"/g, '\\"')}")`
        );
      } else {
        document.documentElement.style.removeProperty('--series-background-image');
      }

      const sourceSections = (template.sections && template.sections.length)
        ? template.sections
        : (series.sections || []);
      const sourceSubjects = (test.subjects && test.subjects.length)
        ? test.subjects
        : (series.subjects && series.subjects.length)
          ? series.subjects
          : this.inferSubjects(template);

      // Build exam config
      this.config = {
        subjects: sourceSubjects,
        sections: this.buildSectionConfig(sourceSections),
        marking: this.buildMarkingScheme(sourceSections),
        duration: (test.durationMinutes || (test.durationSec ? Math.round(test.durationSec / 60) : 0) || series.durationMinutes || 0),
        rankMapping: series.rankMapping || this.getDefaultRankMapping(),
        percentileMarks: test.percentileMarks || null,
      };

      // Update storage keys
      this.storageKeys.DATA = `test_series_${testId}_data_v1`;
      this.storageKeys.SESS = `test_series_${testId}_sess_v1`;
      this.storageKeys.SESS_HASH = `test_series_${testId}_sess_v1_hash`;

      // Build answer key from questions
      this.answerKey = this.buildAnswerKey(template);

      console.log('✅ [TestSeriesAdapter] Initialized successfully');
      console.log('📋 Subjects:', this.config.subjects);
      console.log('📋 Sections:', Object.keys(this.config.sections));
      console.log('📋 Storage keys:', this.storageKeys);

      return this.config;
    } catch (error) {
      console.error('❌ [TestSeriesAdapter] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Use JEE 2025 as default if test series not found
   */
  getJEE2025Config() {
    this.config = {
      subjects: ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'],
      sections: {
        'A': [4, 'MCQ', 3, 1],
        'B': [3, 'MULTI', 4, 2],
        'C': [6, 'NUM', 4, 0],
        'D': [3, 'MCQ', 4, 1]
      },
      marking: {
        'A': { type: 'MCQ', posMarks: 3, negMarks: 1, questionCount: 4 },
        'B': { type: 'MULTI', posMarks: 4, negMarks: 2, questionCount: 3 },
        'C': { type: 'NUM', posMarks: 4, negMarks: 0, questionCount: 6 },
        'D': { type: 'MCQ', posMarks: 4, negMarks: 1, questionCount: 3 }
      },
      duration: 180,
      rankMapping: this.getDefaultRankMapping()
    };

    return this.config;
  }

  buildSectionConfig(sections) {
    const config = {};
    sections.forEach((section) => {
      const sectionKey = section.sectionName || section.name;
      if (!sectionKey) return;
      config[sectionKey] = [
        section.questionCountPerSubject || section.questionCount || (section.questions ? section.questions.length : 0),
        section.type,
        section.posMarks,
        section.negMarks
      ];
    });
    return config;
  }

  buildMarkingScheme(sections) {
    const scheme = {};
    sections.forEach((section) => {
      const sectionKey = section.sectionName || section.name;
      if (!sectionKey) return;
      scheme[sectionKey] = {
        type: section.type,
        posMarks: section.posMarks,
        negMarks: section.negMarks,
        questionCount: section.questionCountPerSubject || section.questionCount || (section.questions ? section.questions.length : 0)
      };
    });
    return scheme;
  }

  getMaximumScore() {
    if (!this.config) return null;

    const templateSections = this.template?.sections;
    if (Array.isArray(templateSections) && templateSections.length) {
      let total = 0;
      for (const section of templateSections) {
        const sectionKey = section.sectionName || section.name;
        const marking = this.config.marking?.[sectionKey];
        const questionCount = Array.isArray(section.questions)
          ? section.questions.length
          : Number(section.questionCountPerSubject || section.questionCount || marking?.questionCount);
        const marksPerQuestion = Number(marking?.posMarks);

        if (!sectionKey || !Number.isFinite(questionCount) || !Number.isFinite(marksPerQuestion)) {
          return null;
        }

        total += questionCount * marksPerQuestion;
      }
      return total;
    }

    const subjectCount = this.config.subjects?.length || 0;
    if (!subjectCount) return null;

    let total = 0;
    for (const marking of Object.values(this.config.marking || {})) {
      const questionCount = Number(marking.questionCount);
      const marksPerQuestion = Number(marking.posMarks);
      if (!Number.isFinite(questionCount) || !Number.isFinite(marksPerQuestion)) {
        return null;
      }
      total += questionCount * marksPerQuestion * subjectCount;
    }
    return total;
  }

  getPanicWindowSeconds(durationMinutes = this.config?.duration) {
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('A positive exam duration is required for panic mode analysis');
    }
    return Math.min(15, duration) * 60;
  }

  /**
   * Extract answer key from template
   */
  buildAnswerKey(template) {
    const answerKey = {};

    if (!template || !template.sections) {
      return answerKey;
    }

    template.sections.forEach((section) => {
      const subject = section.subject;
      const sectionName = section.sectionName;

      if (!answerKey[subject]) {
        answerKey[subject] = {};
      }
      if (!answerKey[subject][sectionName]) {
        answerKey[subject][sectionName] = [];
      }

      if (section.questions && Array.isArray(section.questions)) {
        section.questions.forEach((questionData) => {
          // questionData can be full object or just ID string
          const answer = typeof questionData === 'object' 
            ? questionData.answer 
            : 'A'; // fallback

          answerKey[subject][sectionName].push(answer);
        });
      }
    });

    return answerKey;
  }

  inferSubjects(template) {
    if (!template || !Array.isArray(template.sections)) {
      return [];
    }

    return Array.from(new Set(template.sections
      .map((section) => section.subject || section.subjectName || section.name)
      .filter(Boolean)
    ));
  }

  getDefaultRankMapping() {
    return [
      [332, 1], [278, 100], [235, 500], [207, 1000], [193, 1500],
      [182, 2000], [173, 2500], [165, 3000], [159, 3500], [154, 4000],
      [149, 4500], [145, 5000], [142, 5500], [139, 6000], [135, 6500],
      [133, 7000], [130, 7500], [128, 8000], [126, 8500], [123, 9000],
      [121, 9500], [120, 10000], [118, 10500], [116, 11000], [114, 11500],
      [112, 12000], [110, 13000], [107, 14000], [104, 15000], [102, 16000],
      [100, 17000], [98, 18000], [96, 19000], [94, 20000], [92, 21000],
      [90, 22000], [88, 23000], [87, 24000], [86, 25000], [84, 26000],
      [82, 27000], [81, 28000], [80, 29000], [78, 30000], [77, 31000],
      [76, 32000], [76, 33801]
    ];
  }

  /**
   * Get marking for a specific section
   */
  getMarking(sectionName) {
    const sectionInfo = this.config.marking?.[sectionName];
    if (sectionInfo) {
      return {
        plusMarks: sectionInfo.posMarks,
        negMarks: sectionInfo.negMarks,
        type: sectionInfo.type
      };
    }

    // Fallback to defaults
    return { plusMarks: 3, negMarks: -1, type: 'MCQ' };
  }

  /**
   * Get answer for a question
   */
  getCorrectAnswer(subject, section, questionIndex) {
    return this.answerKey?.[subject]?.[section]?.[questionIndex] || 'A';
  }

  /**
   * Calculate score with dynamic marking
   */
  scoreAnswer(userAnswer, correctAnswer, type, sectionName) {
    const marking = this.getMarking(sectionName);
    
    if (!userAnswer || userAnswer === null) {
      return 0;
    }

    if (userAnswer === correctAnswer) {
      return marking.plusMarks;
    } else {
      return marking.negMarks;
    }
  }

  /**
   * Calculate rank from score
   */
  calculateRank(score) {
    const rankMapping = this.config.rankMapping || this.getDefaultRankMapping();

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

  predictPercentile(result) {
    const percentileMarks = this.config?.percentileMarks;
    if (!result || !percentileMarks || typeof percentileMarks !== 'object') return null;

    const anchors = Object.entries(percentileMarks)
      .map(([percentile, marks]) => ({
        percentile: Number(percentile),
        marks: Number(marks),
      }))
      .filter((anchor) => (
        Number.isFinite(anchor.percentile)
        && anchor.percentile >= 90
        && anchor.percentile <= 99.9
        && Number.isFinite(anchor.marks)
      ))
      .sort((a, b) => a.percentile - b.percentile);
    const ninetyPercentileAnchor = anchors.find((anchor) => anchor.percentile === 90);

    if (
      anchors.length < 2
      || !ninetyPercentileAnchor
      || new Set(anchors.map((anchor) => anchor.percentile)).size !== anchors.length
      || anchors.some((anchor, index) => (
        index > 0 && anchors[index - 1].marks >= anchor.marks
      ))
    ) {
      return null;
    }

    const score = Number(result.total);
    if (!Number.isFinite(score)) return null;
    if (score < ninetyPercentileAnchor.marks) {
      return { belowThreshold: true };
    }

    let basePercentile = ninetyPercentileAnchor.percentile;
    if (score >= anchors[anchors.length - 1].marks) {
      basePercentile = anchors[anchors.length - 1].percentile;
    } else {
      for (let index = 0; index < anchors.length - 1; index += 1) {
        const lower = anchors[index];
        const upper = anchors[index + 1];
        if (score < lower.marks || score > upper.marks) continue;

        const scoreFraction = (score - lower.marks) / (upper.marks - lower.marks);
        basePercentile = lower.percentile
          + (upper.percentile - lower.percentile) * scoreFraction;
        break;
      }
    }

    const solutions = Array.isArray(result.solutions) ? result.solutions : [];
    const countStatus = (status) => solutions.filter((solution) => (
      String(solution?.status || '').toLowerCase() === status
    )).length;
    const readCount = (value, fallback) => (
      value == null || !Number.isFinite(Number(value)) ? fallback : Number(value)
    );
    const correct = readCount(result.acc?.cor, countStatus('correct'));
    const wrong = readCount(result.acc?.wrg, countStatus('wrong'));
    const partial = readCount(result.acc?.partial, countStatus('partial'));
    const attempted = correct + wrong + partial;
    const unattempted = readCount(result.acc?.un, Math.max(0, solutions.length - attempted));
    const totalQuestions = readCount(
      result.totalQuestions,
      solutions.length || attempted + unattempted
    );
    const accuracy = attempted > 0 ? correct / attempted : 0;
    const coverage = totalQuestions > 0 ? attempted / totalQuestions : 0;
    const accuracyBonus = accuracy >= 0.9
      ? 0.4
      : accuracy >= 0.8
        ? 0.2
        : 0;
    const adjustedPercentile = basePercentile
      + accuracyBonus * Math.min(1, coverage / 0.5);
    const center = Math.max(90, Math.min(99.9, adjustedPercentile));
    const roundToTenth = (value) => Math.round((value + 1e-8) * 10) / 10;
    const min = Math.max(90, Math.min(99.6, roundToTenth(center - 0.2)));

    return {
      estimate: roundToTenth(center),
      min,
      max: Number((min + 0.4).toFixed(1)),
    };
  }

  /**
   * Get first question reference
   */
  getFirstQuestion() {
    if (!this.config.subjects || this.config.subjects.length === 0) {
      return { s: 'PHYSICS', sec: 'A', i: 0 };
    }

    const firstSubject = this.config.subjects[0];
    const sections = Object.keys(this.config.sections);
    const firstSection = sections.length > 0 ? sections[0] : 'A';

    return { s: firstSubject, sec: firstSection, i: 0 };
  }
}

// Export singleton instance
const testSeriesAdapter = new TestSeriesAdapter();

// Also export for global access
if (typeof window !== 'undefined') {
  window.TestSeriesAdapter = TestSeriesAdapter;
  window.testSeriesAdapter = testSeriesAdapter;
}
