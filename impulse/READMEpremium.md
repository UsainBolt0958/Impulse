# Impulse Premium, Payments, and Deployment Handoff

This file is the handoff for resuming the premium/payment setup. It records the current implementation and deployment status known on **November 1, 2026**. Hosting dashboards and secret values cannot be inspected from this repository, so deployment details marked **reported** are based on what the owner previously confirmed and should be checked in the relevant dashboard if anything has changed.

## Current status at a glance

- **Temporary free offer is enabled through January 1, 2027 (inclusive), India Standard Time.**
- Legacy subscription and test-series prices remain in Supabase; the Pro card uses separate regular/discounted price settings. The free offer does not modify either catalog.
- While the offer is active, the website header shows a free-offer notice, legacy UPI checkout is hidden, and the API refuses new payment-order requests. The Pro request form remains available.
- Test-series access is temporarily allowed by the API without checking for a purchase. This protects both the normal site flow and direct API requests from being blocked during the offer.
- At **January 2, 2027, 00:00 IST**, the temporary access check expires automatically. The site returns to its normal purchase/access rules, so payments must be configured and tested before that time if paid access should resume smoothly.
- The profile page's “Your data across devices” card was removed. Profile stats, saved data, and account syncing were not removed.
- UPIGateway order creation previously returned HTTP 400. No successful live payment has been confirmed. Payment handling should remain untested/disabled until a provider account can create and verify orders.
- The admin panel is **not known to be deployed as a separate live site**. The previously reported live frontend is the customer site only.
- The previous hosted paper/image data does not need to be preserved, per the owner. The new persistent storage work is local only until its SQL migration is run and the API is redeployed.
- The owner confirmed the previous hosted paper/image data does not need to be preserved. The Supabase persistence change starts future admin content from empty documents.

## Known deployed services

These are previously reported URLs, not credentials:

| Service | Known address | Status |
|---|---|---|
| Customer website (Cloudflare Pages) | <https://impulse-6mk.pages.dev> | Reported deployed |
| Node API (Render) | <https://impulse-api-2ggr.onrender.com> | Reported deployed; health endpoint previously returned `{"ok":true}` |
| API health check | <https://impulse-api-2ggr.onrender.com/api/health> | Use to check whether the API responds; it does not prove billing/provider configuration works |
| Admin frontend | None confirmed | Run locally or deploy as its own Cloudflare Pages project (instructions below) |

The Cloudflare account previously showed the GitHub project `UsainBolt0958/Impulse`. Its build was configured with repository subdirectory `impulse` as the root. Verify the repository, branch, and root-directory settings in Cloudflare before relying on them.

## Never put secrets in this file

Only variable **names** and the dashboard where they belong are documented here. Do not write secret values in this file, source code, GitHub, screenshots, support tickets, or chat messages.

Never expose or paste:

- `SUPABASE_SERVICE_ROLE_KEY`
- `UPIGATEWAY_USER_TOKEN`
- Google OAuth client secret
- Supabase database password
- Google browser cookies/session values, OTPs, or recovery codes

If a secret is exposed, revoke/rotate it with its provider and update the new value only in the appropriate private environment settings. The Supabase anon/publishable key is intended for frontend use, but still keep it configured only for its intended public client access.

## Temporary free-access switch

The date and message are in [web/src/lib/freeAccess.js](./web/src/lib/freeAccess.js):

- `FREE_ACCESS_END` is set to `2027-01-02T00:00:00+05:30`. This makes January 1 the last free day in India.
- `FREE_ACCESS_END_LABEL` is the display label, `January 1, 2027`.
- `useFreeAccessActive()` updates the UI when the cutoff is reached, even if a page remains open.

The server-side payment/access checks are in [server/billing.js](./server/billing.js):

- The `FREE_ACCESS_END` constant blocks new payment orders during the free period.
- `getSeriesAccess()` grants temporary test-series access during the same period.
- Keep the client and server cutoff dates identical if changing or extending the offer. The server is authoritative for payment/access decisions; changing only the banner or client code is not sufficient.

The header banner is rendered in [web/src/components/Header.jsx](./web/src/components/Header.jsx). Premium display/prices and hidden checkout controls are in [web/src/pages/PremiumPage.jsx](./web/src/pages/PremiumPage.jsx). Test-series UI access is in [web/src/pages/TestSeriesPage.jsx](./web/src/pages/TestSeriesPage.jsx).

### Extend the free period

1. Change `FREE_ACCESS_END` and `FREE_ACCESS_END_LABEL` in `web/src/lib/freeAccess.js`.
2. Set the exact same cutoff in `server/billing.js`.
3. Run the tests/build listed under **Validation**.
4. Deploy both the customer frontend and the Render API. The frontend and API are separate services.

For example, to make January 31, 2027 the last free day, the timestamp should be February 1 at midnight IST (`2027-02-01T00:00:00+05:30`) and the label should say `January 31, 2027`.

