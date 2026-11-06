# Impulse content, storage, and performance plan

**Scope:** Review and staged optimization plan only. No application code or database was changed for this plan.

## Executive summary

The largest avoidable cost is not the 100 KB of SVGs per paper. It is the way the app reads and stores content:

1. A public question request currently reads and returns the complete question library.
2. The library is a single JSON document in `admin_content`; every public API read fetches that whole document from Supabase before returning it.
3. Each `useQuestions()` instance makes its own request. The dashboard mounts at least two such instances.
4. Imported papers for JEE Main, NEET, and MHT-CET put the question bank in `admin-state.json` and also copy question content into the dynamic test in `tests.json`.
5. Student study history is stored locally as growing arrays; before the custom-session checkpoint change, custom-test sessions could sync as full question-filled snapshots every second; and the legacy engine saves copies in IndexedDB/localStorage without an observed completed-session cleanup call.

These are fixable without changing how a student uses the site. The recommended destination is **one canonical, searchable question record per question; tests refer to question IDs; users load only the paper/questions they need; attempts append as compact rows; and static app routes load on demand.**

Storage estimates below are planning scenarios, not measurements of the hosted Supabase project or a concurrency guarantee.
No live Supabase/Render metrics or affected-browser storage measurements were available in this review; collect those before treating the estimates as forecasts.

**Speed expectation:** this plan can remove avoidable waiting, downloads, JSON parsing, and repeated writes, but “extremely fast” cannot be promised without measuring the deployed API, database, network, and devices. The safe goal is a much faster first usable screen and paper start, with content loaded progressively and no loss of current study/review/resume features.

## What the current code does

| Area | Current behavior | Cost or risk |
|---|---|---|
| Public question library | `GET /api/questions` supports filters and pagination; identical pages are cached briefly in the browser and in each API process. On an API page-cache miss, it still reads/clones the complete `admin-state.json` before filtering. The unfiltered endpoint still returns the complete question list. | Cache hits avoid repeat requests or API filtering/state reads; cache misses still touch the monolithic document, which remains the main scaling bottleneck. |
| Duplicate requests | `useQuestions()` fetches on each hook mount; it is not backed by a shared provider or query cache. It is used in multiple pages/components. The dashboard uses it through both `useMetrics()` and `ActivityCalendar`. | A single route can fetch the same large library more than once. |
| Imported papers | The admin paper import saves questions to the main admin state and builds a dynamic test containing question objects. | A paper can be stored twice in database JSON documents, increasing database size and reads. |
| Admin library | The portal reads and saves the full `admin-state.json` document. A content edit/import rewrites the document. | Importing one paper or deleting one question scales with the whole library, not the change. |
| Test catalogue | `GET /api/tests` reads the whole test document before filtering public summaries. | Supabase → Render still reads the full test JSON on catalogue requests. |
| Student progress | `user_data` stores JSON values keyed by user and browser-storage key. Solved attempts are accumulated in one array; updates upsert the growing array. | Final stored size may be modest, but repeated full-array writes waste bandwidth and database work. |
| Custom-test results | The last 50 results are retained. Results include question data, answers, and scoring rather than only references and answers. | The same long question/explanation text is duplicated in the user's saved data. |
| Images | Image files go to the `admin-uploads` Supabase Storage bucket; questions keep image URLs. | Uses the separate file-storage quota. Fetching images uses egress. |
| Browser loading | Application routes are imported eagerly. The recent production build emitted a 1.74 MB JavaScript bundle (about 502 KB gzip). Signed-in rendering waits for profile and initial user-data sync. | Unrelated pages/code add to first-load download; a slow sync can hold up the whole app. |

Relevant implementation: [question hook](./web/src/hooks/useQuestions.js), [admin portal state](./web/src/lib/adminPortal.js), [API routes](./server/index.js), [persistent JSON storage](./server/persistence.js), [paper import](./web/src/pages/AdminPortalPage.jsx), [student sync](./web/src/lib/userDataSync.js), [custom-test result saving](./web/src/pages/CustomTestExamPage.jsx), and [route setup](./web/src/App.jsx).

## Findings from the deeper re-check

The original direction is sound, but it missed several important paths and the first capacity estimates should be treated as especially rough:

