# Premium plans and legacy payment archive

## Current customer flow

- **Basic:** free; unlimited PYQ practice, up to 2 different previous papers per day, 5 custom tests per day, and 3 friends.
- **Pro:** one year of complete access with no usage restrictions; the initial catalog price is ₹799 and admins can update the displayed price in the portal.
- Students apply with their name and phone number while signed in with Google. An administrator follows up to arrange checkout and approves the application only after payment is confirmed. Approval grants one year of Pro access.
- The Basic daily limits reset at midnight India time. API-backed previous-paper starts and custom-test generation are quota-checked by the API/database. Friend limits are enforced when a connection is accepted.
- Legacy standalone JEE Advanced paper HTML files are static assets and cannot be protected by these server quotas. Migrate or remove those public files before treating the 2-paper cap as complete for every old URL.

## UPI and legacy records

UPI checkout, payment-status, and webhook routes are disconnected. The old checkout component and payment-return page have been removed, and the database migration revokes execution of the legacy order RPCs. Do not configure or send UPI credentials for the current app.

Existing payment and subscription records remain in Supabase. Billing administrators can view the legacy reports in **Admin Portal → Pro access → Archive**. Keep the legacy payment tables and `get_billing_admin_summary()` function while historical records are needed.

## Database setup

For a new project, run the existing core schema, friends, premium, and admin migrations as described in [supabase/SETUP.md](./supabase/SETUP.md). Then run [supabase/pro_memberships.sql](./supabase/pro_memberships.sql) after `premium.sql`, `admin_access.sql`, `friends.sql`, and (if present) `upi_payments.sql`.

The membership migration adds application review, one-year Pro activation, suspend/remove actions, Basic daily-usage tracking, the three-friend cap, and disables legacy payment RPC execution. It has not been applied to any hosted Supabase project from this workspace.

## Deployment status

The code changes are local to this workspace. The SQL migration has not been applied, and the frontend/API have not been deployed. Apply the migration before using Pro applications, admin membership controls, or server-enforced Basic quotas.

Validate changes with:

```sh
npm run build --prefix web
npm exec --prefix web -- vitest run --config web/vite.config.js web/src/pages/PremiumPage.test.jsx web/src/pages/TestSeriesPage.test.js web/src/lib/premiumCatalog.test.js
node --check server/billing.js
node --check server/index.js
```
