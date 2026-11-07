# Database optimization baseline — 2026-11-06

## Purpose

This is the pre-change baseline for the append-only solved-attempt implementation. Re-run the same public staging checks after deployment and compare with [`staging-pre-next-optimization-2026-11-06.json`](./staging-pre-next-optimization-2026-11-06.json). These are not measurements of the main branch; they describe the currently deployed staging site and API.

The API baseline was first attempted while the API returned HTTP 503 for every endpoint. That attempt is invalid and was replaced by the successful five-round run recorded in the JSON file linked above.

## Test scope

- Staging site: `https://69f58f03.impulse-6mk.pages.dev`
- Staging API: `https://impulse-api-staging.onrender.com`
- Five sequential samples per public API endpoint
- Unauthenticated GET requests only; no user data, admin edits, exam submissions, or payments were changed
- Static site HTML and referenced JS/CSS assets checked
- Four functional checks for pagination, page distinction, filtering, and limit handling

## Staging API measurements

Times are medians from five samples. Response sizes are the measured response-body byte counts.

| Endpoint | Status | Median ms | Median bytes | Items | Result |
|---|---:|---:|---:|---:|---|
| Health | 200 | 91.3 | 11 | — | Healthy |
| All questions | 200 | 249.3 | 446,021 | 150 | Full unfiltered response |
| Questions page 1 (`limit=20`) | 200 | 105.3 | 69,111 | 20 | Pagination works |
| Questions page 2 (`limit=20`) | 200 | 106.2 | 41,325 | 20 | Different page |
| Physics-filtered questions | 200 | 103.9 | 37,605 | 20 | Filter applied |
| Questions (`limit=1`) | 200 | 99.6 | 3,057 | 1 | Limit applied |
| Question catalog | 200 | 104.9 | 1,529 | 24 | Responds |
| Custom-test catalog | 200 | 98.7 | 5,177 | 1 | Responds |
| Quiz catalog | 200 | 91.4 | 3,597 | 3 | Responds |
| Series | 200 | 102.8 | 886 | 2 | Responds |
| Tests | 200 | 103.4 | 933 | 2 | Public summaries |
| Test catalog | 200 | 97.6 | 107 | 0 | Request responds; no matching items |
| Admin state | 401 | 97.2 | 24 | — | Expected unauthenticated denial |
| Engine questions | 401 | 96.9 | 24 | — | Expected unauthenticated denial |

All four pagination/filter assertions passed. The full question result contains 150 unique IDs. One all-questions sample took 2,118.3 ms while the median was 249.3 ms, so timing should be treated as variable; byte counts and functional assertions are more reliable for this baseline.

The site returned HTTP 200 (485 HTML bytes). Its referenced JS and CSS returned HTTP 200 and were 1,743,711 B and 144,393 B respectively.

## Staging database observations supplied by the owner

| Observation | Result | Interpretation |
|---|---:|---|
| Reported database size, before and after the test-solution SQL | 13 MB both times | No visible change at the displayed precision |
| `tests.json` current JSON text | 268,603 B | Post-migration current size |
| Estimated text bytes further removable now | 0 B | No duplicate solution aliases remain detectable now |
| `compact_duplicate_solution_aliases(jsonb)` | Present | The SQL function exists; this alone does not prove how many rows the update changed |
| `admin_content` table / `admin-uploads` bucket | Present | Existing setup; do not rerun its setup SQL |
| `question_versions` / normalized save function | Absent | The question-normalization migration was not applied |
| Admin state questions | 150; 150 unique, none missing IDs | Previously checked; relevant only if question normalization is reconsidered |

There was no pre-compaction snapshot of `tests.json`, so the amount compacted by the SQL cannot be reconstructed. The unchanged 13 MB display is not proof of zero physical change; `pg_column_size` is also not a valid before/after comparison against a newly generated JSON value. No net database storage percentage improvement can be claimed from the available measurements.

## Append-only solved-attempt implementation