- **Dashboard question-body downloads have been removed.** `useMetrics()` and `ActivityCalendar` now use exam/subject/chapter/difficulty on solved-attempt records; legacy records missing classification use a compact ID-based metadata endpoint. This avoids downloading question text, options, images, and solutions for the dashboard. The API builds and reuses a short-lived question-ID metadata index and chapter catalogs; fresh cache hits now serve without reading the full state document, and question saves invalidate both. Cache misses still read the monolithic state, so this is not the normalized-database fix.
- **Cold metadata requests share one question-ID index even for different requested ID batches; identical chapter-catalog requests are also coalesced.** Concurrent requests share the same question-state load and derived index/catalog build; failures are retryable, and question-library saves prevent stale in-flight work from repopulating either cache.
- **The custom-test builder's aggregate catalog is cached and coalesced server-side.** Repeated catalog visits avoid rereading `admin-state.json` for 15 seconds; simultaneous cold requests share one load/build, and question saves invalidate both cached and in-flight results.
- **Repeated public question-page filtering is cached in the API process.** Identical filtered/paginated requests reuse a short-lived, size-bounded result and skip reading/cloning the full admin state on a server cache hit. Successful question saves invalidate these results. This reduces repeated API work, but only within one running API instance and cache window; the monolithic document remains the source of truth.
- **Concurrent identical public question-page cache misses now share one load/filter operation.** The API coalesces requests by normalized filters and page, preserves cache invalidation when the question library is saved, and clears failed in-flight work so it can be retried.
- **Question filtering now uses sets for multi-value criteria.** This avoids repeatedly scanning each filter-value list for every question while preserving exact trimming and matching behavior.
- **Filtered question pagination now counts and collects the requested page in one pass.** It avoids allocating the full matching-question array before slicing the page; response order, totals, and `hasMore` remain unchanged.
- **Custom-test sampling now groups eligible questions by chapter and difficulty in one scan.** It avoids rebuilding difficulty pools and repeatedly searching the selected chapter pool by ID, while preserving the existing mix, fallback, randomization, and question ordering rules.
- **Multi-subject custom-test requests now partition the question bank in one scan.** Each subject still applies the existing year/chapter/difficulty selection and shared random stream, but no longer scans the complete question bank separately.
- **The `useQuestions()` hook now memoizes its filtered result.** Unrelated rerenders no longer re-filter the full in-memory question bank when neither questions nor filters changed.
- **Public test-series catalog responses are cached in the API process.** Repeated public catalog requests reuse the generated safe summaries instead of rereading/cloning both persisted documents and rebuilding the result. Successful series or test writes invalidate this cache. It is per process and short-lived; paid test launch/detail responses are not stored in it.
- **Selected public test-summary and catalog requests coalesce concurrent cache misses.** Simultaneous requests for the same public listing page or published test metadata share one JSON-document read/summary build, then reuse the bounded short-lived cache. Paginated catalog requests calculate totals from matching records but build response summaries only for the current page. Writes invalidate cached and in-flight values. Full test-launch and paid-content paths remain uncached and continue to check authorization.
- **The public `/api/tests` summary list now uses that same cache.** Repeated public catalogue requests reuse safe summaries rather than rereading `tests.json`; admin requests still read the full document and are never served from the public cache. Successful test writes invalidate both catalogue caches.
- **Repeated dashboard question searches have been removed.** New attempts record their classification metadata at creation. Legacy metadata is fetched in batches and shared briefly in the browser; the dashboard no longer calls `questions.find(...)` for each attempt or loads the full question bank.
- **There are more full-document readers.** `/api/quiz/catalog` and quiz challenge creation now avoid `admin-state.json` reads on valid 15-second derived-index cache hits and coalesce concurrent cold-index loads; they still read the full state on a cache miss. Per-test template/detail routes still read the entire `tests.json` before selecting one record. The public test catalogue strips answers and question text from its response, which is good for exposure, but it does not prevent the full document being fetched from Supabase into the API on cache misses.
- **Imported dynamic papers really do copy question bodies.** `buildDynamicPaperSections()` copies text, image URLs, options, answer, solution, and explanation into each section. This is a second copy, although its exact size is not necessarily equal to the full admin question record.
- **The sync layer captures much more than the solved-attempt array.** It syncs custom-test results, analytics, preferences, test-series state/session keys, exam-session chunks/checkpoints, and legacy exam data. Some of these are valuable for cross-device resume; others may duplicate or represent temporary state. Login downloads all `user_data` rows, merges locally, and may write merged full values back. Saves are debounced for 350 ms but serialized one key at a time; large keys are still sent as complete snapshots.
- **Custom-test session sync is now separated from question content.** The active question snapshot is stored once in `custom_test_session_questions`; the separate `custom_test_sessions` row stores metadata and compact answers/time/navigation progress. Progress is checkpointed at most once per 90 seconds while active, immediately before leaving the test, when the page becomes hidden, and when connectivity returns. Local answer/bookmark/navigation changes persist immediately, and elapsed time is checkpointed locally every 30 seconds. On submit, the question snapshot is removed and a small completed marker remains. The legacy `user_data` session value is migrated the next time a signed-in user opens Custom Tests.
- **The legacy test-series engine also checkpoints full sessions.** Its timer calls `saveSess()` every 15 seconds, and navigation/answer events save again. Those `jee_adv_2025_*` and `test_series_*_sess_v1` keys are cloud-synced snapshots. They are less frequent than the custom-test timer, but remain another avoidable full-session upload path.
- **The exam engine preloads question images for the whole active paper.** `preloadExamImages()` creates an `Image` for every question-level image in the loaded session before the exam proceeds; option images are separately rendered with `loading="lazy"`. Those images are requested through normal image URLs, so the browser's HTTP cache—not the app's `ExamEngineDB`—controls whether downloaded image bytes remain cached. The exam session itself stores question data and image URLs in IndexedDB or a localStorage fallback, not necessarily image bytes. The exact browser disk/cache footprint depends on image sizes and response headers and has not been measured.
- **The screenshot warning is not proof that the image cache is full.** The legacy `checkStorageQuota()` writes a temporary ~1 MB string to `localStorage`; on failure it shows the warning text in the screenshot. That test only establishes that this localStorage write failed (for example quota, disabled storage, or browser privacy settings); it does not identify which key or storage type consumed space. Large exam/session snapshots or other app localStorage keys are plausible causes. Do not instruct users to clear all browser cache as the only remedy.
- **Custom-test history keeps question snapshots.** `calculateCustomTestResults()` includes the complete `question` in every `questionResults` entry. The 50-result cap bounds the count, but not the bytes per result; both the local result and its synced cloud value contain the copies.
- **Caching needs to be layered correctly.** The question client explicitly uses `cache: 'no-store'`, and the API response sets only a content type (no cache validator/compression header). Adding a browser `ETag` alone would reduce API-to-browser transfer but would still call the API; with the current persistence helper, the API would still fetch the complete JSON document from Supabase. Use server-side/content-version caching with explicit invalidation, and remove the monolithic read at the structural migration.
- **Initial account-data reconciliation gates the app; write-back now continues in the background.** `AppContent` waits until cloud data has been read and reconciled with this browser's data, then allows the app to render while merged changes upload. The cloud read and profile lookup still gate the first authenticated screen; removing those waits needs account-scoped snapshots and more extensive isolation work.
- **There are important data-retention semantics.** Exact custom-test review currently works because saved results carry question snapshots. If results store IDs only, the referenced question/version must remain retrievable when an admin edits or deletes the live question. Keep an immutable question version or a minimal review snapshot; do not silently break old results.