### Resume paid checkout before the automatic cutoff

If payments are ready before the automatic end date, move both cutoff constants in the two files above to a timestamp already in the past, update the label or remove the free-period wording as appropriate, then deploy the frontend and API. Do this only after checking the payment readiness checklist below.

If no code is changed, both the UI and API return to normal automatically on January 2, 2027 IST. That does **not** mean the gateway will be ready or that checkout will succeed.

## Deployment and configuration already reported

### Cloudflare Pages: customer frontend

Previously reported setup:

- Project: `impulse-6mk.pages.dev`
- Repository root directory: `impulse`
- Build command used after the Vite executable permission issue:

  ```sh
  npm install --prefix web && cd web && node ./node_modules/vite/bin/vite.js build --outDir ../dist/apps/web
  ```

- Output directory: `dist/apps/web`
- Frontend environment variable names were reported as configured:

  ```text
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  VITE_API_BASE_URL
  ```

- `VITE_API_BASE_URL` should point to the deployed API and end in `/api`, currently expected to be:

  ```text
  https://impulse-api-2ggr.onrender.com/api
  ```

Frontend `VITE_*` variables are embedded at build time. After changing them, trigger a **new Pages build/deployment**; editing a setting alone does not update an existing build.

### Render: Node API

Previously reported deployed service:

```text
https://impulse-api-2ggr.onrender.com
```

The API starts with:

```sh
node server/index.js
```

The following environment variable **names** were reported or are required by the implementation. Check the Render dashboard privately; their values are intentionally not recorded here.

| Variable | Purpose | Where |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Render API environment |
| `SUPABASE_ANON_KEY` | Public Supabase key used by API for Auth validation | Render API environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-only Supabase access | Render API environment only |
| `ADMIN_ALLOWED_ORIGINS` | Comma-separated exact browser origins allowed to call API | Render API environment |
| `NODE_ENV` | Production mode (`production`) | Render API environment |
| `ADMIN_COOKIE_SAMESITE` | Cross-site admin cookie setting; previously documented as `None` for production | Render API environment |
| `UPIGATEWAY_USER_TOKEN` | Private UPIGateway merchant token | Render API environment only |
| `PAYMENT_RETURN_URL` | Browser return route, expected `https://impulse-6mk.pages.dev/payments/return` | Render API environment |
| `UPIGATEWAY_API_BASE` | Optional provider API base; default is `https://free.upigateway.dev/api` | Render API environment, optional |

If using only the reported customer site, `ADMIN_ALLOWED_ORIGINS` must include exactly:

```text
https://impulse-6mk.pages.dev
```

Do not include a trailing slash. If you deploy an admin site or custom domain, add each browser origin as another comma-separated entry while preserving the existing entries. Render restarts/redeploys the service after environment changes; wait for it to be live and recheck `/api/health`.

The previous checkout logs showed:

```text
UPI Gateway order creation returned HTTP 400
```

The API did not log the gateway's response body, so the precise provider rejection reason is unknown. A healthy `/api/health` response does not test the UPIGateway token, merchant activation, UPI ID setup, catalog price, or provider request acceptance.

### Supabase: database and authentication

The owner previously reported that the relevant SQL migrations were run successfully. Do **not** rerun migrations just because the frontend or API is redeployed. The setup guide is [supabase/SETUP.md](./supabase/SETUP.md).

The migrations for the complete app are run in this order where not already completed:

1. `supabase/schema.sql`
2. `supabase/friends.sql`
3. `supabase/premium.sql`
4. `supabase/admin_access.sql`
5. `supabase/pro_access.sql` (after `friends.sql`, `premium.sql`, and `admin_access.sql`)
6. `supabase/upi_payments.sql`
7. `supabase/persistent_admin_storage.sql`

The Pro access migration adds the application queue, manual entitlements, and Basic usage enforcement. The payment migration depends on the premium/admin schema. The persistent admin storage migration creates the API-only content table and a public bucket for images. It does not import content from Render's local files; the owner said the old papers/images are not needed. Run these migrations before deploying the matching API code. Catalog prices are stored in Supabase, so the free offer does not require changing those rows.

Google sign-in settings:

- Supabase **Authentication → URL Configuration** should use the deployed site as the production Site URL.
- Add `https://impulse-6mk.pages.dev/account` to the allowed redirect URLs (plus localhost redirect(s) only if local development is needed).
- In Google Cloud OAuth, the authorized redirect URI is the **Supabase callback URL** shown in Supabase's Google provider settings, not the Cloudflare site URL.
- Admin sign-in uses the current admin page origin/path as its redirect. Add the admin site's origin/path to Supabase's redirect allowlist after deciding on its deployed URL.

The admin allowlist is configured by `supabase/admin_access.sql` and in the server's existing approved-email list. Only the intended admin Google accounts should be allowed. Do not make a public account an admin to troubleshoot deployment.

