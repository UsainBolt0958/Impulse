# Staging baseline test report

**Date:** 2026-11-04  
**Student Preview:** `https://69f58f03.impulse-6mk.pages.dev/`  
**Admin Preview:** `https://4ebc0ac7.impulseadmin.pages.dev/`  
**Staging API:** `https://impulse-api-staging.onrender.com`

## Summary

The staging student and admin previews use separate staging resources; no production deployment or data was changed. The signed-in student preview was checked in the shared browser. The staging API has 150 questions, 2 tests, 2 series, and 3 quiz subjects. Both known Preview origins pass the API CORS preflight. The authorized UI tests created a staging notebook/bookmark and one custom-test result in the current browser.

A bounded load probe made 100 read-only requests across five API endpoints in four waves of 25 concurrent requests. All returned HTTP 200; at 25 concurrent requests, per-wave p95 latency was 2.37–3.20 seconds. This is a baseline for the tested requests and current small dataset. **It is not a reliable estimate of total/registered students, sustained active users, or capacity for the full future catalogue.** It does not test authenticated student workflows, sustained load, writes, or real image downloads.

No application code, production service, or payment flow was changed or tested. The API probes only read staging endpoints; the UI journeys below did write test data to the signed-in staging account/browser.

## Hosted staging checks

| Check | Result |
|---|---|
| Student Preview | HTTP 200; signed-out sign-in screen rendered |
| Admin Preview | HTTP 200; admin sign-in screen rendered |
| Render `/api/health` | HTTP 200, `{"ok":true}` |
| Latest content counts | 150 questions, 2 tests, 2 series, 3 quiz subjects |
| Student Preview CORS preflight | HTTP 204 with exact student Preview origin allowed |
| Admin Preview CORS preflight | HTTP 204 with exact admin Preview origin allowed |
| API read endpoints | Questions, tests, series, and quiz catalog returned HTTP 200 |
| Signed-in read-only pages | Dashboard, profile, PYQ practice, previous papers, test series, analysis, and calendar opened; no question was answered and no progress was intentionally written |
| Payment flows | Not exercised |

### Current content size and timing

The question endpoint returned **446,021 bytes** for 150 questions (about 2.97 KB per question as returned JSON). The returned question objects contain 44 non-empty image-field occurrences (`image` and `question_image`) totaling 6,354 characters; no image was embedded as a `data:` URI. This measures question JSON only—not actual image file storage or image-download egress.

| Endpoint | Requests | Response bytes | Elapsed |
|---|---:|---:|---:|
| `/api/health` | 1 | 11 | 394 ms |
| `/api/questions` | 1 | 446,021 | 1,291 ms |
| `/api/tests` | 1 | 2,915 | 508 ms |
| `/api/series` | 1 | 886 | 798 ms |
| `/api/quiz/catalog` | 1 | 3,597 | 541 ms |

These are individual warm requests, not representative page journeys.

### Bounded concurrency ramp

Read-only requests were made to `/api/health`, `/api/questions`, `/api/tests`, `/api/series`, and `/api/quiz/catalog`. At 1, 5, 10, and 20 concurrent clients, all requests succeeded. At 20 concurrent clients, p95 was about 3.1 seconds and maximum latency about 4.2 seconds.

A follow-up sent **100 requests in four waves of 25 concurrent requests**. All 100 returned HTTP 200:

| Wave | Concurrent requests | Median | p95 | Maximum |
|---|---:|---:|---:|---:|
| 1 | 25 | 2,318 ms | 3,196 ms | 3,218 ms |
| 2 | 25 | 1,907 ms | 2,809 ms | 3,044 ms |
| 3 | 25 | 1,586 ms | 2,373 ms | 2,552 ms |
| 4 | 25 | 1,718 ms | 2,780 ms | 2,783 ms |

This shows only that staging served these bounded read bursts with the current small dataset. It does not establish a safe sustained-user number; page journeys make multiple requests, data size will grow, and response times reach seconds under this limited test. Do not extrapolate directly to registered students or 20,000 users.

### Capped stress probe (stopped at first threshold)

To avoid intentionally taking the service down, the probe was capped at 50 simultaneous read-only requests, with a stop condition on any failed request or p95 above 5 seconds. The first wave reached the stop condition, so no additional waves were sent:

| Concurrent requests | Result | Median | p95 | Maximum |
|---:|---|---:|---:|---:|
| 50 | 40 HTTP 200, 10 request failures (`terminated`) | 4.93 s | 6.44 s | 6.52 s |

Most observed failures occurred on the large `/api/questions` responses. The probe stopped immediately. A subsequent single health request returned HTTP 200 in 309 ms, and the student Preview CORS preflight still returned HTTP 204. This was not a “failure limit” test; it was stopped at the first capped threshold. It indicates that this staging service, with the current dataset and test conditions, did not reliably serve 50 concurrent reads of this mix.

### Staggered student-journey read simulation

