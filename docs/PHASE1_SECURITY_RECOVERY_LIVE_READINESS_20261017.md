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


## Update — real production backup restored to an isolated project (2026-10-17)

**PASS: Real physical backup restoration and database verification.** User authorized an additional temporary recovery project at Supabase's quoted $9.68/month, and used the Supabase dashboard's **Restore to new project (BETA)** from the October 16, 2026 physical backup (screenshot showed `2026-10-16 09:46:39 UTC`). Destination: `Concierge-Phase1-Recovery-Test` (project ref `wfhwdtdwpnyxwusaklpl`) in the same Supabase organization and region `us-west-2`, separate from production `jtnyqzxlipekwtoyvcmb`. The destination reached `ACTIVE_HEALTHY` and accepted SQL queries. No source or test-branch mutation was performed.

Read-only comparison of the restored destination with production after restore:
- **44/44 public tables present**, **782/782 column definitions matched**, **103/103 public RLS policies matched**, **8/8 Storage RLS policies matched**, **5/5 private function definitions matched**, and **26/26 migration-history entries present**.
- Aggregate data content fingerprints (not only counts) matched for 13 representative datasets: `auth.users` (1), `profiles` (1), `fit_profiles` (1), `business_memberships` (1), `businesses` (1), `product_master` (27), `product_variant` (51), `retailer_offer` (32), and the empty inventory/order/purchase tables. These are **production** numbers; the two synthetic paid transactions were correctly isolated in the separate Supabase Test branch, not in the production backup.
- The restored project has the two Storage bucket definitions and zero Storage object metadata records, matching production. **Storage image bytes are not part of Supabase's managed database restore**, so blob recovery is a separate untested exercise.
- The new project has **no deployed Edge Functions**; they require separate redeployment, as do Auth settings and API key configuration. Do not connect the recovery project to Vercel apps, live Stripe, or callbacks. SQL under `anon` saw zero private profile rows and received permission denied on `public.businesses`, preserving the expected business read restriction.
- **Security caveat:** The restored project contains two `vault.secrets` rows, same count as production. No secret values were read or disclosed. Treat restored Vault metadata/credentials as sensitive and **delete the temporary recovery project promptly after the user's authorization**; do not publish its project keys or URLs. Security advisors for the new project also reported warnings for default Auth leaked-password protection and MFA settings, which would need configuration if this copy were ever used, but are not a reason to keep the disposable recovery project.
- **Not tested**: separately restored Storage binary images, live Auth sign-in within recovery with correct recovery Auth settings, active Edge Functions, outbound notifications, payment processing, measured RPO/RTO, or a destructive simulated total-service outage. The objective of this exercise was a real dated physical database restore and read-only validation, **which passed**.
- **COST:** The new recovery project is separate from the previously authorized Supabase test branch. Additional displayed monthly estimate was $9.68; billing ceases only after confirmed deletion of this temporary project. Do not delete the working test branch or production. No deletion has been authorized or attempted as part of this validation.
