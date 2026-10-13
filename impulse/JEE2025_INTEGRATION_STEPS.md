/**
 * ==============================================================================
 * HOW TO INTEGRATE TEST SERIES ADAPTER INTO jee2025/app.js
 * ==============================================================================
 * 
 * This file provides exact code changes needed to make app.js work with
 * dynamic test series instead of hardcoded JEE 2025 values.
 * 
 * Each step shows the exact lines to modify.
 */

// ==============================================================================
// STEP 1: Import the adapter at the top of app.js
// ==============================================================================

// ADD AFTER: const SECRET_SALT = 'jee_adv_2025_salt_v1';
// ADD BEFORE: const SERVER_URL = window.__EXAM_SERVER_URL__ || 'http://localhost:4000';

// Location: Line ~6 in current app.js
// ADD THIS LINE:

/*
<script src="/jee2025/assets/js/test-series-adapter.js"></script>
*/

// This must be loaded BEFORE app.js or imported at the top of app.js

// ==============================================================================
// STEP 2: Make KEY_DATA, KEY_SESS, KEY_SESS_HASH dynamic
// ==============================================================================

// BEFORE (Lines 2-4):
/*
const KEY_DATA = 'jee_adv_2025_data_v1';
const KEY_SESS = 'jee_adv_2025_sess_v1';
const KEY_SESS_HASH = 'jee_adv_2025_sess_v1_hash';
*/

// AFTER: Change to let (not const)
/*
let KEY_DATA = 'jee_adv_2025_data_v1';
let KEY_SESS = 'jee_adv_2025_sess_v1';
let KEY_SESS_HASH = 'jee_adv_2025_sess_v1_hash';
*/

// REASON: These will be updated dynamically per test series

// ==============================================================================
// STEP 3: Make S and SEC dynamic
// ==============================================================================

// BEFORE (Lines 168-169):
/*
const S = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'];
const SEC = ['A', 'B', 'C', 'D'];
*/

// AFTER: Change to let and add initialization function
/*
let S = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'];
let SEC = ['A', 'B', 'C', 'D'];
let SEC_CFG = {};

function updateExamStructure(config) {
  S = config.subjects || S;
  SEC = Object.keys(config.sections || {});
  SEC_CFG = config.sections || {};
}
*/

// ==============================================================================
// STEP 4: Remove hardcoded SEC_CFG definition (Line 340-346)
// ==============================================================================

// BEFORE:
/*
const SEC_CFG = {
  'A': [4, 'MCQ', 3, 1],
  'B': [3, 'MULTI', 4, 2],
  'C': [6, 'NUM', 4, 0],
  'D': [3, 'MCQ', 4, 1]
};
*/

// AFTER: DELETE this, use updateExamStructure() function instead

// ==============================================================================
// STEP 5: Make ANSWER_KEY dynamic
// ==============================================================================

// BEFORE (Lines 352-388): Large ANSWER_KEY definition
/*
const ANSWER_KEY = {
  1: { // Paper 1
    PHYSICS: { ... }
  },
  2: { // Paper 2
    PHYSICS: { ... }
  }
};
*/

// AFTER: Change to let and populate dynamically
/*
let ANSWER_KEY = {};

function setAnswerKey(answerKeyData) {
  ANSWER_KEY = answerKeyData || {};
}
*/

// ==============================================================================
// STEP 6: Update scoreAnswer() to use dynamic marking
// ==============================================================================

// BEFORE (Lines 392-410):
/*
const scoreAnswer = (userAns, correctAns, type, sec) => {
  let plusMark = 0, minusMark = 0;
  if (type === 'MCQ') {
    if (sec === 'D') {
      plusMark = 4; minusMark = 1;
    } else {
      plusMark = 3; minusMark = 1;
    }
  } else if (type === 'MULTI') {
    plusMark = 4; minusMark = 2;
  }
  // ... more hardcoded logic
};
*/

// AFTER: Use adapter for marking
/*
const scoreAnswer = (userAns, correctAns, type, sec) => {
  // Use adapter if available
  if (window.testSeriesAdapter && window.testSeriesAdapter.config) {
    const marks = window.testSeriesAdapter.getMarking(sec);
    const plusMark = marks.plusMarks;
    const minusMark = marks.negMarks;

    if (!userAns) return 0;
    if (userAns === correctAns) return plusMark;
    return minusMark;
  }

  // Fallback to original logic
  let plusMark = 0, minusMark = 0;
  if (type === 'MCQ') {
    if (sec === 'D') {
      plusMark = 4; minusMark = 1;
    } else {
      plusMark = 3; minusMark = 1;
    }
  } else if (type === 'MULTI') {
    plusMark = 4; minusMark = 2;
  }
  // ... rest of original logic
};
*/

