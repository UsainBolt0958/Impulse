# Performance baselines

Run the repeatable public staging checks from the repository root:

```powershell
$env:BASELINE_OUTPUT = "performance-baselines/staging-after-change.json"
node scripts/staging-baseline.mjs
Remove-Item Env:\BASELINE_OUTPUT
```

The script performs unauthenticated GET requests only. It does not sign in, modify data, start exams, or initiate payment. It checks frontend HTML/assets and public API endpoints, records three timing/size samples by default (up to five), summarizes numeric question metadata, and checks whether paging/filtering changes the question result. Set `STAGING_SITE_URL`, `STAGING_API_URL`, or `BASELINE_ROUNDS` to override the defaults.

The file [`staging-2026-11-06.md`](./staging-2026-11-06.md) records the current browser and API findings. The raw machine-readable run is [`staging-2026-11-06.json`](./staging-2026-11-06.json).
