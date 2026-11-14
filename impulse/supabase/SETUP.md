# Supabase setup

## 1. Create a Supabase project

Create a project in the Supabase dashboard and keep the database password private.

## 2. Create the app tables

Open **SQL Editor**, paste the contents of [`schema.sql`](./schema.sql), and run it. The policies allow signed-in users to read and change only their own profile and saved data.

To reduce repeated full-array uploads for solved-question history, run [`append_only_study_attempts.sql`](./append_only_study_attempts.sql) after `schema.sql`. It adds a per-user append-only table and an idempotent RPC; it does not backfill, delete, or rewrite existing `user_data`. Keep `VITE_SUPABASE_APPEND_ONLY_ATTEMPTS=false` (or unset) until the migration has succeeded on the matching Supabase project. Then set it to `true` in the staging frontend build and redeploy. New solved attempts are appended individually; existing history is still read from `user_data` and merged with the new table. This reduces repeated upload/write volume as history grows, but does not promise a database-size reduction. To roll back, run [`restore_study_attempts_to_user_data.sql`](./restore_study_attempts_to_user_data.sql) first, then set the flag to `false` and redeploy. Keep the new table until the rollback is verified.

For compact cross-device custom-test resume, also run [`custom_test_sessions.sql`](./custom_test_sessions.sql) after `schema.sql`. It stores the question snapshot once while a test is active and keeps later answer/time checkpoints separate. Existing full-session values under `user_data` are imported the next time a signed-in user opens Custom Tests; do not delete the old `user_data` table.

To enable username search and friend requests, also run [`friends.sql`](./friends.sql) in the SQL Editor. This is an additive migration and is safe to run for a project where you already ran `schema.sql`.

To configure the Free, Lite, Gold, and Ultimate catalog, subscription term prices, per-series prices, referral discount settings, and billing tables, also run [`premium.sql`](./premium.sql). It seeds the current plan catalog and prices; later edits made in the billing admin panel are stored in Supabase. It does not create purchases or charge users.

Run [`admin_access.sql`](./admin_access.sql) after `premium.sql`. It restricts the admin role to the verified Google accounts `yashbharati81@gmail.com` and `impulsepreps@gmail.com`. No account UUID needs to be inserted manually. The same role gates the full admin portal and billing controls; other signed-in accounts see **No admin access**.

Run [`upi_payments.sql`](./upi_payments.sql) after `premium.sql` and `admin_access.sql`. It creates server-managed UPI orders and purchased test-series records, and service-role-only database functions that verify the configured price and apply a confirmed payment once. Never expose the Supabase service-role key to the browser or a user.

Run [`pro_access.sql`](./pro_access.sql) after `friends.sql`, `premium.sql`, and `admin_access.sql`. It adds the Pro request queue, 12-month admin-approved Pro access with expiry reporting, configurable Pro offer card/prices, daily usage enforcement, and the Basic friend cap. Custom-test creation and previous-paper launches require a signed-in account so their Basic quotas can be applied. Existing legacy payment records and UPI backend remain intact; their billing admin UI is archived under the billing panel. If this migration was already applied, rerun its updated idempotent version to add the Pro expiry column and user-status RPC.

Run [`persistent_admin_storage.sql`](./persistent_admin_storage.sql) to store admin content in Supabase and create the public image bucket used for uploaded question images. Run it before deploying the matching API code. This is required for hosted admin edits and uploads to survive API restarts/deployments. It uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the API host; do not add the service-role key to Cloudflare or any `VITE_*` setting. Existing Render-local JSON files and uploads are not migrated by this SQL; they are ignored in production after this change.

To compact legacy test-paper records, run [`compact_test_solutions.sql`](./compact_test_solutions.sql) after `persistent_admin_storage.sql`. It removes an `explanation` field only when it exactly duplicates the question's `solution`, and only within test-question data; unrelated metadata is untouched. The API restores the original response shape when serving tests. The SQL can be rerun safely and skips updating `tests.json` when it is already compacted. Future API saves apply the same safe compaction recursively within test-question data. Questions with different solution and explanation text are unchanged.

To migrate public question reads from the monolithic admin JSON document to indexed, versioned rows, first verify that the latest question bank is present in `admin_content` and every question has a unique, non-empty `id`. Prepare the API deployment with the new code and `SUPABASE_NORMALIZED_QUESTIONS=true`, but keep it stopped and pause all admin edits before running [`normalized_question_storage.sql`](./normalized_question_storage.sql) in the SQL Editor. It backfills the current question list as version 1, verifies the rows, and only then replaces `admin_content.questions` with an empty array. The migration also creates an atomic service-role-only admin save function that keeps question bodies out of the admin JSON document. The API hydrates the admin state from the versioned table, so the admin portal still receives its full question list. The migration fails if the hosted admin document is missing, IDs are invalid, or the backfill does not match; fix the source data and rerun it before proceeding. The SQL does not read local files or transfer data from this workspace.