The main code references are [metrics](./web/src/hooks/useMetrics.js), [calendar](./web/src/components/ActivityCalender.jsx), [home page](./web/src/pages/HomePage.jsx), [auth and sync gating](./web/src/contexts/AuthContext.jsx), [attempt creation](./web/src/lib/solvedQuestions.js), [custom-test result shape](./web/src/lib/customTest.js), [paper-to-test copying](./web/src/admin/PYQImport/paperImportFormat.js), [legacy session storage](./jee2025/assets/js/storage-manager.js), [session integration](./jee2025/assets/js/precision-integration.js), and [exam image preload](./jee2025/assets/js/app.js).

### Browser storage and exam-image lifecycle

The user-reported “storage fills after 3–4 papers” is a real issue to investigate, but the currently visible warning is specifically emitted after a ~1 MB `localStorage` probe fails. It is not a measurement of total browser storage and does not prove that cached images are the cause. The likely contributors need to be measured separately:

1. **Exam images in normal browser HTTP cache:** the engine preloads all question-level images for a loaded exam; browser caching policy comes from the response headers and browser eviction. The app cannot reliably delete arbitrary browser HTTP-cache entries on exam exit.
2. **Saved exam session in IndexedDB/localStorage:** exam session data includes question text, image URLs, options, answers, and potentially large question structures. The localStorage fallback chunks sessions up to a browser quota; checkpoints and analytics may add more records. Session data may persist after the exam, depending on its lifecycle.
3. **Remote question/test snapshots:** loaded exam data may be fetched and then saved into local state; this can duplicate question bodies even though it stores only image URLs, not downloaded image bytes.

Recommended behavior that preserves user experience:

- Do **not** preload every image in a paper. Lazy-load the current question and, at most, the next likely question with a small concurrency limit. Keep image placeholders and retry/error display so slow connections remain usable.
- Keep question image URLs and question IDs in the active session; do not turn image responses into base64/data URLs or persist image blobs with answer/session data.
- For in-progress sessions, persist only answers, current position, timers/timestamps, and references to an immutable test/question version. Preserve enough state for the promised resume/recovery behavior. On successful submit/exit, remove only that active session's temporary content and checkpoints; keep compact results/analytics so review remains available.
- For attempt analysis, load that attempt's referenced question version and images on demand. Do not keep all prior papers' image bodies in IndexedDB or localStorage merely to render the history list.
- For the requested per-attempt lifecycle, fetch only the visible/near-next image with `fetch(..., { cache: 'no-store' })`, render it from a Blob object URL, and revoke that URL and abort outstanding image requests at attempt exit; review fetches it again on demand. Check cross-origin fetch support for the image host. This avoids intentionally putting full-paper images into the normal HTTP cache or app-persistent storage. It can cost a refetch on a later entry, so keep concurrency low and show the question text immediately. Do not use a normal `<img src>` cache path for these exam images if the requirement is no reuse between attempts.
- Browsers do not promise physical disk erasure of transient buffers. If the test shows normal HTTP image caching remains despite the intended fetch policy, use a small controlled session cache/proxy, with explicit per-attempt cleanup, and test it across browsers. Never delete unrelated browser or app caches.
- Instrument real browsers with `navigator.storage.estimate()` and quota/error logs before/after a representative paper; report localStorage bytes per key, IndexedDB store bytes/record counts, app-managed Cache Storage names/bytes, image count/transfer bytes, and exact failing operation. Do not collect question answers or image content in telemetry.
- Replace the misleading blanket warning with an actionable storage-full message that distinguishes localStorage, IndexedDB, and disabled/private storage. Tell the student whether current answers were saved, offer a retry/export/recovery action where feasible, and never silently delete unsent answers or a resumable session.

The best default for this project is **load just-in-time, hold image bytes only in memory for the active attempt, revoke their object URLs on exit, and re-fetch during review**. Keep answer/session state separate from image bytes. This meets the requested app-level lifecycle without pretending JavaScript can securely erase every browser disk block.

One additional lifecycle finding: the legacy engine's `StorageManager.clearSession(sessionId)` removes its IndexedDB session and checkpoints (and localStorage fallback chunks), but a call to that method was not found in the active JEE 2025 engine flow. Meanwhile, precision integration saves session copies into IndexedDB and localStorage and can create checkpoints; the defined checkpoint cleanup helper was also not found in the active flow. This makes stale app-managed session data a concrete cleanup candidate, separate from ordinary browser HTTP image cache. Cleanup must happen only after a result is durably recorded and the user no longer needs resume; retain compact result/review data and never delete another paper/account's active session.

## End-to-end dataflow re-check