The current user-data sync stores values in `user_data` by `(user_id, storage_key)` and upserts the full value for a changed key. As solved-attempt arrays grow, each update can resend the accumulated array. An opt-in path is now implemented in the workspace: after the additive migration is run and the frontend flag is enabled, new solved attempts are written in bounded, idempotent batches to `study_attempts`. Existing history remains in `user_data`, is merged with the new rows on sign-in, and is never deleted by this change.

The flag defaults off. The SQL has not been run by the assistant, and the feature is not confirmed deployed or enabled on staging. This changes ongoing write volume, not the public endpoint payloads measured above. Because per-attempt rows add index/row overhead and the legacy value remains for compatibility, it may increase database storage. Do not call it a storage-size reduction.

Account-switch handling also received a workspace-only fix: stopped syncs no longer apply a late account read or start additional queued writes. This lowers cross-account race risk but does not replace real staging tests with two test accounts/devices.

## Normalized question storage implementation status

The workspace includes [`normalized_question_storage.sql`](../supabase/normalized_question_storage.sql), an API feature flag, normalized paginated/filter/catalog/metadata reads, admin-state hydration, and an atomic service-role save RPC. With normalized mode enabled, the quiz catalog now loads only the minimal fields needed to identify playable questions and count them by subject/chapter; challenge creation queries only the selected subject/chapter and caches each chapter independently with a 100-entry cap. The legacy quiz cache-miss paths still read the full question document. The migration maintains version history and stable current ordering; the existing admin API still loads the full question list when it needs admin state or an unfiltered response.

This migration has **not** been run against the staging database, and normalized mode is not enabled. No PostgreSQL client/server was available in the workspace to execute it locally. Before running it, pause admin edits and stop the API; after the migration, start the prepared API with `SUPABASE_NORMALIZED_QUESTIONS=true`, then verify full question counts/content, admin edit/delete/reorder, refresh, and rollback before resuming edits. The revised sequence is in [`Supabase setup`](../supabase/SETUP.md).

This migration removes the question list from `admin_content`; it does **not** remove copied question bodies from dynamic `tests.json` papers. Retained custom-test results are compacted by workspace code on the next successful test submission, but that code is not deployed and does not replace question text/explanation with references. No reduction in hosted database size is claimed. In particular, do not report the earlier 13 MB rounded size as evidence of improvement or use this report's pre-change staging API samples as post-change results.

Future API writes to `tests.json` now compact duplicate `solution`/`explanation` strings recursively inside question data, including nested question structures. The persistence read path restores the expected response shape. A targeted regression test verifies nested aliases are compacted, distinct explanations remain, and unrelated metadata is not altered. This behavior is covered by local tests only; it has not been measured on the hosted database.

The one-time [`compact_test_solutions.sql`](../supabase/compact_test_solutions.sql) was also made a no-op on reruns: it computes the compacted JSON once and updates the document only when its content changes, avoiding an unnecessary row rewrite and `updated_at` change after compaction. Its recursion is scoped to objects inside `questions` arrays so unrelated metadata containing similarly named fields is preserved. This SQL has not been run against staging by the assistant.

The workspace now stores custom-test result entries without the full question object, retaining only question text and explanation alongside the existing answer/scoring fields used by the review screen. Legacy result snapshots are compacted when a subsequent test is submitted; the existing 50-result cap and old-result display fallback remain. The focused result tests pass and the production frontend build succeeds. This is a workspace-only change: it has not been deployed, and neither hosted database savings nor the remaining duplicated review-text size has been measured.

Before applying the migration or enabling the flag, capture staging-only measurements for:

- `user_data` row count, total table/index bytes, and per-key JSONB bytes for attempt/history keys;
- representative payload bytes and number of writes generated by one new solved attempt at small and larger history sizes;
- current sync, merge, duplicate-retry, offline recovery, and account-isolation behavior.

The implementation preserves exact history by retaining the legacy snapshot and merging it with appended records. Focused tests cover mixed legacy/new history, stable deduplication despite JSON property order, pagination past 1,000 rows, bounded write batches, and migration security/idempotency properties. Staging verification is still needed for real Supabase RLS/RPC behavior, offline retry, account isolation, and rollback. Do not delete or aggregate old history without approval.

Run these **read-only** queries in staging to record the database-side baseline:

```sql
select
  c.relname as table_name,
  coalesce(s.n_live_tup, 0) as estimated_live_rows,
  pg_relation_size(c.oid) as table_bytes,
  pg_indexes_size(c.oid) as index_bytes,
  pg_total_relation_size(c.oid) as total_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s
  on s.relid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'user_data',
    'custom_test_sessions',
    'custom_test_session_questions'
  )
order by c.relname;
```

```sql
select
  storage_key,
  count(*) as user_rows,
  sum(pg_column_size(value)) as stored_jsonb_bytes,
  sum(octet_length(value::text)) as json_text_bytes,
  max(octet_length(value::text)) as largest_user_value_bytes
from public.user_data
where storage_key in (
    'impulse_solved',
    'impulse_custom_test_results',
    'test_analytics_history',
    'exam_sync_queue'
  )
  or storage_key like 'test_series!_%!_data!_v1' escape '!'
group by storage_key
order by storage_key;
```

These queries measure current data sizes and estimated row counts, not network write volume. Capture the results before the SQL migration, then rerun after enabling the feature and after representative solved-attempt writes. Compare byte counts at full precision rather than the rounded dashboard MB display.

## Repeat after the next deployment

From the repository root, save the same five-round public baseline:

```powershell
$env:BASELINE_ROUNDS = "5"
$env:BASELINE_OUTPUT = "performance-baselines/staging-after-next-optimization-2026-11-06.json"
node scripts/staging-baseline.mjs
Remove-Item Env:\BASELINE_ROUNDS
Remove-Item Env:\BASELINE_OUTPUT
```

Compare endpoint status, functional checks, response sizes, question counts, and asset sizes against the pre-change JSON. Compare timing only as an indicative measure; repeat under similar Render warm/cold conditions. For database results, rerun the same read-only table and per-key size queries before and after on the staging Supabase project. Do not use production for this test.

For the append-only staging rollout:

1. Run the two read-only database-size queries above and save their results **before** the migration.
2. Deploy the code with `VITE_SUPABASE_APPEND_ONLY_ATTEMPTS=false`.
3. Run [`append_only_study_attempts.sql`](../supabase/append_only_study_attempts.sql) in staging.
4. Set `VITE_SUPABASE_APPEND_ONLY_ATTEMPTS=true` in the staging frontend build environment and redeploy.
5. Using a staging test account, solve one question. Verify it appears in the local solved history and in `study_attempts`; verify a second device signed into the same staging account sees it. Do not use a production account for this test.
6. Rerun the database-size queries and public baseline. Also inspect the DevTools Network request body sizes for the attempt write before/after; do not copy/share request headers, cookies, or tokens.

The public API baseline will not by itself show the new attempt-write benefit. Report upload-byte savings from the actual authenticated attempt requests; report table/database size separately. If rollback is needed, run [`restore_study_attempts_to_user_data.sql`](../supabase/restore_study_attempts_to_user_data.sql), verify the restored `user_data` attempt count, then set the flag to `false` and redeploy.

## Validation performed for this report and current workspace

- Staging read-only baseline: 5 samples per API endpoint; all four pagination/filter assertions passed.
- Current user-data sync and solved-question focused tests: 15 passed, including stopped-account late-read and queued-write cases.
- Current backend suite after normalized quiz catalog/chapter reads, bounded chapter cache, nested test compaction, and SQL scope/no-op guards: 105 passed across 8 test files; normalized persistence and quiz cache tests pass.
- Production frontend build passed. Existing non-blocking output includes stale Browserslist data and an ambiguous Tailwind utility warning.
- Full frontend suite: 207 passed; 2 admin component tests failed under the suite's default environment because `document` is not defined. Re-running those 2 explicitly with jsdom passed both.
- Frontend lint could not run because this workspace has no ESLint flat config (`eslint.config.js`, `.mjs`, or `.cjs`).
- Supabase SQL was not executed by the assistant. No local `psql`, `pg_ctl`, or Docker executable was available. The database values above were provided by the owner from the staging SQL Editor.
- No production or staging deployment, authenticated flow, database-size comparison, egress measurement, or load test was performed during this follow-up.
