/**
 * ==============================================================================
 * TEST SERIES ENGINE INTEGRATION GUIDE - jee2025/assets/js/app.js
 * ==============================================================================
 * 
 * This document shows how to adapt app.js to use dynamic test series config
 * instead of hardcoded JEE 2025 values.
 * 
 * KEY CHANGES:
 * 1. Load series config at startup instead of hardcoding S, SEC, SEC_CFG
 * 2. Use dynamic marking scheme from config
 * 3. Use dynamic storage keys per test
 * 4. Build answer key from questions data
 * 5. Adapt analysis engine for flexible calculation
 * 
 * STEP-BY-STEP IMPLEMENTATION:
 * ==============================================================================
 */

// STEP 1: AT TOP OF FILE - Add import for test series engine
// Import these utility functions:
// - initTestSeriesEngine
// - getMarking
// - getFirstQuestion
// - getStorageKeys
// - buildAnswerKeyFromQuestions
// - calculateRank
// - initExamDatabase

// Current (Line 1-3):
// const KEY_DATA = 'jee_adv_2025_data_v1';
// const KEY_SESS = 'jee_adv_2025_sess_v1';
// const KEY_SESS_HASH = 'jee_adv_2025_sess_v1_hash';

// NEW: Make dynamic
let KEY_DATA = 'test_series_data_v1';
let KEY_SESS = 'test_series_sess_v1';
let KEY_SESS_HASH = 'test_series_sess_v1_hash';
let EXAM_CONFIG = {};
let EXAM_ANSWER_KEY = {};

// STEP 2: REPLACE HARDCODED VALUES (Lines 168-169)
// OLD:
// const S = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'];
// const SEC = ['A', 'B', 'C', 'D'];

// NEW: Make dynamic
let S = [];
let SEC = [];
let SEC_CFG = {};

function updateExamStructure(config) {
  S = config.subjects || [];
  SEC = Object.keys(config.sections || {});
  SEC_CFG = config.sections || {};
  EXAM_CONFIG = config;
}

// STEP 3: REPLACE HARDCODED SECTION CONFIG (Lines 340-346)
// OLD:
// const SEC_CFG = {
//   'A': [4, 'MCQ', 3, 1],
//   'B': [3, 'MULTI', 4, 2],
//   'C': [6, 'NUM', 4, 0],
//   'D': [3, 'MCQ', 4, 1]
// };

// NEW: This is now handled by updateExamStructure()
// SEC_CFG comes from series.sections

// STEP 4: REPLACE scoreAnswer() MARKING LOGIC (Lines 392-410)
// OLD:
// function scoreAnswer(userAns, correctAns, type, sec) {
//   let plusMark = 0, minusMark = 0;
//   if (type === 'MCQ') {
//     if (sec === 'D') {
//       plusMark = 4; minusMark = 1;
//     } else {
//       plusMark = 3; minusMark = 1;
//     }
//   } else if (type === 'MULTI') {
//     plusMark = 4; minusMark = 2;
//   }
//   // ...
// }

// NEW: Use dynamic marking
function scoreAnswer(userAns, correctAns, type, sec) {
  const { plusMarks, negMarks } = getMarking(sec, type, EXAM_CONFIG);
  const plusMark = plusMarks;
  const minusMark = negMarks;
  // Rest of logic stays same, but uses dynamic marking
  // ...
}

// STEP 5: REPLACE HARDCODED ANSWER_KEY (Lines 352-388)
// OLD:
// const ANSWER_KEY = {
//   1: { // Paper 1
//     PHYSICS: {
//       A: ['A', 'D', 'A', 'C'],
//       // ...
//     }
//   }
// };

// NEW: Build from questions
// In initialization:
// EXAM_ANSWER_KEY = buildAnswerKeyFromQuestions(questions, test.template);
// Or fetch from API

// STEP 6: REPLACE initExamDB() (Around line 800)
// OLD:
// function initExamDB(paperNum) {
//   // Creates structure for Paper 1 or Paper 2
//   return { ... };
// }

// NEW: Dynamic based on config
function initExamDB() {
  return initExamDatabase(EXAM_CONFIG, window.examTemplate);
}

// STEP 7: REPLACE FIRST QUESTION HARDCODE
// OLD:
// window.sess.cur = { s: 'PHYSICS', sec: 'A', i: 0 };

// NEW: Get from config
function setFirstQuestion() {
  window.sess.cur = getFirstQuestion(EXAM_CONFIG);
}