| User journey | Current request/storage path | Main avoidable work | UX-safe target |
|---|---|---|---|
| Sign-in and open app | Supabase session lookup; profile query; `user_data` query selects every key/value for that user; browser merges each remote value with localStorage; differences can be written back one key at a time; app shell waits while profile or sync is loading. | Large history/session snapshots extend a blocking startup path; full values are read/written even when a page needs only a small portion. | Keep auth/profile correctness and account isolation. Load a small versioned local snapshot for the first screen, reconcile in background, and gate only features that require data not yet reconciled. Use per-key/feature fetches or partition durable history from temporary session state. |
| Home/dashboard | Uses saved attempt metadata; legacy attempts use compact classification lookups. | No full question-bank download for stats/calendar; compact legacy lookup still reads the monolithic state on a cache miss. | Normalize question storage separately; keep dashboard request body-free. |
| Practice/custom-test builder | Loads a compact aggregate catalog (exam, subject, chapter, year counts and question types); the server applies existing selection rules and returns full records only for the chosen test. Custom-test aggregate catalog responses are cached/coalesced by the API for 15 seconds; PYQ chapter/year catalogs are cached in the browser for 30 seconds and on the API for 15 seconds per exam/subject; identical question pages are cached/coalesced in the browser for 15 seconds. Caches are invalidated after admin question saves. | Avoids transferring or parsing per-question metadata and content for the unselected bank; returning to the same catalog/question page during its cache window avoids repeated requests and full-state reads on server cache hits. Monolithic reads remain when caches miss. | Move selection to indexed server queries after content normalization; preserve subject/year/chapter/difficulty rules and keep selected-body responses bounded. |
| Quiz challenge setup | Caches the aggregate subject/chapter catalog in the browser for 60 seconds, coalesces concurrent loads, and invalidates after a successful admin question-library save. The API reuses its derived catalog and normalized playable questions indexed by subject/chapter for 15 seconds; cache hits serve from the derived index without rereading admin state, and concurrent cold catalog/challenge requests share one load/index build. Admin-state saves invalidate the cache; failed cold loads can be retried. | Returning to quiz setup avoids another browser request during the client TTL; repeated catalog and challenge requests avoid both monolithic state reads and rescanning/re-normalizing playable questions during the server TTL. Concurrent cold requests no longer duplicate that work. Cache misses still read monolithic state. | Move quiz-question lookup to indexed database queries after normalization. |
| Previous-paper/test-series catalogue | Public listings request summaries filtered to test-series or previous-paper content; the previous-paper route filters by exam. Test summaries contain aggregate counts/subjects and publication metadata, not per-section detail, question bodies, or answers. Test cards are grouped once by series. Filtered catalogs, targeted test summaries, and the published-series list are coalesced and cached client-side for 30 seconds; successful admin series/test writes invalidate them. | Smaller response and less client work with larger libraries; returning to a listing, test details, or the billing series selector during the TTL avoids a repeat request. The server still reads/decodes monolithic documents on cache misses. The test-series listing still checks prices/access per series. | Paginate large list catalogs, aggregate entitlement checks while preserving access rules, and fetch an authorized test body only after selection. |
| Launch/resume an engine test | The served adapter and branding bootstrap now share one authorized launch request containing the public series summary and full selected test/template; the backend verifies published series/test and entitlement. The engine maps questions into its session shape, preloads question images, and persists session/checkpoints. | Removes duplicate browser round trips and repeated entitlement checks; it does not yet remove monolithic storage reads or question-body mapping, whole-paper image preload, and session snapshots. | After indexed/versioned storage, keep a single authorized launch payload; render first question promptly, lazy-load images, and compact local checkpoints. Preserve resume and test integrity. |
| Attempt/result/review | Attempts append locally to a growing `impulse_solved` array and are synced as a whole value; custom result rows carry full question snapshots; old engine stores full session and analytics in IndexedDB/localStorage and sync keys. | Growing full-history upserts, duplicated review content, persistent session/checkpoint copies. | Append idempotent attempt batches, keep compact review metadata and stable question versions; delete only completed active-session/checkpoint records after durable save; load question details/images on review entry. |
| Admin edit/import/delete | Admin reads full portal state; changes write the full state document. Paper import also creates a dynamic test with copied question content. | Whole-library read/write and duplicated import content; cost grows with total bank size. | Paginated search plus per-question/paper mutations; atomic import of canonical questions and references; retain export, audit trail, and rollback. |
| Image delivery | Imported image files go to a public Supabase Storage bucket with unique object names; public URLs are placed in content/test records; exam code explicitly preloads all question-level images. | Transfers images even when not yet viewed; prior HTTP-cache entries cannot be reliably deleted on page exit; public bucket and API body cache rules need to match content entitlement. | Public immutable PYQ assets can use versioned URLs and bounded/long-lived CDN caching. Paid/private assets need an entitlement-aware delivery policy. Lazy-load current/near-next image only; don't persist image bytes in session data; review fetches images on demand. |

This is one Supabase project serving several distinct workloads—not a recommendation to create multiple databases. The efficient design is to separate tables/retention/access policies inside the project (published content, paid test versions, profiles/preferences, durable attempts/results, temporary sessions), keeping admin/service credentials server-side. Separate storage buckets or policies may be needed for public PYQ images versus paid/private assets.

## Re-verified optimization order for speed and UX

The prior plan was directionally correct, but the code-flow check changes the execution order. Optimize the largest hot paths before spending effort on schema normalization:

1. **Completed: reduce custom-test session work and cloud payloads.** The timer accumulates per-question time in memory; local answer/bookmark/navigation changes persist immediately, with a 30-second timer checkpoint. The full question snapshot is uploaded once to its own table; only compact progress is written at most every 90 seconds, with a flush on exit/page hide/reconnect. RLS and user-scoped queries isolate sessions; legacy snapshots migrate on read. Cloud recovery still depends on connectivity, while local progress continues to save.
2. **Completed: clean app-owned exam storage after a successful result save.** Submission stops the active timers, and late timer-worker messages are ignored. The active exam flow invokes `StorageManager.clearSession()` only when result persistence succeeds. The loaded manager serializes cleanup behind pending session and checkpoint writes, then removes the matching IndexedDB session/checkpoints plus localStorage session/chunk/checkpoint backups. Result/review data and unrelated sessions remain intact; cleanup failures are logged without discarding the saved result.
3. **Deferred: fix paper image loading.** The current whole-paper image preload is intentionally unchanged per the user's instruction. If revisited, replace `preloadExamImages()` only with explicit approval; preserve test behavior and provide current/near-next loading, reserved image space, and retry/placeholder behavior.
4. **Completed: remove full questions from the home/dashboard critical path.** New attempts save exam/subject/chapter/difficulty metadata; legacy attempts use a compact metadata-only lookup by ID. The dashboard/calendar no longer load question bodies or repeatedly scan the question bank. Normalizing the server-side document remains a separate future step.
5. **Partially completed: remove the post-merge write-back barrier.** The app waits for remote read and local/cloud reconciliation, then displays the reconciled user's data while merged writes finish in the background. Profile/cloud reads still gate. Removing those waits requires account-scoped snapshots and further isolation tests; never flash prior-account data or overwrite cloud data from an unverified stale snapshot.
6. **Partially completed: reduce redundant catalogue/content downloads and lazy-load route code.** PYQ Practice is paginated, dashboard views use attempt metadata, custom-test builder uses aggregate metadata/server selection, quiz setup caches its aggregate catalog briefly, public listings use filtered summary requests with short client/server caches, and test-details pages fetch one summary pair. The public `/api/tests` list reuses bounded safe summaries; admin and authorized test-content reads remain uncached. Exam launch reuses one authorized payload. Route pages load on demand. Quiz challenge countdown rendering now updates every 1.5 seconds to reduce render frequency. Public test-series listings fetch 18 summaries per page and append on request, preserving total counts; paid-series entitlements are checked in one authenticated batch request (two bounded Supabase reads rather than one API request per series). The browser summary cache is bounded to 50 entries, uses isolated copies, and expires entries after 30 seconds. Remaining work includes indexed question storage and validating paging behavior at larger catalog sizes; paging reduces response/UI payload but does not remove the API's full JSON document reads.
7. **Implemented, migration not yet applied: normalize question storage.** The additive migration backfills current question versions, verifies them, then removes the duplicate question list from `admin_content`. The transactional RPC keeps subsequent admin saves in sync while storing only non-question admin state in that document; the API hydrates the admin state from current version rows. Question pages and metadata/catalog/selection reads use normalized rows when `SUPABASE_NORMALIZED_QUESTIONS=true`. This avoids storing two copies of the live question bank, but row/index overhead and retained history can offset the space saved, so measure actual Supabase usage rather than assuming a net reduction. Do not enable the flag until the migration is applied and checked against hosted content.
8. **Implemented, migration not yet applied: compact duplicate test solution fields.** Test records no longer persist `explanation` a second time when it exactly matches `solution`; the API reconstructs that alias when returning tests, preserving the existing client response shape. A one-time SQL migration compacts existing hosted tests, and future API writes compact automatically. On the local sample, this removes about 200 KiB from the uncompressed JSON representation across 300 matching question records; PostgreSQL's actual space savings need to be measured after migration. Test snapshots with distinct values remain unchanged.
9. **Finally tune retention and scale.** Keep durable exact data if promised, or seek explicit approval for archival/summarization. Load-test staging and size Render/Supabase from measured percentiles and actual user concurrency.

