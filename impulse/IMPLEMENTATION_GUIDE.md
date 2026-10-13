# Test Series Platform - Complete Implementation Guide

## Overview

This system transforms the hardcoded JEE 2025 exam engine into a flexible test series platform where admins can create unlimited test series with any subjects, sections, and marking schemes.

## Architecture

```
Admin Panel (React) 
    ↓
Backend API (Node.js)
    ↓
Test Series Data
    ↓
Dynamic Exam Engine (jee2025)
    ↓
Student Experience
```

## File Structure

### Frontend Admin Components
```
web/src/admin/TestSeriesManager/
├── index.jsx                 (Main router/container)
├── SeriesDashboard.jsx       (Grid of series)
├── SeriesEditor.jsx          (Edit series properties)
├── TestsPanel.jsx            (Manage tests in series)
├── SubjectsPanel.jsx         (List subjects)
├── SectionsPanel.jsx         (Manage sections)
├── QuestionsPanel.jsx        (List questions)
├── QuestionEditor.jsx        (Full question editor with images)
└── ImageUploadField.jsx      (Reusable image upload)
```

### Backend API
```
server/index.js
├── GET /api/series                  (List all series)
├── POST /api/series                 (Create series)
├── PUT /api/series/:id              (Update series)
├── DELETE /api/series/:id           (Delete series)
├── GET /api/tests                   (List all tests)
├── GET /api/tests/:id               (Get single test)
├── POST /api/tests                  (Create test)
├── PUT /api/tests/:id               (Update test)
├── DELETE /api/tests/:id            (Delete test)
├── GET /api/tests/:id/template      (Get test with questions)
├── GET /api/series/:id/tests        (Get tests in series)
├── POST /api/uploads                (Upload image)
└── GET /api/uploads/*               (Serve images)
```

### Exam Engine Utilities
```
web/src/lib/testSeriesEngine.js
├── initTestSeriesEngine()           (Main init function)
├── buildExamConfig()                (Convert series to config)
├── buildSectionConfig()             (Extract sections)
├── buildMarkingScheme()             (Extract marking)
├── buildAnswerKeyFromQuestions()    (Build from data)
├── getMarking()                     (Lookup marking for section)
├── getFirstQuestion()               (Get initial question)
├── getStorageKeys()                 (Generate storage namespace)
├── initExamDatabase()               (Create session structure)
├── calculateScore()                 (Dynamic scoring)
└── calculateRank()                  (Dynamic rank calculation)
```

## Admin Panel Usage

### Step 1: Create a Test Series
1. Go to Admin Portal → Test Series
2. Click "New Series"
3. Enter series name, description, exam label, duration
4. Save

### Step 2: Configure Series
1. Click "Edit" on series
2. **Basic Info tab**: Set name, duration, exam label
3. **Subjects tab**: Add subjects (Physics, Chemistry, Math, etc.)
4. **Sections tab**: Add sections with:
   - Name (A, B, C, D, etc.)
   - Type (MCQ, MULTI, NUM)
   - Questions per subject
   - +Marks and -Marks
5. Save

### Step 3: Create Tests in Series
1. Go to Series → Click "Tests" tab
2. Click "New Test"
3. Name it (Test 1, Full Length 1, etc.)
4. Navigate to Subjects

### Step 4: Manage Test Subjects
1. Series → Test → Subjects
2. Click subject to go to sections

### Step 5: Manage Sections
1. Subjects → Click subject → Sections
2. See available sections (inherited from series config)

### Step 6: Add Questions
1. Sections → Click section → Questions
2. Click "New Question"
3. Enter question text
4. Upload question image (optional)
5. Add options (A, B, C, D)
6. Upload option images (optional)
7. Mark correct answer
8. Save

## API Data Formats