// ==============================================================================
// STEP 7: Add initialization function that gets called on page load
// ==============================================================================

// ADD THIS NEW FUNCTION:
/*
async function initializeTestSeriesIfAvailable() {
  try {
    // Get test ID and series ID from URL or page context
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('testId') || window.currentTestId;
    const seriesId = urlParams.get('seriesId') || window.currentSeriesId;

    if (testId && seriesId) {
      console.log('📋 [App] Initializing with test series:', { testId, seriesId });

      // Initialize adapter
      const config = await window.testSeriesAdapter.initialize(testId, seriesId);

      // Update app structures
      updateExamStructure(config);
      
      // Update storage keys
      KEY_DATA = window.testSeriesAdapter.storageKeys.DATA;
      KEY_SESS = window.testSeriesAdapter.storageKeys.SESS;
      KEY_SESS_HASH = window.testSeriesAdapter.storageKeys.SESS_HASH;

      // Set answer key
      setAnswerKey(window.testSeriesAdapter.answerKey);

      console.log('✅ [App] Test series initialized');
      return true;
    }
  } catch (error) {
    console.error('⚠️ [App] Failed to initialize test series, using JEE 2025 defaults:', error);
  }
  return false;
}
*/

// ==============================================================================
// STEP 8: Call initialization early
// ==============================================================================

// Find the initFromFocusHub() function (around line 28)
// ADD THIS BEFORE showing instructions:

/*
// Initialize test series first if available
await initializeTestSeriesIfAvailable();

// THEN continue with existing logic
*/

// OR find where exam starts and call:
// await initializeTestSeriesIfAvailable();

// ==============================================================================
// STEP 9: Update calculateResults() function
// ==============================================================================

// Find calculateResults() function (around line 500-600)
// For the rank calculation part, BEFORE (old code):

/*
for (let i = 0; i < RANK_TREND.length - 1; i++) {
  const [lower, lowerRank] = RANK_TREND[i];
  // ...
}
*/

// AFTER: Use adapter if available
/*
const rankMapping = (window.testSeriesAdapter && window.testSeriesAdapter.config)
  ? window.testSeriesAdapter.config.rankMapping
  : RANK_TREND;

for (let i = 0; i < rankMapping.length - 1; i++) {
  const [lower, lowerRank] = rankMapping[i];
  // ... rest stays same
}
*/

// ==============================================================================
// STEP 10: Export/Store adapter results globally
// ==============================================================================

// ADD this at end of initialization:
/*
window.examConfig = window.testSeriesAdapter.config;
window.examAnswerKey = window.testSeriesAdapter.answerKey;
window.examStorageKeys = window.testSeriesAdapter.storageKeys;
*/

// ==============================================================================
// SUMMARY OF CHANGES
// ==============================================================================

// Files to modify:
// 1. jee2025/exam/index.html - Add <script src="/jee2025/assets/js/test-series-adapter.js"></script>
// 2. jee2025/assets/js/app.js - Make changes described above

// Lines to change:
// - Line 2-4: Make KEY_DATA/KEY_SESS/KEY_SESS_HASH let instead of const
// - Line 168-169: Make S/SEC let instead of const
// - Line 320-350: Remove hardcoded SEC_CFG definition
// - Line 352-388: Replace hardcoded ANSWER_KEY with dynamic version
// - Line 392-410: Update scoreAnswer() to use adapter
// - Line 28+ (initFromFocusHub): Add initialization call
// - Line 500-600 (calculateResults): Use adapter for rank mapping

// Key principles:
// 1. Change const to let for values that will be dynamic
// 2. Add adapter initialization early in page load
// 3. Use adapter.getMarking() instead of hardcoded marking logic
// 4. Use adapter.config.rankMapping instead of hardcoded RANK_TREND
// 5. Fall back to JEE 2025 defaults if adapter fails or no test series provided

// ==============================================================================
// TESTING AFTER CHANGES
// ==============================================================================

// Test 1: JEE 2025 (no test series)
// - Load: jee2025/exam/index.html
// - Result: Should use hardcoded JEE 2025 defaults
// - Check console: Should see "Using JEE 2025 defaults"

// Test 2: Custom test series
// - Load: jee2025/exam/index.html?testId=test-123&seriesId=series-456
// - Result: Should initialize with series config
// - Check console: Should see "Test series initialized"
// - Check page: Should show series subjects/sections

// Test 3: Admin creates series and adds questions
// - Create series via admin panel
// - Create test via admin panel
// - Add questions via admin panel
// - Load exam with test ID and series ID
// - Result: Exam should show correct questions, marking, sections

// ==============================================================================