### User-experience safeguards and speed targets

- **Don't block first paint on optional work:** show app chrome and critical route content before charts, full history, unrelated question content, and nonvisible images. Auth and account isolation remain blocking security/correctness gates.
- **Don't change what a test means:** same question selection constraints, order, marking scheme, timer, bookmarks, resume behavior, result score, and review questions must pass parity tests.
- **Don't create one request per question:** for a full 75-question timed paper, fetch the selected paper's text/answer key in one authorized, versioned payload (or a small number of chunks only if measured payload size requires it); defer image bytes. For practice browsing, use paged/targeted reads. A timed paper must not wait on dozens of serial round trips.
- **Don't trade speed for data loss:** answer changes are persisted locally before acknowledgment; cloud batches have stable IDs, safe retries, visible error/retry state, and a recovery path.
- **Keep content versioned:** submitted attempts refer to the exact question/test version used. Admin edits/deletes must not break review of a prior attempt.
- **Optimize latency paths, not just SQL:** measure first contentful paint/first usable dashboard, click-to-first-question, image-visible time, and successful resume under a cold cache and slow mobile network.
- **Set numeric targets from a baseline:** record p50/p95 for sign-in-to-dashboard, dashboard usable, catalogue, launch-to-first-question, and image display; then target material improvement (for example 30–50% lower p95) with no regression in errors/data loss. Don't claim a fixed "instant" time until measured on representative devices and region/network.
- **Separate cache types in telemetry:** distinguish transferred bytes and browser HTTP-cache behavior from `localStorage`, IndexedDB, Cache Storage, and Supabase DB/storage/egress. Storage quota estimates are best-effort; do not infer image-cache size from a failed localStorage probe.

## Baseline measurements and assumptions

The checked-out workspace contains about **1.43 MiB** of local server JSON (not a reading of the hosted database) and about **6.9 MB** of local upload files. The local sample question data averages about **2.8 KB per question** after compact JSON serialization; real paper questions can be larger, especially with long solutions. A solved-attempt example serializes to about **145 bytes** before PostgreSQL/JSONB overhead.

For the requested paper scenario, assume:

- 75 questions per paper.
- About 1 KB of JSON per question: **75 KB per paper**.
- All SVGs in a paper together: **100 KB per paper**.
- 500 papers.
- When imported as a dynamic previous paper, question content is also included in the test document.

Approximate paper-bank totals:

- Main question bank: 500 × 75 KB = **37.5 MB** raw JSON.
- Dynamic test copies: up to another **37.5 MB** raw JSON.
- Combined database content: about **75 MB**, before JSONB/table/index/metadata overhead and other app/user data.
- Supabase Storage images: 500 × 100 KB = **50 MB**.

The database estimate assumes the 1 KB figure includes all question fields. It is not a guaranteed on-disk size. If question records average 2.8 KB like the local sample, the two copies could instead approach **210 MB** raw. Do not use the code checkout's files as the source of truth for live usage.

## Current versus optimized: capacity scenarios

Supabase's pricing page currently lists Free allowances of **500 MB database, 1 GB file storage, and 5 GB egress**. Egress is data transferred out; it is not stored space and does not reset database contents. Quotas/prices can change; confirm them in the project dashboard and [current Supabase pricing](https://supabase.com/pricing).

### Current implementation, heavy monthly student

Assume a student solves 6,000 questions/month and takes 60 custom tests/month, each with 60 questions. The app retains the latest 50 results:

- Attempts: 6,000 × 145 bytes ≈ **0.87 MB** final raw attempt history per student-month.
- Results using the local 2.8 KB/question estimate: 50 × 60 × 2.8 KB ≈ **8.4 MB** per student for the retained results.
- Combined: about **9.3 MB per heavy student** in a first-month snapshot, before actual database overhead.
- With the 75 MB raw duplicate paper-bank assumption, a 500 MB database leaves at most about 425 MB for students and everything else: around **45 students** at this usage level in the simple first-month arithmetic.
- If attempts accumulate for 12 months and 50 results remain stored, the raw estimate grows to about 18.8 MB/student: around **22 students** on the same remaining-capacity assumption.

If actual questions in saved results are closer to 1 KB each, results are around 3 MB/student, giving roughly 100 students for a first-month snapshot. The difference shows why this range cannot be made precise without measuring real saved rows and live usage.