After the migration succeeds, start the prepared API with `SUPABASE_NORMALIZED_QUESTIONS=true` and verify question reads, admin-state reads, edits, deletes, reorders, and a fresh admin reload before resuming admin edits. This switches question listing, metadata, chapter/custom-test catalogs, custom-test selection, admin-state reads, and writes to the normalized table/RPC. Keep the setting unset or `false` until SQL has completed. If the setting is enabled before the migration, requests fail explicitly rather than silently serving stale legacy data. Quiz lookups still fetch current question bodies where their existing behavior requires them. Admin question reordering is serialized and uses temporary positions outside the active ordering range before assigning new ordinals, preserving the unique current-position constraint.

The normalized-question migration alone does not remove copies from dynamic papers or saved custom-test reviews. After it succeeds, deploy the matching API/frontend code, keep `SUPABASE_NORMALIZED_QUESTIONS=true`, pause admin test edits and student result submissions, and run [`version_test_question_references.sql`](./version_test_question_references.sql). It pins imported test questions and custom-test review items to immutable question versions only when their stored content exactly matches that version. Nonmatching/legacy snapshots are deliberately preserved. The transaction requires `tests.json`, locks it during conversion, and updates user result rows only when the JSON changes. Keep `question_versions` for as long as any test or saved result refers to it, including if you later restore the legacy `admin-state.json` question list. Verify a published paper launch, paid-series authorization, admin test editing, old/new scorecard review, and cross-device result sync after the migration. Back up `admin_content` and affected `user_data` before running it; no migration has been run from this workspace.

To roll back the reference conversion before deploying older application code, pause test edits/result submissions and run [`restore_test_question_snapshots.sql`](./restore_test_question_snapshots.sql). It restores test question payloads and scorecard review text from the exact pinned versions and aborts if a referenced version is missing. Keep `question_versions` until the snapshot restoration and the separate normalized-question rollback have both been verified.

If you already applied an earlier version of `normalized_question_storage.sql`, rerun the corrected full script after deploying the updated API. It is designed to preserve an already-compacted admin document and replace the RPC with the corrected reorder-safe implementation.

The migration removes the duplicate question list from `admin_content`; however, the normalized rows, indexes, and retained historical versions have their own storage overhead. Do not assume the project's reported database size will fall: compare Supabase usage before/after, and account for PostgreSQL space reclamation behavior. For rollback, stop the API and pause admin edits, run [`restore_legacy_question_storage.sql`](./restore_legacy_question_storage.sql), then set `SUPABASE_NORMALIZED_QUESTIONS=false` and restart. This restores current questions to the admin document; the version table is retained and can be dropped only after confirming no consumers need it.

## 3. Enable Google sign-in

In Supabase, open **Authentication → Providers → Google** and configure the Google OAuth client ID and secret. In the Google Cloud OAuth client, add the Supabase callback URL shown by the provider setup. In **Authentication → URL Configuration**, set the local and production site URLs and add these redirect URLs:

- `http://localhost:3000/account`
- `http://localhost:4000`
- `http://localhost:4000/billing`
- `http://localhost:4000/`
- `https://YOUR_DOMAIN/account`
- `https://admin.YOUR_DOMAIN`
- `https://admin.YOUR_DOMAIN/billing`
- `https://admin.YOUR_DOMAIN/`

Replace `YOUR_DOMAIN` with the actual domain where the app will run. Do not put the Google client secret or a Supabase service-role key in the browser app.

## 4. Configure the local app

Copy `web/.env.example` to `web/.env.local`, then fill in the project URL and the public publishable/anon key from **Project Settings → API**:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
VITE_SUPABASE_APPEND_ONLY_ATTEMPTS=false
```

Keep `VITE_SUPABASE_APPEND_ONLY_ATTEMPTS=false` until the additive SQL migration has completed in the same project. Set it to `true` only for the frontend deployment you are testing, then redeploy/rebuild; changing the variable does not affect an already-built static bundle. Restart the Vite development server after saving the file. The `.env.local` file is ignored by Git.

The API must be hosted separately from the static website/admin pages (Cloudflare Pages only hosts the static frontends). Configure these environment variables on a private Node API host:

```text
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
SUPABASE_NORMALIZED_QUESTIONS=false
ADMIN_ALLOWED_ORIGINS=https://YOUR_DOMAIN,https://admin.YOUR_DOMAIN
NODE_ENV=production
ADMIN_COOKIE_SAMESITE=None
UPIGATEWAY_USER_TOKEN=YOUR_PRIVATE_MERCHANT_TOKEN
PAYMENT_RETURN_URL=https://YOUR_DOMAIN/payments/return
```

For live Supabase project-usage metrics in the admin **Assets** panel, also set `SUPABASE_PROJECT_REF` and `SUPABASE_MANAGEMENT_ACCESS_TOKEN` on this private API host. The project reference is the ID in the project's `https://<project-ref>.supabase.co` URL. Create a Supabase Management API token for an account authorized for the project, and treat it as a highly privileged secret. Keep the token server-side only; never use a `VITE_` prefix or put it in a frontend environment setting. A sample variable list is in [`server/.env.example`](../server/.env.example). If these variables are not configured, project-level database, egress, MAU, and Realtime metrics remain unavailable rather than being inferred from app traffic.

