# Staging before/after comparison — 2026-11-06

The original baseline is [`staging-2026-11-06.json`](./staging-2026-11-06.json); the post-commit run is [`staging-after-commit.json`](./staging-after-commit.json). Both used the same site, API host, and unauthenticated GET-only endpoint checks. The first run used two samples per endpoint and the later run used three, so response correctness and body-size comparisons are stronger evidence than timing differences.

## Measured changes

| Check | Before | After commit | Difference |
|---|---:|---:|---:|
| Page 1 (`limit=20`) questions | 150 | 20 | Correctly limited; total is still 150 |
| Page 1 response JSON | 446,021 B | 69,111 B | 376,910 B / **84.5% smaller** |
| Page 2 questions | 150 | 20 | Page 2 now returns the requested page |
| Page 2 response JSON | 446,021 B | 41,325 B | 404,696 B / **90.7% smaller** |
| Physics-filtered page questions | 150 | 20 Physics | Filter now applies; matching total is 50 |
| Filtered response JSON | 446,021 B | 37,605 B | 408,416 B / **91.6% smaller** |
| `limit=1` questions | 150 | 1 | Correctly limited |
| `limit=1` response JSON | 446,021 B | 3,057 B | 442,964 B / **99.3% smaller** |
| Pagination/filter checks | 0/4 | 4/4 | All pass in the post-commit run |
| Question catalog / custom-test catalog / test catalog | 404 | 200 | All three routes now respond |
| Public tests response | 2,915 B | 933 B | 1,982 B / 68.0% smaller; cause is not isolated |
| Main JS / CSS decoded sizes | 1,743,711 B / 144,393 B | same | No measured bundle-size change |

The remaining unfiltered `/api/questions` response is still 150 questions and 446,021 B. The question mix and counts remain unchanged (150 unique IDs; 50 each Mathematics/Physics/Chemistry; 120 MCQ and 30 NUM), so the page/filter behavior changed without an observed reduction to the underlying current sample bank.

## Timing results (indicative only)

| Endpoint | Before median | After median | Observed delta |
|---|---:|---:|---:|
| Health | 225.9 ms | 115.7 ms | −48.8% |
| Full questions | 904.5 ms | 139.3 ms | −84.6% |
| Page 1 | 1,142.2 ms | 93.0 ms | −91.9% |
| Page 2 | 1,006.1 ms | 112.9 ms | −88.8% |
| Filtered page | 1,020.4 ms | 119.1 ms | −88.3% |
| Quiz catalog | 967.3 ms | 101.2 ms | −89.5% |
| Series | 849.5 ms | 102.5 ms | −87.9% |

**Do not treat these percentages as a reliable optimization speedup.** Sample counts differ, the earlier run was exposed to Render cold-start/wake-up behavior, and the post-commit run still had a full-question response sample taking 1,651.7 ms while its two other samples were about 130–139 ms. Request size and correct pagination/filter behavior are directly observed; latency needs more controlled repeated runs (same warm/cold state, same region, and more samples) before assigning a performance gain.

## What this verifies—and what it does not

- The staging API now demonstrates functional pagination/filtering and smaller per-page JSON responses.
- It does not show a new frontend bundle: both runs served the same JS/CSS asset filenames and decoded sizes.
- It does not prove that `SUPABASE_NORMALIZED_QUESTIONS` is enabled or that the normalized-question SQL migration ran. The 150-question unfiltered response cannot establish database normalization or storage savings.
- The test-list response-size change is real for these requests, but is not attributable to the solution-alias compaction migration because the public tests endpoint returns summaries and the migration's effect was not isolated.
- Authenticated user journeys, exam launch/resume, admin editing, and payments were not tested.

Re-run with `node scripts/staging-baseline.mjs` after each staging deployment. The script's default is three samples per endpoint; for more timing observations set `BASELINE_ROUNDS=5`. Keep unauthenticated/read-only scope unless a separately approved test account and safe staging data are available.