There is also a **write-amplification** issue: if each of 6,000 attempt updates syncs the whole growing attempt array, cumulative upload payload can be around 2.6 GB for that student's month (145 bytes × 1+2+…+6,000), excluding HTTP overhead. Debouncing combines closely spaced changes, so this is an upper-style model, not an observed bill. This is **outbound request data from the app to Supabase**, not Supabase egress. Other synced keys—especially test sessions/results—add to it.

### Egress if the current full-library request remains

With 500 papers, the main JSON library is approximately 37.5 MB under the 1 KB assumption. A single full-library response therefore costs roughly that much Supabase-to-API transfer, before other requests and possible compression. A 5 GB allowance divided by 37.5 MB is only about **130 full-library reads/month**. This is a count of full reads, **not students**: repeated visits and duplicate hook requests consume more; smaller payloads or caching consume less.

The test catalogue adds another problem: even if its browser response is a summary, the API currently reads the full `tests.json` document from Supabase before filtering it. Cloudflare Pages hosting the frontend does not automatically cache requests sent directly to the Render API.

### Optimized, preserving exact attempt history

With question content stored once, tests storing question/version IDs, test results storing answers/review state rather than full question objects, and attempts stored as append-only compact rows:

- The 500-paper question catalog is approximately **37.5 MB raw once**, plus relational indexes/metadata; tests no longer duplicate that question content.
- A 50-result history with 60 answers per test might be roughly **0.2–0.5 MB/student**, depending on answer/review fields and whether compact question-version snapshots are needed.
- Individual attempt rows may occupy roughly **100–250 bytes each including a lean index allowance**: 6,000/month becomes about **0.6–1.5 MB/student-month**. This is a planning interval, not a measured Postgres row size; actual table, index, TOAST, and backup effects must be measured after migration.
- On the Free 500 MB database, after reserving about 40–60 MB for question content and overhead, a rough first-month capacity could be **about 290–750 heavy users** by storage arithmetic. This is not a performance or safe-launch promise.
- If all detailed attempts are retained for 12 months, the same storage-only estimate is roughly **25–60 heavy users** on Free, because 7,200–18,000 KB/year per student accumulates. Keeping every attempt forever cannot have a fixed user capacity on a finite plan.
- If exact attempt details are retained for 90 days and older history is aggregated by user/day/question while preserving calendar and summary statistics, roughly **100–250 heavy users** may fit by storage arithmetic. This changes how far back a student can inspect each individual attempt; make that retention choice explicit before implementation.
- A Pro plan currently lists **8 GB included database disk**—about 16 times 500 MB—and correspondingly more egress/storage. That could raise storage-only limits by roughly the same order, but the live app's actual database footprint and paid plan limits must be checked before upgrading.

**Do not interpret these numbers as concurrent users.** A database can have enough disk for hundreds of accounts while a free API instance still becomes slow under a smaller burst. Concurrency requires a staged load test after the request pattern is improved.

### What 20,000 heavy monthly users mean for 28 GB

If 20,000 students each generate 6,000 attempts every month, the optimized attempt-only estimate is **12–30 GB per month** (20,000 × 0.6–1.5 MB), before shared content, retained test results, other user data, and operational headroom. The 28 GB total would therefore hold only about **one to two months** of that usage, not two years. Over 24 months, attempts alone are approximately **288–720 GB** under the same assumptions; compact retained test results could add several more GB.

To keep 24 months of exact history inside 28 GB for 20,000 equally heavy students, the total budget is only about **58 KB/student/month** before overhead and shared data—less than 10 bytes per attempt at 6,000 attempts. That is not realistic for an indexed relational attempt row. The real levers are lower average usage, substantially more storage, or a product-approved retention/archive design. “20,000 MAU included” is an auth/billing allowance; it does not mean 20,000 heavy users' histories fit on disk or that 20,000 can be online simultaneously.

## Recommended destination design

1. **Canonical question records:** one row per question/version in a `questions` table. Include stable ID, paper/import ID, exam, year, shift, subject, chapter, difficulty, type, question/options/answer/solution, image URLs, published status, and timestamps. Preserve prior versions needed by saved test results.
2. **Paper metadata:** one `papers` row per imported paper with its exam/year/shift, publication state, and question count. Add indexes for the common filters (`exam/year/shift/subject/chapter`, plus published status). Avoid large JSON-array scans.
3. **Tests refer to IDs:** a test/section stores ordered question IDs and scoring rules, not a second copy of question text. Fetch question bodies only when a permitted test is opened. Preserve server-side purchase/session authorization for paid series; never make paid test bodies publicly selectable.
4. **Read only what's needed:** catalogue request returns paper metadata/counts; paper request returns one paper or 20–50 question rows at a time; question practice requests only the chosen filtered set. The custom-test builder preserves its subject/year/chapter/difficulty mix using aggregate metadata and server-side sampling, then returns selected bodies only. After normalization, move sampling to indexed server queries; avoid sorting a huge table by random on every request. Preload the next page/question in the background. Select only required columns.
5. **Public read policy:** if ordinary published PYQs are intentionally public, allow read-only access to published rows through a carefully tested RLS policy, or keep the read behind the API. Admin writes remain authenticated and server-controlled. Private paid content uses the existing authorization path.
6. **Admin writes are incremental:** import a paper in a validated batch/transaction; edit/delete specific question IDs; list questions with server-side search and pagination. Avoid downloading/replacing the entire bank for one edit. Keep a backup/export path.
7. **Append-only study attempts:** store one row per attempt with user ID, question/version ID, correctness, time, timestamp, and the small descriptive fields needed for calendar/analytics (exam, subject, chapter, difficulty). This keeps dashboards independent of question bodies and preserves useful labels after content changes. Use an attempt ID for idempotent retry and only necessary indexes. Batch inserts (for example 10–50 attempts) and retry safely; do not upsert a growing full-history JSON array after every answer.
8. **Compact test results and sessions:** save test ID/version, selected question/version IDs, answers, score, times, review/bookmark state, and submit time. Keep in-progress test sessions resumable across devices, but store answers/current position/timers rather than another copy of full question content. Compute the visible timer from timestamps instead of changing/persisting the whole session every second; record time spent when leaving a question and checkpoint progress periodically and after meaningful answer/navigation changes. Expire submitted/abandoned session snapshots and temporary image/session caches under a stated policy. Reuse immutable question versions for review and fetch their images on demand; define an explicit long-term attempt/archive policy before removing current fields.
9. **Images stay in object storage:** keep SVGs in Supabase Storage or another object store, not in table rows. Retain the current file-size/MIME validation and safe SVG handling. Reuse image URLs and avoid uploading duplicate images.
10. **Cache public content carefully:** share a client-side query cache across pages, deduplicate concurrent requests, and invalidate after admin changes. For public published content, cache by immutable content version and invalidate by publishing a new version. ETag/browser caching helps only the API-to-browser hop unless the API also avoids rereading Supabase. Never CDN-cache personalized user data, unpublished content, admin responses, or paid test bodies.
11. **Classify cloud-synced keys:** keep cross-device durable study data; make purely local display preferences local-only unless users explicitly need them synced; migrate/remove obsolete legacy analytics keys; and give temporary sessions/checkpoints clear expiry and size limits. Preserve cross-device resume where it is a feature, but avoid syncing duplicate question bodies. Prioritize stopping the one-second custom-test snapshot writes, then reduce legacy test-engine checkpoints to meaningful changes plus a bounded periodic checkpoint.
12. **Use summaries only as a deliberate retention choice:** if exact attempt history must remain available, retain it in a properly sized database or archive and query it on demand. If older attempts are summarized, preserve the exact calendar/analytics contract the product promises and tell users what historical detail remains accessible. Do not assume aggregation is lossless for every current view.
13. **Manage exam images by lifecycle:** lazy-load current/near-next images; avoid all-paper preload and persistent blob copies; clear only app-owned active-session image/cache entries on submit/exit; load old review images on demand; and use measured, bounded HTTP caching rather than promising page code can purge the browser's general cache.

