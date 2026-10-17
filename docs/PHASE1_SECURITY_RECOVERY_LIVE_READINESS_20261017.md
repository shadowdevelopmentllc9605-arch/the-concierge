# Phase One — image isolation, recovery, and live retailer readiness
Run date: 2026-10-17 UTC. **All database permission tests were performed on the isolated Supabase test branch**, not production.

## Confirmed automated security results (SQL-role simulations, not browser uploads)

Project: test branch `cbqxcbvjezehxowarkoq`; Auth accounts: synthetic shopper and synthetic retailer, both confirmed.

- `concierge-sensitive` is private, `concierge-uploads` is intentionally public.
- Shopper and retailer identities (Postgres `authenticated` plus `request.jwt.claim.sub`) each saw 1 own private object record and 0 private object records belonging to the other synthetic account.
- Each user could insert test Storage **metadata records** under both of their own bucket prefixes; cross-account writes to both private and public bucket prefixes were rejected with a row-level security violation.
- Each user could not modify the other's private object metadata (0 update rows).
- Anonymous identity saw 0 private and 2 public object records.
- Every SQL fixture was inserted and examined **inside a rolled-back transaction**; there was no real uploaded blob. Check: the test still has 0 storage objects.
- Native `storage.objects` deletion is blocked by Supabase's Storage API trigger. Do not use SQL DELETE to test actual object deletion; use the authenticated Storage API.

**Gate still open:** Actual Storage HTTP/API uploads of image bytes with each signed-in synthetic account; signed private URL read by owner; refusal for the other account's private read/delete; public read; test sizes/types; verify cleanup. Browser upload or a controlled authenticated API test is required. Never equate the SQL metadata fixture with successful blob delivery.

## Recovery rehearsal (not proof of a real backup)

- Safely snapshotted test-branch rows into temporary PostgreSQL tables; reconstructed the rows into separate temporary tables; compared `EXCEPT ALL` in both directions; rolled back everything.
- Zero mismatched rows across businesses (1), product masters (1), variants (1), offers (1), orders (2), order items (2), purchases (2), purchase items (2). Also checked empty profile/scan and Storage metadata tables.
- This proves an **in-database logical row round-trip only**. It did NOT obtain or restore a dated managed backup, test a separate recovery target, recover Auth, restore Storage bytes, test Edge Functions in a restored project, or measure restore time/RPO.
- The Supabase organization reports `pro`. Current Supabase documentation says Pro includes **daily managed backups with 7-day retention**; availability of any specific date is not verified through the connected API. To verify, review [Supabase Production — Database > Backups](https://supabase.com/dashboard/project/jtnyqzxlipekwtoyvcmb/database/backups/scheduled).
- **Do not invoke `restore_project` against production**. Managed restore can make the source project unavailable and may overwrite live data. For a truly isolated test, export a logical backup and import it into a separately authorized target. Storage bytes require a separate secured backup; database backups contain only Storage metadata.

## Live Stripe Tax and retailer readiness (read-only audit)

- Stripe account (Shadow Development LLC **live mode**): Tax settings `active`; registration list contains **0 registrations**. No tax-registration/legal determination was made. Decide applicable registration and tax obligations with qualified tax help before collecting live marketplace taxes.
- Stripe live Connect: **0 connected retailer accounts**. The successful synthetic Connect test does NOT onboard a real retailer.
- Two enabled live webhook endpoints currently point to production Supabase `stripe-webhook`, but their event lists are disjoint: one `account.updated`, the other checkout/subscription/payment events. The disabled legacy Base44 endpoints remain disabled.
- Production app readiness and real tax registrations must be reverified for the first authorized pilot merchant, location, product tax category, billing plan, and fulfillment jurisdiction. Do not use synthetic trialing business values in production.

## Separate release gates

- **PASS**: RLS database-level two-account image owner isolation (read/insert/update) and anonymous private read denial.
- **PASS (limited)**: Isolated transaction-only logical row copy/recovery; not a backup restore.
- **OPEN**: Authenticated image blob API and URL tests, deletion test via Storage API, and signed/private access.
- **OPEN**: Actual dated backup + isolated restore + Storage bytes + post-restore Auth/app/payment tests.
- **OPEN**: Live tax registration determination, genuine retailer Connect onboarding, live subscription status, production checkout approvals.
- **PRODUCTION NOT CHANGED**. This document is audit evidence, not an authorization to merge the preview branches or activate live checkout.


## Update — completed two-account browser image upload tests (2026-10-17)

**PASSED — private shopper image bytes:** The synthetic shopper uploaded a real 3.2 MB JPEG to `concierge-sensitive/<shopper-uid>/...` through Precision Photo Scan. Initial signed-URL retrieval produced no onscreen image; the app was repaired to use authenticated Storage `download()` and a local revocable blob URL. The shopper reopened the preview with **Load Last Private Photo** and saw the TEST image. Supabase storage logs independently show a successful 200 download of the private object.

**PASSED — public retailer image bytes:** The synthetic retailer uploaded a real JPEG through the post-onboarding **Upload test store image** control. The user confirmed the image preview and **Store image uploaded and saved** message. Supabase contains one JPEG in `concierge-uploads/<retailer-uid>/...`, and `public.businesses.logo_url` points to that exact object in the test project's public bucket. The correct business-owner identity was verified.

**PASSED — RLS on those exact persisted objects:** Impersonation at the PostgreSQL RLS layer (`SET LOCAL ROLE authenticated` and `request.jwt.claim.sub`) verified:
- Shopper: own sensitive object **1**, other sensitive **0**, public objects **1**.
- Retailer: own sensitive **0** (none uploaded), shopper sensitive **0**, public objects **1**.
- Anonymous role: private **0**, public **1**.
- Earlier rolled-back insert/update tests blocked cross-user paths. No production data mutated.

**Coverage boundary:** Private cross-account refusal above is an RLS-level test on actual object rows, not a second signed-in browser's attempt to download another user's private URL. Storage API cross-account read/delete tests and deletion/cleanup via the Storage API remain unverified. Do not upload genuine body scans into test branches until the security/recovery gates are fully cleared.

**Recovery remains OPEN:** Transaction-only logical round-trip passed earlier but is not a dated managed backup restore. Need isolated recovery target, actual dated backup verification, a separate Storage-blob recovery, and post-restore app/auth smoke tests. Do not restore over production or the current checkout-evidence branch.