### Series Schema
```javascript
{
  id: "series-123456",
  title: "JEE Advanced 2025",
  description: "Full syllabus test series",
  examLabel: "JEE Advanced",
  durationMinutes: 180,
  subjects: ["Physics", "Chemistry", "Mathematics"],
  sections: [
    {
      name: "A",
      type: "MCQ",
      questionCountPerSubject: 4,
      posMarks: 3,
      negMarks: -1,
      applicableToSubjects: ["Physics", "Chemistry", "Mathematics"]
    }
  ],
  rankMapping: [ [360, 1], [300, 100], ... ],
  settings: {
    shuffleQuestions: true,
    shuffleOptions: true,
    sectionLock: true,
    timerVisible: true
  },
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z"
}
```

### Test Schema
```javascript
{
  id: "test-123456",
  title: "Full Length Test 1",
  seriesId: "series-123456",
  sections: [
    {
      id: "sec-physics-a",
      subject: "Physics",
      sectionName: "A",
      type: "MCQ",
      questions: ["q-1", "q-2", "q-3", "q-4"]
    }
  ],
  durationSec: 10800,
  published: false,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z"
}
```

### Question Schema
```javascript
{
  id: "q-123456",
  text: "What is the value of...",
  imageUrl: "/uploads/q-123456.jpg",
  type: "MCQ",
  options: [
    {
      text: "Option A",
      imageUrl: "/uploads/q-123456-a.jpg",
      key: "A"
    }
  ],
  answer: "A",
  testId: "test-123456",
  subject: "Physics",
  section: "A",
  orderInSection: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z"
}
```

## Exam Engine Integration

### Entry Point
```javascript
// When user starts a test from series
const testId = "test-123456";
const seriesId = "series-123456";

// Initialize everything
await initializeTestSeries(testId, seriesId);

// Now all these are dynamic:
// - S (subjects list)
// - SEC (sections list)
// - SEC_CFG (section config)
// - EXAM_CONFIG (full config)
// - EXAM_ANSWER_KEY (answers)
// - Storage keys

// Show instructions modal
showInstructionsModal();
```

### Key Functions to Use

```javascript
// Get marking for scoring
const { plusMarks, negMarks } = getMarking(sectionName, questionType, config);

// Calculate score dynamically
const score = scoreAnswer(userAnswer, correctAnswer, type, section);

// Calculate final rank
const rank = calculateRank(totalScore, config);

// Initialize session database
const session = initExamDB();
```

## Data Flow

### Create Test Series
```
Admin fills form
    ↓
POST /api/series
    ↓
Data saved to server/data/series.json
    ↓
Admin sees series in dashboard
```

### Create Test
```
Admin clicks New Test
    ↓
POST /api/tests { seriesId, title }
    ↓
Data saved to server/data/tests.json
    ↓
Test appears in tests grid
```

### Add Questions
```
Admin uploads question
    ↓
POST /api/uploads (image file)
    ↓
Image saved to server/data/uploads/
    ↓
POST /api/questions { text, imageUrl, options, answer }
    ↓
Data saved to server/data/engine-questions.json
    ↓
Question appears in list
```

### Student Takes Test
```
Student clicks "Start Test"
    ↓
Load: testId, seriesId from URL
    ↓
initializeTestSeries(testId, seriesId)
    ↓
Fetch /api/series/:seriesId
Fetch /api/tests/:testId
Fetch /api/tests/:testId/template
    ↓
Build dynamic config
    ↓
Initialize exam engine with config
    ↓
Show exam UI with questions
    ↓
Student answers questions
    ↓
Submit answers
    ↓
calculateResults() with series config
    ↓
Show results and rank
```

## Storage Structure

### Server Side
```
server/data/
├── admin-state.json        (Admin profile, activity)
├── series.json             (All test series)
├── tests.json              (All tests)
├── engine-questions.json   (All questions)
└── uploads/
    ├── questions/          (Question images)
    └── options/            (Option images)
```

### Client Side (LocalStorage)
```
Per test series:
- test_series_{testId}_data_v1      (User progress)
- test_series_{testId}_sess_v1      (Session state)
- test_series_{testId}_sess_v1_hash (Tamper detection)

Admin panel:
- impulse_admin_session
- impulse_admin_exams
- impulse_admin_profile
- impulse_admin_activity
```