## Low-disruption rollout

### Phase 0 — Measure and protect

- Check the live Supabase Database Size, Storage Size, Egress and cached egress; record Render memory/CPU/response times and actual response byte sizes for `/api/questions`, `/api/tests`, and paper loads.
- On the affected browser, record only sizes/counts (not user content): each app localStorage key's byte length, IndexedDB store counts/estimated serialized bytes, `navigator.storage.estimate()`, app-owned Cache Storage names/bytes, image request count/transfer sizes, and the exact operation that triggers quota failure. Repeat after 1, 3, and 5 paper attempts, submit, logout, and review. Browser developer tools may be needed to inspect HTTP cache use because page JavaScript cannot reliably total its disk size.
- Export/backup current admin content and student-data schema before any migration.
- Create staging Supabase/Render/Cloudflare projects with synthetic data; do not run performance tests against production.
- Capture baseline user journeys: login, dashboard, filtered PYQ search, question open/next, custom-test builder, test launch/submit, calendar, and admin import/delete.

### Phase 1 — Stop avoidable client-side work and writes

- Separate the displayed custom-test countdown from the persisted session object. Do not increment `session.timeSpent` and serialize every question body every second; compute elapsed time from timestamps and persist time on question transition/periodic checkpoint.
- Store a compact active-session record (IDs/version references, answers, review/bookmark IDs, current index, start/end timestamps, time spent), not the complete question objects. Keep local answer persistence immediate, but send bounded cloud checkpoints/deltas with idempotent retries. Define acceptable recovery loss (for example, at most 15–30 seconds) before choosing the checkpoint interval.
- Apply the same review to test-series `saveSess()` snapshots and the legacy analytics/session keys; preserve cross-device resume and test recovery while removing duplicate/full content.
- Classify synced localStorage keys; migrate/retire obsolete duplicate analytics only after compatibility tests and backup.
- First remove the question dependency from dashboard metrics/calendar by recording the small metadata each attempt needs and using maps/aggregates rather than repeated linear `find()` calls. For legacy attempts missing metadata, fetch only referenced IDs in batches.
- Add a single shared question-data provider/query cache so question pages in the same browser session coalesce concurrent requests; this reduces duplicate browser fetches but does not by itself remove Supabase's monolithic JSON read.
- Stop loading questions on pages that only need counts/recent activity; fetch questions when a question feature is opened.
- Lazy-load route bundles and make the app shell render while noncritical sync runs. Do not let one account's data appear before safe account switching/reconciliation is established.
- Keep current visible screens and URLs; compare before/after correctness, sync traffic, and timing.

### Phase 2 — Shrink API reads before changing the schema

- As a temporary bridge, cache low-write public admin/test documents in the API process, invalidate after successful admin writes, and use a short TTL if more than one API instance can serve traffic. This avoids a Supabase fetch per request, but does not make filtering inside a monolithic JSON row efficient and must not cache personalized or entitlement-protected responses.
- Add paginated/filterable public API responses and `ETag`/version support. As an interim step, filter in the API to reduce browser payload, while recognizing that a monolithic JSON row still makes Supabase return that whole row to Render.
- Return quiz catalog metadata separately and filter/sample quiz challenge questions by subject/chapter server-side.
- Avoid loading full tests for a public catalogue; return only safe metadata and fetch a selected test after authorization.
- For normal public content, cache immutable versioned images where appropriate; for timed-paper images use the no-store/in-memory path to honor the requested per-attempt lifecycle. Publish a new URL when an image changes.
- Replace whole-paper image preloading with bounded just-in-time loading; measure actual browser storage and add safe active-session cleanup, while retaining on-demand analysis/review.
- Keep current visible screens and URLs; compare before/after correctness and timing.

### Phase 3 — Remove the monolithic storage bottleneck

- Add normalized papers/questions/test-reference tables and indexes using additive migrations.
- Split test catalogue metadata from test bodies so list/detail reads do not deserialize every full test. Keep test-template authorization and paid-series access checks server-side.
- Backfill from `admin_content` idempotently; compare counts, question IDs, answer/solution fields, image URLs, test order/scoring, and publication/access status.
- Add new read/write API endpoints behind a server-side feature flag. Shadow-read/compare old versus new results in staging; never double-count attempts.
- Switch a small admin test import to the new store, verify deletion and rollback, then switch public reads.
- Keep the old JSON documents read-only as a rollback snapshot for a defined period; remove them only after verified backups and an agreed retention window.