After the user requested a more realistic check, a capped read-only approximation simulated students arriving 350 ms apart. Each simulated student made two concurrent `/api/questions` reads (a conservative two-read scenario based on the code review), then sequential reads of `/api/tests`, `/api/series`, and `/api/quiz/catalog`, with short pauses. Cohorts increased from 5 to 10 to 15 simulated students. No authentication, browser rendering, writes, answer submission, or image-file downloads were part of this approximation. In the later signed-in dashboard browser check, no `/api/questions` request appeared in the captured resource list; the two-question-read model should therefore be treated as a stress scenario, not a confirmed dashboard request count.

| Simulated students | Requests | Question requests | Failed requests | Median | p95 | Maximum |
|---:|---:|---:|---:|---:|---:|---:|
| 5 | 25 | 10 | 0 | 858 ms | 1,991 ms | 2,245 ms |
| 10 | 50 | 20 | 0 | 1,047 ms | 1,975 ms | 2,033 ms |
| 15 | 75 | 30 | 0 | 1,260 ms | 2,949 ms | 4,137 ms |

All **150 requests** across these cohorts returned HTTP 200. The question responses transferred about **26.98 MB total** across the test. The 15-student maximum single-request latency exceeded 4 seconds, although cohort p95 stayed under the 4-second stop threshold. A post-test health check returned HTTP 200 in 218 ms.

Interpretation: the tested service handled this **staggered read-only request pattern for 15 simulated clients** without errors, but latency rose and one request took about 4.1 seconds. This does **not** show that 15 real signed-in students will always be smooth, nor that 50 will fail as students: virtual clients here are API request scripts, not real browsers/authenticated user journeys, and the test omits database writes, browser/device/network variation, and image fetches. The separate 50-request burst test did produce failures. These are capacity signals, not a production user guarantee.

### Frontend first-load observation

On the integrated browser's observed sign-in-screen load:

- DOM content loaded: about **849 ms**; page load event: about **851 ms**.
- Four resources were observed: app JavaScript (~505 KB transferred), CSS (~27 KB), font CSS (~1 KB), and logo image (~837 KB).
- The locally built customer bundle is **1.74 MB minified / 502 KB gzip**. This suggests future opportunities in route splitting and image optimization, but it is not an apples-to-apples speed benchmark across devices or networks.

### Signed-in staging browser smoke check

The user signed in directly in the shared browser; no account credentials were requested or accessed. Read-only navigation results:

| Page/flow | Observation |
|---|---|
| Dashboard | Loaded; saved activity counters showed zero for this test account |
| PYQ practice | Exam → JEE Mains → Physics navigation worked |
| Chapter selection | The 50-question JEE Mains Physics dataset appears under some imported chapter labels, but 25 fixed chapter labels showed “No data yet”; some similarly named dynamic chapters with questions also appear. Review the chapter-name mapping before treating this as a content-completeness test. |
| Previous Papers | Catalogue page loaded and listed exam categories |
| Test Series | Page loaded and reported that no published test series are available |
| Analysis and calendar | Pages loaded and rendered empty/zero activity |
| Persistence/write flows | Not tested: no answers/bookmarks/results were submitted |

These are page smoke checks, not a full end-to-end verification of saving or syncing data.

## Free-tier envelope (rough, not a guarantee)

Official plan pages checked on 2026-11-04:

- [Supabase pricing](https://supabase.com/pricing) lists Free with **50,000 MAU**, **500 MB database**, **5 GB uncached egress**, **5 GB cached egress**, and **1 GB file storage**.
- [Render free service docs](https://render.com/docs/free) list a Free web service at **0.1 CPU / 512 MB RAM**, **750 free instance-hours per workspace per calendar month**, and spin-down after **15 minutes idle**; waking may take about a minute. These are service/resource limits, not student capacity.

### Egress arithmetic from the observed sample

The current entire 150-question API response is **446,021 uncompressed JSON bytes**. `server/persistence.js` confirms that each read of a persisted admin JSON document fetches the complete document from Supabase before the API responds. Supabase's actual metered transfer (including compression and other traffic) was not available, so the following is an uncompressed payload model:

- 5 GB supports roughly **11,000–12,000 full question-document reads** if each costs about 446 KB.
- If each student caused one such read per day for 30 days: approximately **370–400 students/month** before any other egress.
- At two full reads per day: approximately **185–200 students/month** before other egress.

These are theoretical egress-only ceilings for the present, small 150-question dataset—not safe student counts. User-data sync, other endpoints, question-image downloads, compression, and real usage patterns change the result.

### If the catalogue grows to 500 papers

Using the observed average of about **2,973 JSON bytes/question** and the planning assumption of 75 questions per paper:

- 500 papers ≈ **106 MiB** of question JSON in one full-library response.
- If the paper copy is duplicated in the test document as the code currently does, that content could be around **213 MiB** total before database overhead and student records—under 500 MB on paper, but already a large share of the Free database.
- At 106 MiB per full question-document read, 5 GB egress is only about **48 uncompressed reads/month**. This is why the current whole-document read design must be optimized before loading a large catalogue or expecting substantial free-tier traffic.
- If images average the earlier planning assumption of 100 KB per paper, 500 papers would use about **50 MB** of Supabase file storage; actual staged image object sizes were not measured.

### Practical interpretation

The 15-client staggered read simulation succeeded but had p95 around 2.9 seconds and one request around 4.1 seconds. A simultaneous 50-request read burst failed 10 requests. These tests are not real authenticated concurrent students. For an initial Free-tier pilot, **plan conservatively around 5–10 simultaneous active students**, measure real usage, and do not promise 50+ until the full question-document reads and duplicated data are optimized and retested. Registered accounts/MAUs can be higher than simultaneous users, but no trustworthy monthly student capacity is established yet.

## Local repository checks

These checks ran against the available workspace. Its Git metadata is unavailable here, so exact equivalence with the deployed `staging` commit could not be verified.

| Check | Result |
|---|---|
| Frontend Vitest suite | **143 passed**; one suite failed before running tests in `src/lib/testSeriesPanicDuration.test.js` with `TypeError: The URL must be of scheme file` |
| API persistence tests | **5 passed** |
| Customer production build | Passed; emitted large-chunk warning (1.74 MB minified, 502 KB gzip) |
| Admin production build | Passed; emitted large-chunk warning (737 KB minified, 208 KB gzip) |
| Frontend lint | Could not run: ESLint 9 could not find an `eslint.config.*` file |

These test/lint issues are validation limitations; they were not changed during baseline testing.

## Signed-in student journeys

These journeys used the staging Student Preview and were not run against production.

| Journey | Observed result |
|---|---|
| Bookmark a Thermodynamics question | Created `Staging Test Notebook`; success toast appeared. The notebook and its one question remained after a page reload. However, the default “Bookmarked questions” view showed 0 questions while the named notebook showed 1; clarify whether these are intended as separate collections or investigate the count/view mismatch. |
| Open JEE Main previous paper | The catalog listed two 2025 papers, each with 75 questions and a 180-minute duration. The exam loaded and allowed an answer to be saved. The legacy exam UI identified the participant as `GUEST`; submitting triggered “Please login/register to the server using the Server Login panel to submit answers.” It then showed a local result (one correct, 74 unattempted), but the authenticated user’s server-side attempt/progress was not verified. The journey is not confirmed as saved to the student account. |
| Build and submit a custom test | Builder progressed through exam, subject, chapter, and settings. I selected Physics and Thermodynamics, but the generated test had 10 questions and its first question was labeled “Units and Measurements,” not Thermodynamics. This is a reproducible-looking chapter-selection mismatch that needs investigation. Submission and scorecard worked (one attempted, score −1/40). |
| Custom-test history and calendar after reload | History survived a page reload, consistent with the UI’s explicit “saved in this browser” wording. It showed two identical cards pointing to the same result ID, so the duplicate history entry needs investigation. The calendar recorded one unique question under “Custom Test” for November 4, with 0 correct. This confirms the attempt contributes to the calendar on this browser, but does not establish cross-device or database persistence. |

During the previous-paper route, browser console events also reported a service-worker registration failure because the service-worker response had MIME type `text/html`; the exam itself nevertheless loaded. Subsequent read-only staging API checks all returned HTTP 200: `/api/health` 0.39 s, `/api/questions` 1.75 s (446,021 bytes), `/api/tests` 0.50 s, and `/api/series` 0.72 s. These are single requests, not a concurrency benchmark.

The browser session emitted duplicate-save / duplicate-attempt warnings during navigation. The bookmark and custom-test calendar event survived reloads, but cross-device sync and the exact Supabase persistence path were not verified. The test portal’s guest/server-login prompt is a clear blocker for treating previous-paper attempts as account-synced.

## What remains untested / next steps

1. Verify cross-device sync with a disposable staging student account; the current tests only establish persistence in this browser. Do not use production for these tests.
2. Investigate previous-paper authentication/submission, custom-test chapter filtering, duplicate custom-test history, and the bookmark count/default-view discrepancy before claiming these records are reliably account-persistent.
3. Verify test-series resume. The student page previously showed no published series, despite two series records in the API.
4. Admin import/edit/delete and image-upload flows were not exercised in the browser test. Verify only against staging and confirm content is visible in the student Preview.
5. Measure actual image object sizes and Supabase database/storage usage in the staging dashboards; API JSON size is not provider storage telemetry.
6. Repeat tests at the expected future catalogue scale and with controlled synthetic traffic. Increase concurrency in stages with explicit stop limits; do not jump to very high concurrency on a free service.
7. No payment credentials or real payment flow were exercised.

The staging `staging` branch preview and separate Render/Supabase resources do not replace production. Production changes only if production configuration is changed or a change is merged/deployed to the production branch/service. Do not run these tests against production.