## Backward Compatibility

### JEE 2025 Still Works
```javascript
// Create a default JEE 2025 series in database
{
  id: "jee2025",
  title: "JEE Advanced 2025",
  subjects: ["Physics", "Chemistry", "Mathematics"],
  sections: [
    { name: "A", type: "MCQ", questionCountPerSubject: 4, posMarks: 3, negMarks: -1 },
    { name: "B", type: "MULTI", questionCountPerSubject: 3, posMarks: 4, negMarks: -2 },
    { name: "C", type: "NUM", questionCountPerSubject: 6, posMarks: 4, negMarks: 0 },
    { name: "D", type: "MCQ", questionCountPerSubject: 3, posMarks: 4, negMarks: -1 }
  ],
  rankMapping: [ [332, 1], [278, 100], ... ]
}
```

## TODO Checklist

### Completed ✅
- [x] Backend API endpoints for series/tests/uploads
- [x] Admin UI components (all 8 components)
- [x] TestSeriesManager container with routing
- [x] ImageUploadField component
- [x] testSeriesEngine.js utility library
- [x] AdminPortalPage integration

### TODO - Remaining Work
- [ ] Modify jee2025/app.js to use initializeTestSeries()
- [ ] Replace hardcoded S, SEC, SEC_CFG with dynamic values
- [ ] Update scoreAnswer() to use getMarking()
- [ ] Update calculateResults() to use dynamic config
- [ ] Update review-mode.js for series (remove "Paper" concept)
- [ ] Add question CRUD endpoints in admin
- [ ] Seed database with sample test series
- [ ] Test end-to-end flow
- [ ] Test image uploads work
- [ ] Test multiple series coexist
- [ ] Verify JEE 2025 still works
- [ ] Create migration guide for existing data

## Testing Strategy

### Unit Tests
```javascript
// Test marking calculation
assert getMarking('A', 'MCQ', config) === { plusMarks: 3, negMarks: -1 }

// Test config building
assert buildExamConfig(series, test).subjects.length > 0

// Test score calculation
assert calculateScore(answers, answerKey, config) > 0
```

### Integration Tests
```javascript
// Test series creation → test creation → question addition → start exam
1. Create series via admin
2. Create test via admin
3. Add questions via admin
4. Student starts exam from series
5. Questions load correctly
6. Scoring works correctly
7. Results display correctly
```

### Regression Tests
```javascript
// Ensure JEE 2025 still works
1. Load default JEE 2025 series
2. Start exam
3. Subjects/sections load
4. Marking calculates correctly
5. Results show rank correctly
```

## Common Issues & Solutions

### Issue: Questions don't load
**Solution**: Check that questions have testId matching current test ID

### Issue: Images don't display
**Solution**: Verify image URL path is correct in database

### Issue: Marking calculates wrong
**Solution**: Ensure SEC_CFG/marking scheme matches series config

### Issue: Storage conflicts
**Solution**: Use unique storage namespace per test ID

### Issue: Answers not saved
**Solution**: Check tamper detection hash - may need localStorage reset

## Performance Considerations

- Questions per test: Up to 100 recommended
- Image size: Max 5MB per image
- Lazy load large question sets with pagination
- Cache series config in sessionStorage
- Debounce answer submissions

## Security Notes

- Verify admin authentication on all API calls
- Validate marking scheme can't be modified by student
- Hash answer submissions (already in place)
- Verify testId matches seriesId on backend
- Sanitize question text (XSS protection)

## Future Enhancements

- [ ] Question bank reusability across series
- [ ] Test scheduling/release dates
- [ ] Student attempt history per series
- [ ] Analytics dashboard for series performance
- [ ] Import questions from files
- [ ] Bulk question upload
- [ ] Question variations/randomization
- [ ] Custom rank calculation formulas
- [ ] Mobile app support