## Admin website

The admin frontend is a separate Vite entry point. Locally, run:

```sh
npm run dev:admin --prefix web
```

It opens at:

```text
http://localhost:4000
```

It needs the API available at port `4001`. The admin Vite configuration can start a local API process. Local Supabase frontend configuration is in `web/.env.local`; use `web/.env.example` as the template and do not commit `.env.local`.

To deploy the admin frontend as a separate Cloudflare Pages project:

1. Create a new Pages project from the same GitHub repository and production branch.
2. Set the repository root directory to `impulse`.
3. Use a build command equivalent to:

   ```sh
   npm install --prefix web && npm run build:admin --prefix web
   ```

4. Set output directory to:

   ```text
   dist/apps/admin
   ```

5. Add frontend build environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` (the same deployed API URL ending with `/api`).
6. Add the chosen admin origin to Render's `ADMIN_ALLOWED_ORIGINS` and Supabase's allowed redirect URLs, then redeploy the API and rebuild the admin frontend.
7. Test admin Google sign-in using an allowlisted account, then verify access to the content manager and `/billing`.

Choose and record the eventual admin URL in this document after deployment. An address such as `admin.yourdomain.com` requires a domain you own and DNS configuration; it is not automatically created by the customer Pages project.

## What the current free offer does and does not do

- Makes existing paid test series accessible through the server-side exam authorization path during the offer.
- Leaves legacy subscription and test-series price records unchanged.
- Hides premium subscription checkout and stops new payment-order creation while the offer is active.
- Shows the temporary offer notice at the top of pages using the shared site header.
- Does **not** rewrite historical orders, issue refunds, create paid subscription records, or create test-series purchase rows for free use.
- Enforces Basic limits of three friends, five custom-test starts per India calendar day, and three previous-paper starts per India calendar day through the Pro access migration. Approved Pro accounts bypass these limits and receive test-series access; admins can suspend or remove Pro access.
- Does **not** guarantee the gateway will start working when the offer ends.

## Payment readiness checklist before charging anyone

Do not enable paid checkout just because the free offer expires. First:

1. Confirm with the provider that the merchant account is active and the receiving UPI ID is verified. The merchant dashboard previously showed a PhonePe merchant with status **Deactive**; use the provider's legitimate dashboard/support process to resolve status.
2. Confirm eligibility and required KYC directly with the provider and bank. Do not enter browser cookies, Google session tokens, OTPs, or recovery codes into a payment-verification form unless the provider's verified support explains the process and it is clearly required.
3. Check Render's private environment variable names and values without sending them in chat. Rotate any token that may have been exposed.
4. Confirm the Cloudflare API URL and the exact customer/admin CORS origins.
5. Confirm the Supabase prices and that the relevant products are enabled.
6. Configure provider webhook URL to:

   ```text
   https://impulse-api-2ggr.onrender.com/api/billing/webhook
   ```

7. Test pending, failure, success, wrong-amount, duplicate-notification, and status-refresh behavior in a controlled provider-supported environment. Confirm the API only grants access after reconciling provider status with order ID, amount, and UTR.
8. Verify support/refund handling and do not use a real customer payment as the first integration test.

Checkout normally uses the authenticated customer's Indian mobile number and server-side catalog price; it does not accept a price supplied by the browser as authoritative. Provider HTTP 400 errors require the provider's specific rejection response/support explanation; never disclose the merchant token when requesting support.

## Local development and validation

Install dependencies from the repository root if they are not already installed:

```sh
npm install
npm install --prefix web
```

Run the customer website:

```sh
npm run dev --prefix web
```

Run the admin frontend:

```sh
npm run dev:admin --prefix web
```

Run builds and focused offer tests:

```sh
npm run build --prefix web
npm exec --prefix web -- vitest run --config web/vite.config.js web/src/lib/freeAccess.test.js web/src/pages/TestSeriesPage.test.js web/src/lib/premiumCatalog.test.js
node --check server/billing.js
node --check server/index.js
```

The production frontend build and the focused six tests passed after the free offer was implemented. A full frontend test run previously had unrelated failures from tests expecting files under a different `public` path and UI tests without a DOM environment; investigate those separately if they recur.

## Resume checklist for the next work session

1. Read this file and [supabase/SETUP.md](./supabase/SETUP.md).
2. Check whether the current date is still within the free period and whether the two cutoff constants still match.
3. Check Cloudflare Pages production deployment and the Render API deployment/health endpoint.
4. Confirm whether the admin site has since been deployed; if so, record its URL and add it to CORS/Auth settings.
5. Before re-enabling payments, resolve UPIGateway's inactive merchant/HTTP 400 issue and test the complete lifecycle safely.
6. After any code changes, build/test locally, push through the project's normal Git workflow, and wait for both affected services to redeploy.
