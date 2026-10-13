# Test Series Platform - Architecture Diagrams

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                          │
│                                                                   │
│  ┌──────────────────────┐          ┌──────────────────────┐     │
│  │   Admin Portal       │          │  Student Exam UI     │     │
│  │  (React)             │          │  (Vanilla JS)        │     │
│  │                      │          │                      │     │
│  │ Test Series Manager  │          │ jee2025/exam         │     │
│  │ - Dashboard          │          │ - Question display   │     │
│  │ - Series Editor      │          │ - Answer input       │     │
│  │ - Tests Panel        │          │ - Timer              │     │
│  │ - Questions Editor   │          │ - Results            │     │
│  │ - Image Upload       │          │ - Review Mode        │     │
│  └──────────────┬───────┘          └──────────┬───────────┘     │
│                 │                             │                  │
│                 │                    Test Series Adapter         │
│                 │              (Dynamic Config Builder)          │
│                 │                      ├─ Initialize series      │
│                 │                      ├─ Build exam config      │
│                 │                      ├─ Dynamic scoring        │
│                 └──────────────────────┤─ Rank calculation       │
│                        │               └─ Answer key builder     │
└────────────────────────┼───────────────────────────────────────┘
                         │
                    NETWORK / HTTP
                         │
┌────────────────────────┼───────────────────────────────────────┐
│                        │        BACKEND SERVER                 │
│              ┌─────────▼──────────┐                            │
│              │  Node.js HTTP      │                            │
│              │  server/index.js   │                            │
│              │                    │                            │
│              │  REST API Endpoints│                            │
│              │  - /api/series/*   │                            │
│              │  - /api/tests/*    │                            │
│              │  - /api/uploads    │                            │
│              │  - /api/admin-*    │                            │
│              └─────────┬──────────┘                            │
│                        │                                       │
│        ┌───────────────┼───────────────┐                       │
│        │               │               │                       │
│        ▼               ▼               ▼                       │
│   ┌─────────┐   ┌──────────┐   ┌────────────┐               │
│   │ series  │   │  tests   │   │ questions  │               │
│   │ .json   │   │  .json   │   │  .json     │               │
│   └─────────┘   └──────────┘   └────────────┘               │
│                                                              │
│   ┌────────────────────────────────────────────┐           │
│   │  uploads/                                  │           │
│   │  ├─ question-images/                       │           │
│   │  ├─ option-images/                         │           │
│   │  └─ [base64 stored files]                  │           │
│   └────────────────────────────────────────────┘           │
│                                                              │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Admin Panel Navigation Flow

```
Admin Portal
│
├─ Test Series Tab
│  │
│  └─ TestSeriesManager (Main Router)
│     │
│     ├─ Workspace Level 1: DASHBOARD
│     │  └─ SeriesDashboard
│     │     ├─ Grid of all series
│     │     └─ Create/Edit/Delete buttons
│     │
│     ├─ Workspace Level 2: SERIES_EDITOR
│     │  └─ SeriesEditor
│     │     ├─ Basic Info Tab (name, duration, label)
│     │     ├─ Subjects Tab (add/remove subjects)
│     │     └─ Sections Tab (configure A, B, C, D with marking)
│     │
│     ├─ Workspace Level 3: TESTS
│     │  └─ TestsPanel
│     │     ├─ List of tests in series
│     │     ├─ Create test button
│     │     └─ Delete test buttons
│     │
│     ├─ Workspace Level 4: SUBJECTS
│     │  └─ SubjectsPanel
│     │     ├─ List of subjects
│     │     └─ Click subject to continue
│     │
│     ├─ Workspace Level 5: SECTIONS
│     │  └─ SectionsPanel
│     │     ├─ Sections for selected subject
│     │     └─ Click section to add questions
│     │
│     ├─ Workspace Level 6: QUESTIONS
│     │  └─ QuestionsPanel
│     │     ├─ List of questions in section
│     │     ├─ New Question button
│     │     └─ Delete question buttons
│     │
│     └─ Workspace Level 7: QUESTION_EDITOR
│        └─ QuestionEditor
│           ├─ Question text input
│           ├─ Question image upload
│           ├─ Option A-D editor
│           │  └─ ImageUploadField for each option
│           └─ Mark correct answer
│
├─ Breadcrumb Trail (All Levels)
│  ├─ Series
│  ├─ > Test 1
│  ├─ > Physics
│  ├─ > Section A
│  ├─ > Questions
│  └─ > Question Editor
│     (Click any level to jump back)
│
└─ Back Button (All Levels)
   └─ Navigate to parent level
```

---

## 3. Data Model Relationships

```
┌─────────────────────────────────────────────────┐
│                    SERIES                       │
│                                                 │
│  ├─ id: "series-123"                           │
│  ├─ title: "JEE 2025"                          │
│  ├─ subjects: ["Physics", "Chemistry", "Math"] │
│  │                                             │
│  └─ sections: Array[                           │
│     {                                          │
│       name: "A",                               │
│       type: "MCQ",                             │
│       questionCountPerSubject: 4,              │
│       posMarks: 3,                             │
│       negMarks: -1                             │
│     }                                          │
│  ]                                             │
│                                                 │
└─────────────────────────────────────────────────┘
                          │ 1:Many
                          ▼
┌─────────────────────────────────────────────────┐
│                     TEST                        │
│                                                 │
│  ├─ id: "test-456"                             │
│  ├─ seriesId: "series-123" ◄─────┐            │
│  ├─ title: "Full Length 1"        │ Foreign   │
│  │                                │ Key      │
│  └─ sections: Array[              │          │
│     {                              │          │
│       subject: "Physics",          │          │
│       sectionName: "A",            │          │
│       questions: ["q-1", "q-2"]    │          │
│     }                              │          │
│  ]                                 │          │
│                                    │          │
└────────────────────────────────────┼──────────┘
                                     │
              ┌──────────────────────┘
              │ 1:Many
              ▼
┌─────────────────────────────────────────────────┐
│                   QUESTION                      │
│                                                 │
│  ├─ id: "q-1"                                  │
│  ├─ testId: "test-456"                         │
│  ├─ text: "What is X?"                         │
│  ├─ imageUrl: "/uploads/q-1.jpg"               │
│  ├─ type: "MCQ"                                │
│  ├─ answer: "A"                                │
│  │                                             │
│  └─ options: Array[                            │
│     {                                          │
│       text: "Option A",                        │
│       imageUrl: "/uploads/q-1-a.jpg",         │
│       key: "A"                                 │
│     }                                          │
│  ]                                             │
│                                                 │
└─────────────────────────────────────────────────┘
                          │
                         1:1
                          ▼
         ┌───────────────────────────┐
         │  Image File (Upload)      │
         │  /server/data/uploads/    │
         │  ├─ q-1.jpg               │
         │  ├─ q-1-a.jpg             │
         │  ├─ q-1-b.jpg             │
         │  └─ ...                   │
         └───────────────────────────┘
```

---

## 4. Exam Engine Flow

```
Student Loads: jee2025/exam/?testId=test-456&seriesId=series-123
│
▼
┌──────────────────────────────────────────────┐
│  Browser Loads HTML                          │
│  ├─ Loads storage-manager.obf.js            │
│  ├─ Loads precision-timer.obf.js            │
│  ├─ Loads precision-integration.obf.js      │
│  ├─ Loads test-series-adapter.js [NEW]      │
│  └─ Loads app.obf.js                        │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  initFromFocusHub() called                   │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  testSeriesAdapter.initialize(testId,        │
│                               seriesId)      │
│                                              │
│  ├─ Fetch /api/series/:seriesId              │
│  │  └─ Get subjects, sections, marking      │
│  │                                           │
│  ├─ Fetch /api/tests/:testId                 │
│  │  └─ Get test metadata                     │
│  │                                           │
│  ├─ Fetch /api/tests/:testId/template        │
│  │  └─ Get questions with answers            │
│  │                                           │
│  ├─ Build EXAM_CONFIG                        │
│  │  ├─ S = subjects                          │
│  │  ├─ SEC = section names                   │
│  │  ├─ SEC_CFG = section config              │
│  │  └─ rankMapping = rank data               │
│  │                                           │
│  ├─ Build EXAM_ANSWER_KEY                    │
│  │  └─ From questions data                   │
│  │                                           │
│  └─ Update storage keys                      │
│     └─ test_series_{testId}_*                │
│                                              │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  Student sees Exam UI                        │
│  ├─ Subjects: Physics, Chemistry, Math       │
│  ├─ Sections: A, B, C, D                     │
│  ├─ Questions: 4 MCQ + 3 MULTI + 6 NUM       │
│  └─ Marking: Section specific                │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  Student answers questions                   │
│  ├─ Answer saved every 2-3 seconds          │
│  ├─ Uses storage key from adapter            │
│  └─ Auto-recovery on page reload            │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  Student submits exam                        │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  calculateResults()                          │
│  ├─ Iterate through all answers              │
│  ├─ Get marking from EXAM_CONFIG             │
│  │  └─ Use adapter.getMarking(section)      │
│  ├─ Calculate score for each answer          │
│  │  ├─ Correct: +posMarks                    │
│  │  ├─ Wrong: negMarks (can be negative)     │
│  │  └─ Skipped: 0                            │
│  ├─ Sum by subject and section               │
│  ├─ Calculate rank using rankMapping         │
│  │  └─ Linear interpolation                  │
│  └─ Return results object                    │
└──────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────┐
│  Show Results                                │
│  ├─ Total Score                              │
│  ├─ Subject Breakdown                        │
│  ├─ Section Breakdown                        │
│  ├─ Correct/Wrong/Skipped Count              │
│  ├─ Estimated Rank                           │
│  └─ Review Mode Button                       │
└──────────────────────────────────────────────┘
```

---

## 5. File Organization - Tree View

```
impulse/
│
├── server/
│   ├── index.js                           [MODIFIED: +5 endpoints]
│   └── data/
│       ├── series.json                    [NEW: Series configs]
│       ├── tests.json                     [NEW: Test instances]
│       ├── engine-questions.json          [NEW: Questions data]
│       ├── admin-state.json
│       └── uploads/                       [NEW: Images directory]
│           ├── questions/
│           └── options/
│
├── web/
│   ├── src/
│   │   ├── admin/
│   │   │   └── TestSeriesManager/         [NEW: 9 components]
│   │   │       ├── index.jsx              Router + workspace nav
│   │   │       ├── SeriesDashboard.jsx    Series grid
│   │   │       ├── SeriesEditor.jsx       Series editor
│   │   │       ├── TestsPanel.jsx         Tests list
│   │   │       ├── SubjectsPanel.jsx      Subjects display
│   │   │       ├── SectionsPanel.jsx      Sections config
│   │   │       ├── QuestionsPanel.jsx     Questions list
│   │   │       ├── QuestionEditor.jsx     Question editor
│   │   │       └── ImageUploadField.jsx   Image upload component
│   │   │
│   │   ├── lib/
│   │   │   ├── testSeriesEngine.js        [NEW: Utilities]
│   │   │   │   ├─ initTestSeriesEngine()
│   │   │   │   ├─ buildExamConfig()
│   │   │   │   ├─ calculateScore()
│   │   │   │   └─ calculateRank()
│   │   │   │
│   │   │   └── portalServer.js            [MODIFIED: +7 functions]
│   │   │
│   │   └── pages/
│   │       └── AdminPortalPage.jsx        [MODIFIED: Integrated TestSeriesManager]
│   │
│   └── package.json
│
├── jee2025/
│   ├── exam/
│   │   └── index.html                     [MODIFIED: Added adapter script tag]
│   │
│   ├── assets/
│   │   ├── js/
│   │   │   ├── app.obf.js                 [Hardcoded JEE 2025 - unchanged]
│   │   │   ├── test-series-adapter.js     [NEW: TestSeriesAdapter class]
│   │   │   ├── storage-manager.obf.js
│   │   │   ├── precision-timer.obf.js
│   │   │   ├── precision-integration.obf.js
│   │   │   ├── review-mode.obf.js
│   │   │   └── error-handler.obf.js
│   │   │
│   │   └── css/
│   │       ├── styles.css
│   │       └── dashboard.css
│   │
│   └── images/
│
└── [Documentation files]
    ├── IMPLEMENTATION_GUIDE.md            [NEW: Full system guide]
    ├── JEE2025_INTEGRATION_STEPS.md        [NEW: Integration steps]
    ├── TEST_SERIES_INTEGRATION.js          [NEW: Code examples]
    ├── QUICK_START_GUIDE.md                [NEW: Quick start]
    └── IMPLEMENTATION_COMPLETE.md          [NEW: Summary]
```

---

## 6. API Call Sequence Diagram

```
Admin Creates Series
│
├─ Admin fills form in SeriesDashboard
│  └─ Title, Duration, Description
│
└─ Click "Create Series"
   │
   ├─ validateForm()
   │
   ├─ POST /api/series
   │  │
   │  ├─ server checks auth (cookie)
   │  │
   │  ├─ server generates ID
   │  │
   │  ├─ server writes to series.json
   │  │
   │  └─ returns { id, title, ... }
   │
   └─ update state
      └─ refresh dashboard


Admin Edits Series
│
├─ Click "Edit" on series card
│  └─ Open SeriesEditor
│
├─ Edit subjects
│  └─ Add/remove items from array
│
├─ Edit sections
│  └─ Configure A, B, C, D with marking
│
└─ Click "Save"
   │
   ├─ validateForm()
   │
   ├─ PUT /api/series/{id}
   │  │
   │  ├─ server checks auth
   │  │
   │  ├─ server reads series.json
   │  │
   │  ├─ server merges changes
   │  │
   │  ├─ server writes back
   │  │
   │  └─ returns updated series
   │
   └─ update state
      └─ show confirmation


Admin Uploads Question Image
│
├─ Click "Upload Image" in QuestionEditor
│
├─ User selects image file
│
├─ handleFileSelect()
│  ├─ validate size (< 5MB)
│  ├─ validate type (image/*)
│  │
│  └─ call uploadImage(file)
│
├─ uploadImage()
│  ├─ read file with FileReader
│  │
│  ├─ convert to Base64
│  │
│  ├─ POST /api/uploads
│  │  │
│  │  ├─ server receives { filename, data, mime }
│  │  │
│  │  ├─ server decodes Base64
│  │  │
│  │  ├─ server saves to /uploads/
│  │  │
│  │  └─ returns { url: "/uploads/q-123.jpg" }
│  │
│  └─ set preview to imageUrl
│
└─ user sees preview with delete button


Student Starts Exam
│
├─ navigate to jee2025/exam/?testId=test-123&seriesId=series-456
│
├─ HTML loads with test-series-adapter.js
│
├─ app.js calls initFromFocusHub()
│
├─ testSeriesAdapter.initialize(testId, seriesId)
│  │
│  ├─ GET /api/series/{seriesId}
│  │  ├─ server returns series config
│  │  └─ client gets subjects, sections, marking
│  │
│  ├─ GET /api/tests/{testId}
│  │  ├─ server returns test metadata
│  │  └─ client gets test structure
│  │
│  ├─ GET /api/tests/{testId}/template
│  │  ├─ server returns questions
│  │  └─ client gets answer key
│  │
│  └─ adapter.buildExamConfig()
│     └─ S, SEC, SEC_CFG updated dynamically
│
└─ app.js initializes with dynamic config
   └─ show exam UI
```

---

## 7. State Management Flow

```
┌──────────────────────────────────┐
│   Admin Component State           │
│                                  │
│  SeriesDashboard:                │
│  ├─ series[] = all series        │
│  ├─ loading = bool               │
│  └─ error = string               │
│                                  │
│  SeriesEditor:                   │
│  ├─ formData =                   │
│  │  ├─ title, description        │
│  │  ├─ subjects[]                │
│  │  └─ sections[]                │
│  └─ errors[] = validation        │
│                                  │
│  QuestionEditor:                 │
│  ├─ formData =                   │
│  │  ├─ text, imageUrl            │
│  │  ├─ options[].text            │
│  │  ├─ options[].imageUrl        │
│  │  └─ answer                    │
│  └─ preview = bool               │
│                                  │
└──────────────────────────────────┘
           │
           │ props
           ▼
┌──────────────────────────────────┐
│ TestSeriesManager (Container)    │
│                                  │
│ workspace[] =                    │
│ [                                │
│   { level: "DASHBOARD", ... },   │
│   { level: "SERIES_EDITOR", ... },
│   { level: "QUESTIONS", ... }    │
│ ]                                │
│                                  │
│ currentLevel = workspace[-1]     │
│                                  │
│ pushLevel() → workspace.push()   │
│ popLevel() → workspace.pop()     │
│                                  │
└──────────────────────────────────┘
           │
           │ callbacks
           ▼
┌──────────────────────────────────┐
│   Backend State (server)          │
│                                  │
│  series.json =                   │
│  [{                              │
│    id, title, subjects[],        │
│    sections[]                    │
│  }]                              │
│                                  │
│  tests.json =                    │
│  [{                              │
│    id, seriesId, sections[]      │
│  }]                              │
│                                  │
│  questions.json =                │
│  [{                              │
│    id, text, options[],          │
│    answer, imageUrl              │
│  }]                              │
│                                  │
└──────────────────────────────────┘
           │
           │ API calls
           ▼
┌──────────────────────────────────┐
│   Exam Engine State (app.js)      │
│                                  │
│  EXAM_CONFIG =                   │
│  ├─ subjects                     │
│  ├─ sections                     │
│  ├─ marking                      │
│  └─ rankMapping                  │
│                                  │
│  sess =                          │
│  ├─ cur = { s, sec, i }          │
│  ├─ data = answer data           │
│  └─ meta = session metadata      │
│                                  │
│  userData =                      │
│  ├─ p1_res, p2_res               │
│  └─ scores, rank                 │
│                                  │
└──────────────────────────────────┘
```

---

## 8. Sequence Diagram: Full Test Creation & Taking

```
Timeline: Admin creates series → Student takes exam → Results

T=0:  Admin Portal opened
      │
T=1:  Click "Test Series" tab
      │
T=2:  Create Series: "Physics 2025"
      │  POST /api/series { title, subjects: ["Physics"], sections: [...] }
      │  └─ Returns series-123
      │
T=3:  Click Edit → Configure sections
      │  PUT /api/series/series-123 { ... }
      │
T=4:  Click Tests → New Test
      │  POST /api/tests { seriesId: series-123, title: "Test 1" }
      │  └─ Returns test-456
      │
T=5:  Add Questions to Section A
      │  For each question:
      │  ├─ Upload image: POST /api/uploads → /uploads/q-123.jpg
      │  └─ Create question: POST /api/questions { text, imageUrl, answer, options }
      │
T=10: Admin completes test (5 physics questions added)
      │
T=11: Student navigates to: jee2025/exam/?testId=test-456&seriesId=series-123
      │
T=12: HTML loads, test-series-adapter.initialize()
      │  ├─ GET /api/series/series-123 → Get physics config
      │  ├─ GET /api/tests/test-456 → Get test metadata
      │  └─ GET /api/tests/test-456/template → Get questions
      │
T=13: Exam engine initializes
      │  ├─ S = ["Physics"]
      │  ├─ SEC = ["A", "B", "C"]
      │  ├─ SEC_CFG = { A: [...], B: [...], C: [...] }
      │  └─ Storage keys = test_series_test-456_*
      │
T=14: Show instructions modal
      │
T=15: Student clicks "Start Exam"
      │  └─ Start timer, show first question
      │
T=16: Student answers questions (2-15 min exam)
      │  ├─ Answer 1: Physics-A-0 → "A"
      │  ├─ Answer 2: Physics-A-1 → "B"
      │  ├─ Answer 3: Physics-B-0 → "BC"
      │  ├─ Answer 4: Physics-C-0 → "5.5"
      │  └─ Answer 5: Physics-C-1 → Skip
      │  All auto-saved to localStorage
      │
T=17: Student clicks "Submit" (exam ends)
      │
T=18: calculateResults()
      │  ├─ Load answers from localStorage
      │  ├─ Load answerKey from adapter
      │  ├─ For each answer:
      │  │  ├─ Get marking from adapter.getMarking(section)
      │  │  ├─ Compare with correct answer
      │  │  └─ Add to score
      │  ├─ Physics Section A: 2 correct × 3 = 6 points
      │  ├─ Physics Section B: 1 correct × 4 = 4 points
      │  ├─ Physics Section C: 0.5 correct × 4 = 2 points
      │  ├─ Total: 12 points
      │  └─ Rank: Calculate using rankMapping
      │
T=19: Show results page
      │  ├─ Total Score: 12
      │  ├─ Subject Breakdown: Physics = 12
      │  ├─ Section Breakdown: A=6, B=4, C=2
      │  ├─ Correct/Wrong/Skipped: 4/0/1
      │  └─ Estimated Rank: [Based on rankMapping]
      │
T=20: Student clicks "Review" mode
      │  └─ Can review all questions and correct answers
      │
Done.
```

---

This architecture ensures:
- ✅ Admin has complete control over test creation
- ✅ System is flexible (any subjects, sections, marking)
- ✅ Exam engine remains unchanged but uses dynamic config
- ✅ Students get accurate results with series-specific marking
- ✅ All data persisted and recoverable
- ✅ Backward compatible with JEE 2025 defaults