// STEP 8: MASTER INITIALIZATION FUNCTION
// Add this function to replace all hardcoded initialization
async function initializeTestSeries(testId, seriesId) {
  try {
    console.log('🚀 Initializing Test Series:', { testId, seriesId });

    // 1. Fetch all config
    const { series, test, template, config } = await initTestSeriesEngine(testId, seriesId);

    // 2. Update dynamic values
    updateExamStructure(config);
    
    // 3. Update storage keys
    const keys = getStorageKeys(config);
    KEY_DATA = keys.DATA;
    KEY_SESS = keys.SESS;
    KEY_SESS_HASH = keys.SESS_HASH;
    
    // 4. Store for later use
    window.examConfig = config;
    window.examTemplate = template;
    window.examSeries = series;
    window.examTest = test;

    // 5. Build answer key from questions
    const questions = template.questions || [];
    EXAM_ANSWER_KEY = buildAnswerKeyFromQuestions(questions, template);

    // 6. Initialize session
    window.sess = initExamDB();
    setFirstQuestion();

    console.log('✅ Test Series initialized successfully');
    console.log('📋 Config:', { S, SEC, SEC_CFG, duration: config.duration });

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to initialize test series:', error);
    throw error;
  }
}

// STEP 9: ADAPT ANALYSIS ENGINE (calculateResults function)
// OLD: Assumes Paper 1 and Paper 2, hardcoded marking
// function calculateResults(paperNum) {
//   if (paperNum === 1) {
//     // Paper 1 specific logic with hardcoded marks
//   }
// }

// NEW: Dynamic based on series config
function calculateResults() {
  let totalScore = 0;
  let subjectScores = {};
  
  S.forEach(subject => {
    subjectScores[subject] = 0;
  });

  const results = {
    score: 0,
    subjectScores,
    sections: {},
    correct: 0,
    wrong: 0,
    skipped: 0,
  };

  // Iterate through sections dynamically
  SEC.forEach(section => {
    results.sections[section] = 0;
    
    S.forEach(subject => {
      const sectionData = window.sess.data[subject]?.[section];
      if (!sectionData) return;

      Object.entries(sectionData).forEach(([qIndex, qData]) => {
        if (qData.sel === null) {
          results.skipped++;
        } else {
          // Get marking from config
          const { plusMarks, negMarks } = getMarking(section, '', EXAM_CONFIG);
          
          // Check if correct (from answer key)
          const correctAns = EXAM_ANSWER_KEY[subject]?.[section]?.[qIndex];
          
          if (qData.sel === correctAns) {
            results.correct++;
            totalScore += plusMarks;
            subjectScores[subject] += plusMarks;
            results.sections[section] += plusMarks;
          } else {
            results.wrong++;
            totalScore += negMarks;
            subjectScores[subject] += negMarks;
            results.sections[section] += negMarks;
          }
        }
      });
    });
  });

  results.score = totalScore;
  results.subjectScores = subjectScores;
  
  // Calculate rank using series rank mapping
  results.rank = calculateRank(totalScore, EXAM_CONFIG);
  
  return results;
}

// STEP 10: ENTRY POINT
// When user clicks "Start Exam" on a test series:
// 1. Get testId and seriesId from URL/page context
// 2. Call: await initializeTestSeries(testId, seriesId);
// 3. Show instructions modal
// 4. User starts exam - everything uses dynamic config

// STEP 11: REVIEW MODE
// OLD: Checks for "Paper 1" and "Paper 2" in subtitle
// NEW: Use test name directly, no paper concept
function enterReviewMode() {
  const testId = window.currentTestId;
  const seriesId = window.currentSeriesId;
  
  if (!testId || !seriesId) {
    alert('Test data not found');
    return;
  }

  // Initialize first if not done
  if (!EXAM_CONFIG || Object.keys(EXAM_CONFIG).length === 0) {
    initializeTestSeries(testId, seriesId).then(() => {
      continueReviewMode();
    });
  } else {
    continueReviewMode();
  }
}

function continueReviewMode() {
  window.isReviewMode = true;
  
  // Create fresh session
  window.sess = initExamDB();
  setFirstQuestion();
  
  // Restore answers from localStorage
  // ... existing restoration logic ...

  navTo('exam');
  window.renderQuestion();
}

// ==============================================================================
// TESTING CHECKLIST
// ==============================================================================
//
// ✅ Test with JEE 2025 default config (backward compatibility)
// ✅ Test with custom 2-subject series
// ✅ Test with different marking schemes
// ✅ Test with different question counts
// ✅ Test analysis engine calculates correctly
// ✅ Test review mode works
// ✅ Test multiple test series coexist (separate localStorage)
// ✅ Test images display correctly for questions and options
//
// ==============================================================================