Set `VITE_API_BASE_URL=https://YOUR_API_HOST/api` for both frontend builds so their requests reach this API. Include every website origin that calls the API in `ADMIN_ALLOWED_ORIGINS`, including the main site and admin site. `UPIGATEWAY_API_BASE` is optional and defaults to `https://free.upigateway.dev/api`.

In the UPIGateway merchant dashboard, configure the webhook URL as:

```text
https://YOUR_API_HOST/api/billing/webhook
```

The webhook is only a notification: this API re-queries UPIGateway's order-status endpoint and only grants access after the returned order ID, success status, amount, and UTR match the server's pending order. The browser redirect alone never grants access. Configure a real HTTPS production domain and test a pending payment, a failed payment, a successful payment, and repeated webhook delivery before enabling purchases for customers. If a merchant token has ever been exposed, revoke it and configure a newly generated token only in the API host's private environment settings.

The API also uses Supabase Auth to validate customer sessions. For local `npm run dev:admin`, the Vite config passes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to its local API process. The API independently validates Google admin access and creates random HTTP-only sessions. Admin and exam sessions are kept in API memory and lost on restart; run a single API instance for now. Payment orders and entitlements are stored in Supabase, but the current API still stores test content and uploads in local files. Before using a host that restarts or scales API instances, move that content/uploads to durable shared storage and move sessions to a shared store.

## What syncs

After sign-in, the app imports applicable study data already in that browser and syncs solved-question attempts (which drive the study calendar and analysis), bookmarks, notebooks, profile visibility, custom-test results, test-series sessions, and exam analytics. Active custom tests use a separate user-owned snapshot/checkpoint table: question content is uploaded once per active test, and compact answer/time/navigation progress is checkpointed every 90 seconds and when leaving the test. The Google account name/avatar and the editable profile name are stored in `profiles`. Public question content, admin content, and theme preferences are not copied as user data.

Data remains in the browser while signed out. On sign-out, the account-linked browser keys are cleared to avoid showing one user's records to another person using the same browser; the cloud copy is retained.

## Find and add friends

After running `friends.sql`, signed-in users can choose a unique username in **Account** and search for other usernames from **Friends**. Search results show usernames and display names, never account emails. Friend requests and accepted connections are stored in Supabase with row-level security and database functions.

The app now starts with Google sign-in. New accounts must choose a username before entering the study dashboard. `friends.sql` enforces username uniqueness in the database, case-insensitively, so two accounts cannot claim the same username even if they submit at the same time.

## Admin access, premium catalog, and payment status

The standalone admin site starts with Google sign-in. Only the two allowlisted Google accounts can access the content-management portal or `/billing`. The website API validates each sign-in before creating its admin session; client-side checks alone do not grant API access. Set exact production admin origin(s) in `ADMIN_ALLOWED_ORIGINS`.

The `/premium` page displays the Basic and Pro limits. Users submit a Pro request with their name, phone, and optional description; an admin must approve it before Pro access is enabled. The billing admin panel has the Pro request queue, Pro account controls, and editable price/card appearance. Its existing payment, legacy tier, test-series price, referral, and payment-report controls remain in the archived legacy section. The Test Series page displays an admin-set price for Basic accounts; Pro accounts have access to all test series.

The legacy customer checkout creates orders from the Supabase catalog on the API, uses the private merchant token only on the API, and confirms payments through the provider status endpoint before creating subscription or test-series entitlements. Test-series questions are returned only after the API authorizes the user's paid series. The new Pro request flow does not use this UPI checkout. Basic custom-test and previous-paper daily limits are checked in the API/database, and friend caps are enforced in the friend-request database functions. Pro applications, decisions, suspensions, and removals are managed through restricted database functions.

The UPI integration is not ready to accept live payments until you have run the SQL migration, configured all private production environment variables, deployed the Node API, set the provider webhook, tested real provider responses in a controlled environment, and verified the refund/support process. Do not put either private key in `web/.env.local`, any `VITE_*` setting, GitHub, or a chat message.