### Phase 4 — Compact and batch student data

- Introduce append-only attempt writes with retries/idempotency and batch flush; dual-write/compare in staging before production cutover.
- Migrate retained custom-test results to compact references/answers. Preserve existing result screens and bookmarked/review behavior.
- Separate durable solved history from active test-session autosaves, analytics rollups, old compatibility keys, and UI preferences. Migrate each class with explicit retention and conflict-resolution rules.
- Decide with the owner how long exact per-attempt history must be retained. If old details are aggregated, retain sufficient per-question/day totals for current stats/calendar.
- Monitor DB growth per active student over one real pilot month and update forecasts using measured figures.

### Phase 5 — Controlled capacity validation

- Use staging with a data set matching at least the projected paper count and representative long solutions/images.
- Ramp read-only traffic gradually (for example 5, 10, 25, 50, then 100 virtual users); test repeated and varied paper selections. Add answer writes only in staging after read tests pass.
- Measure p50/p95/p99 latency, error rate, response bytes, Supabase egress/database size, Render CPU/memory, and cold-start behavior.
- Set stop conditions and alert thresholds; do not jump directly to 500–1,000 concurrent users on free services.
- Only extrapolate the tested result within a modest range. Verify the exact concurrent level required (e.g. 1,000 registered students is not the same as 1,000 simultaneous sessions).

## Performance priorities

| Priority | Change | Expected benefit | User-visible risk |
|---|---|---|---|
| 1 | **Completed:** Stop per-second full custom-test session sync; separate active question snapshots from compact progress; checkpoint within a 90-second target | Removes repeated question-body uploads and per-second sync work while preserving cross-device resume | Low; local action saves remain immediate; cloud resume requires the additive SQL migration and connectivity |
| 2 | Clear stale app-owned IndexedDB sessions/checkpoints after durable submit; keep result/review data separately | Prevents old paper session copies accumulating in browser storage | Medium; cleanup only after verified save and preserve resumability |
| 3 | Replace whole-paper image preload with current/near-next lazy loading | Faster first question, lower network use, less cache pressure | Low; handle slow/error images and avoid layout shifts |
| 4 | **Completed:** Remove dashboard question-body dependency; enrich attempts with small metadata and use compact ID lookups for legacy attempts | Eliminates full question-bank downloads and repeated linear question scans on the dashboard | Low; legacy metadata endpoint may briefly be unavailable, leaving missing legacy categories unclassified |
| 5 | **Completed:** Browser request caches plus short-lived, bounded API question-page caching | Fewer repeat browser requests; server cache hits also avoid repeating full-state clones and question filtering | Low; successful local admin saves invalidate caches; API cache is per process and expires quickly |
| 6 | Route-level lazy loading and progressive app shell | Smaller first route download; faster perceived sign-in/render | Medium; keep account isolation and data reconciliation safe |
| 7 | **Partially completed:** filtered question/paper endpoints, aggregate custom-test catalog, server-side sampling, and paginated public test-series summaries | Smaller payloads, less JSON parse/render work, fewer full reads in the long term | Medium; preserve exact test selection and access behavior |
| 8 | Normalized question/test storage and incremental admin CRUD | Removes whole-document read/write scaling and duplicate content copies | Medium; requires staged migration and immutable versions |
| 9 | Batched append-only attempts, compact results, and key classification | Reduces redundant writes and large per-user snapshots | Medium; sync/recovery semantics need careful tests |
| 10 | Explicit retention/archive and progressive sync | Controls long-term disk growth and avoids blocking first render on all history | High product/data-retention decision; no silent history loss |

## Acceptance criteria before broad launch

- Loading a dashboard makes **zero question-body requests** unless that screen needs question details.
- Dashboard stats/calendar stay correct with deleted or versioned questions and no longer require a full question-body catalog.
- One browser route causes no duplicate identical question requests.
- Opening one 75-question paper fetches only that paper's questions; the catalogue never returns question bodies.
- Custom-test selection preserves difficulty/subject/year rules using server-side sampling, not a per-question client download.
- Imported questions are stored once; a test preserves order/scoring through IDs and authorized fetching.
- Old test reviews still work against the original question version after an admin edits or removes the current live question.
- Editing/deleting one question does not rewrite the entire library; failed writes are reported and recoverable.
- Solving questions writes compact batches, not the complete prior attempt history each time; retries do not duplicate attempts.
- Active custom and test-series sessions resume cross-device without per-second full-body cloud writes; stale sessions expire according to a documented policy.
- After a submitted engine test is safely recorded, the completed active session and its checkpoints are removed from app-owned IndexedDB/localStorage; saved results still open in review.
- Starting/finishing several papers does not retain prior paper image blobs or unbounded app-owned session copies; analysis still loads the selected attempt's question images on demand.
- Storage-full warnings identify the failing storage operation and do not claim image-cache exhaustion without measurement; no saved answer/session is silently removed.
- A student can still see the promised solved history, calendar, bookmarks, notebooks, custom-test review, and test-series behavior after migration.
- Public content has cache validators/versioning; private, admin, and paid responses are never shared-cacheable.
- Production p95/p99 targets and expected concurrent users are selected and demonstrated on staging before marketing claims are made.

## Key references

- [Supabase setup and current data model](./supabase/SETUP.md)
- [Supabase user-data tables and RLS](./supabase/schema.sql)
- [Supabase admin JSON and image bucket](./supabase/persistent_admin_storage.sql)
- [Versioned normalized question storage migration](./supabase/normalized_question_storage.sql)
- [Legacy question-storage rollback migration](./supabase/restore_legacy_question_storage.sql)
- [Compact duplicate test solution fields](./supabase/compact_test_solutions.sql)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Supabase pricing and quotas](https://supabase.com/pricing)
