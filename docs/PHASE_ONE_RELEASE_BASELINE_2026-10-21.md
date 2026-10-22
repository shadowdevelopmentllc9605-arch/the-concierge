# Phase One release baseline — 2026-10-21

Owner: Shadow Development LLC. This is a **read-only baseline and release policy** captured after the independent development audit, not a claim that the pilot has passed end-to-end testing.

## Scope decision

**Pilot goal:** Demonstrate one real shopper moving from a verified retailer offer to discovery, wishlisting/cart, an authorized purchase or in-store assisted interaction, and correct shopper/retailer records. Begin with a small verified catalog and one committed retailer. Expand only after this closed loop is proven.

**Do not block this pilot on:** nationwide retailer catalogs, thousands of estimates-only sizing charts, photo-based measurement calibration, virtual/smart mirrors, full AI fashion intelligence, advanced store floor-plan editing, broad social features, production body-scan uploads, or non-pilot notification campaigns.

**Do not compromise on:** correct app identity and business permissions; ownership/RLS; accurate price and availability; reliable payment and webhook idempotency for any enabled checkout; order and stock reconciliation; secure enabled uploads; recovery of active customer/retailer data; safe tax/Stripe settings before any live charges.

## Audited deployment baseline (before this PR)

- Shopper repository: `shadowdevelopmentllc9605-arch/the-concierge`; main commit `5c42e477e284f2fb10528264c438b1f5b622e64e`.
- Retailer repository: `shadowdevelopmentllc9605-arch/concierge-pro`; main commit `9b7fd3c5438009ff33ff5f9ef1eac36e32ec85e1`.
- Vercel production deployments for these commits were reported **READY**, which does not establish successful sign-in, commerce, or user-journey testing.
- Supabase shared project: `jtnyqzxlipekwtoyvcmb`, healthy at the project level in the audit.
- Supabase branching reported `main: MIGRATIONS_FAILED`; this is a Git-linked branch/migration status, not proof that production schema is absent.
- An active temporary testing branch `phase1-e2e-20261016` was still reported. Do not delete it until relevant artifacts/results are retained and active test work is finished.
- At the last read-only database count: 27 product masters, 51 variants, 32 offers, 441 sizing charts, one business, zero retailer inventory rows, zero production orders, zero production purchases. These counts do not prove sandbox tests failed; they show that a real pilot is not yet evidenced in production.
- Live commerce/tax registration and local retailer participation are **not verified** by these infrastructure facts.

## Release rules to eliminate rework

1. Make **one coherent pull request per repository**, review both together, and do not merge by default merely because Vercel reports READY.
2. Require a strict `npm ci` install against committed lockfile, production dependency audit, application lint, unit tests, and a build. Source-inspection tests alone do not count as customer-journey tests.
3. Require browser/mobile checks for startup, route deep-linking and navigation on both deployed previews. The failure that displayed `SCRIPT_ERROR` on October 17 and in an October 21 preview must never reappear.
4. Require a real Supabase-authenticated shopper **and** retailer to exercise allowed/denied storage and business operations on isolated synthetic accounts. Keep test-only diagnostic routes out of production builds.
5. Run one complete synthetic transaction with an exact retailer offer, variant, price, quantity, Stripe sandbox session, webhook event(s), refund/retry checks, stock decrement, purchased-line display and shopper history. Capture transaction evidence without storing card numbers or secrets.
6. Verify readable records and downloadable image bytes from a **separate recovery target**, but distinguish real backups from manual synthetic drills. If sensitive photo ingestion is disabled, its full production backup pipeline is not a pre-pilot dependency.
7. Gate production promotion on all applicable checks. Record one shopper SHA and one retailer SHA as the tested release pair, then perform post-deploy smoke checks; do not repeatedly deploy one-off documentation and micro-fixes.
8. Keep a single dated blocker list with reproducible symptoms, root cause, test evidence, and owner/action. Do not repeat a previously failed workaround without explaining what changed.

## Test matrix

| Test | Required evidence | Baseline assessment |
| --- | --- | --- |
| Shopper startup on Android | Open preview and production, check navigation and error boundary | Historical regression; re-test required |
| Retailer startup and account isolation | Open **retailer** URL, existing/new account behavior, proper roles | Historical incorrect redirect; re-test required |
| Retailer creates/edits one product | Persisted listing with price and stock in correct business | Production inventory not evidenced |
| Shopper catalog to cart | Correct retailer/variant, price, wishlist and checkout navigation | Code unit tests exist; device E2E required |
| Stripe synthetic checkout to purchase | Correct order, webhook, retailer purchase lines and one stock decrement | Some synthetic tests reported; unified evidence required |
| Cross-account images | Authenticated allowed/denied read/write/list and correct restored bytes | Separate tests/screenshots exist; record final gate evidence |
| Data recovery and cleanup | Dated verified result plus retained manifest | Pending evidence review |
| Live Stripe/tax release | Legal/tax and provider readiness verified, not inferred | Not established |
| Local pilot participants | At least one willing retailer and real shoppers | Retailer not yet secured |

## Currently known dependencies and exclusions

- Keep private body-scan collection disabled until authorization, backup, restore and consent/retention requirements are actually met; retain manual sizing / safe skip where implemented.
- No new custom domain purchase is required; the Wix site remains on the existing free subdomain unless expressly changed.
- The user's working environment is **Android + Termux**. Avoid desktop-only steps.
- Do not activate live charging or delete historical backups solely because a pull request merges.

## Test-branch reconciliation

The Supabase Git-linked main branch marked `MIGRATIONS_FAILED` needs a **non-destructive** read of its latest failing migration/version against committed migrations. Preserve historical production migrations. Resolve only the verified mismatch; do not replay or reset production as a guess.

Once test evidence has been archived, close unused hourly-billed preview/testing branches (including `phase1-e2e-20261016`) in a deliberate cleanup step.

## Definition of done

Phase One **technical readiness** requires the green applicable release gates and a tested, paired deployment with no major open blockers. **Commercial pilot launch** separately requires real retailer acceptance, tax/charge readiness if payments are enabled, and actual shopper participation. Do not conflate the two.

## Verified delta — 2026-10-22 (read-only audit; updates historical baseline)

This dated delta supersedes stale release-status claims above **where noted**, without removing historical evidence. Do not recreate synthetic entities or reopen verified controls simply because an older test matrix marked them pending.

### Completed/configured and independently checked

- **Production deployment availability:** both Vercel project main builds report READY. Shopper deployed production SHA `282156149f44ef572b8fd85a84a2284fbc78aaca`, retailer deployed production SHA `72877be1a904c43ecef965509597650923b3e508`. Both had **no grouped runtime errors reported over the previous 24 hours** as of this audit. This is not browser/session E2E proof.
- **Production Supabase:** `jtnyqzxlipekwtoyvcmb` reports ACTIVE_HEALTHY; direct SQL found **zero public application tables with RLS disabled**. Security advisor returned no warning/error-level findings, but did return informational notices; not a claim that the system is vulnerability-free. [Supabase linter](https://supabase.com/docs/guides/database/database-linter).
- **Existing email users:** direct production Auth query showed **3 users; all 3 email-confirmed and all 3 with prior sign-in**. The owner separately confirmed successful SMTP invitation and password-recovery messages and a working password reset on October 21. This finishes the tested email verification/recovery path. Production email-link action was deliberately hidden in both applications until broader SMTP delivery certification; do not interpret that gate as failed user email verification.
- **Storage controls:** direct production SQL verified `concierge-sensitive` is private, `concierge-uploads` public, both allow only JPEG/PNG/WebP; limits **15 MiB private and 10 MiB public**. The production buckets currently contain **zero objects**, so their empty backup cannot establish populated production-image recovery.
- **Backend release work:** migrations `phase1_retailer_setup_column_grants_20261017`, `phase1_paid_order_stock_sync_20261017`, `phase1_prod_storage_image_size_and_mime_limits`, and `phase1_prod_public_bucket_listing_owner_only` are recorded as applied. Do not redeploy these as hypothetical missing changes.
- **Tests already built:** merged changes include real `age` encrypt/decrypt tests, synthetic-image byte/hash recovery in isolated directories, and safe manually triggered cross-branch Storage restore and cross-account API test harnesses. This does **not** prove that every protected manual workflow was executed or that recurring backups are commissioned.

### Existing synthetic catalog and transaction fixtures — use, do not recreate

Read-only counts on October 22:

| Environment | Product masters | Variants | Offers | Businesses | Retailer inventory rows | Orders | Purchases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Production `jtnyqzxlipekwtoyvcmb` | 27 | 51 | 32 | 1 | 0 | 0 | 0 |
| Isolated branch `cbqxcbvjezehxowarkoq` (`phase1-e2e-20261016`) | 1 | 1 | 1 | 1 | 0 | 3 | 3 |

Next end-to-end test should **reuse the existing isolated business, offer, transactions, and synthetic identities**, inspect retailer inventory write/read mapping rather than assume no inventory exists, then verify authenticated shopper checkout, webhook idempotency/stock debit, Pro order rendering, refunds and accurate closet records. Do not run live charges or contaminate production with synthetic orders.

### Open release gates, narrowed by evidence

1. **Visual release:** October 21 appearance fixes exist in tested but diverged preview branch. Safe extracted PR [#38](https://github.com/shadowdevelopmentllc9605-arch/the-concierge/pull/38) is based on current main; release only after checks pass and a real Android preview smoke test. Do **not** merge the old diverged branch.
2. **Unification of E2E evidence:** reconcile existing synthetic checkout orders/offer and perform the paired shopper and retailer flows using real authenticated sessions; check product visibility, quantity decrement, refunds and order/closet history. Do not claim a single clean production signoff based only on backend fixture existence.
3. **Recovery:** distinguish the prior real production database-backup restore and synthetic image recovery tests from a scheduled encrypted image backup pipeline; commission only the applicable backup requirements for enabled assets. Private body scans remain disabled and their production backup pipeline is **not** a lean pilot blocker unless uploads are enabled.
4. **Deletion:** no supported complete automatic Auth + app-record + Storage-object erasure flow verified. PR #38 truthfully presents an email deletion-request workflow; implement end-to-end verified deletion/retention separately before claiming automatic erasure.
5. **Live commercial:** tax/registration applicability and live Stripe merchant onboarding remain outside sandbox proof. One committed pilot retailer and real shopper feedback are commercial launch gates, not reasons to repeat synthetic technical setup.

### Execution discipline

- Progress claims must be labeled `implemented`, `CI-tested`, `isolated E2E verified`, `production-configured`, or `production journey verified`. A green Vercel build alone earns only `deployed READY`.
- Record new facts in **this existing baseline**; do not create a parallel tracker. Each blocker must have exact missing evidence and the next safe action.
- Prefer working directly through connected GitHub/Vercel/Supabase tools. Only request Android/Termux input for a genuinely unavailable browser-only visual check or a required protected secret/approval.

### October 22 additional transaction-linkage audit (isolated branch, read-only SQL)

For existing synthetic branch `cbqxcbvjezehxowarkoq`: **3 orders / 3 purchases / 3 order items / 3 purchase items**. All three orders have `payment_status=paid` and `pro_sync_status=completed`; all three purchases have `status=completed` and `purchase_type=online`. All orders have a linked purchase and all purchases have a linked order (both unmatched counts zero). The single offer's stock is **7** after the three purchases, consistent with the previously reported stock-10 fixture. These facts confirm persisted linked, paid synthetic records and stock state; they do not establish Stripe webhook replay/idempotency, refunds, a new signed-in shopper journey, or retailer dashboard visibility. **Do not re-create the synthetic merchant, offers or purchase records to repeat these already established database facts.** Focus remaining validation on authenticated interface access, rendered order lines/closet and deliberately isolated failure/retry cases.


## October 22 continuation — release gating and shopper purchase display

This continuation is the status after additional work on the **same** controlled PR #38; older status notes above remain historical.

- **Automated checks:** PR #38 commit `5bff58e` passed GitHub Actions validation (dependency installation, production audit, tests, real age encryption tests, build, lint). Later commits extending the preview with shopper purchase-line rendering require their own new green run. Vercel `READY` and an HTTP 200 document response do not prove React boot or an Android authenticated session.
- **Verified synthetic database reconciliation (read-only, branch `cbqxcbvjezehxowarkoq`):** 3 paid orders, 3 completed purchases, 3 `order_items`, 3 `purchase_items`, 3 Pro-synced orders, 0 unlinked orders, and 0 purchases missing line details. Reusing existing transactions; no new payment or synthetic account created.
- **Shopper display issue identified and patched in PR #38:** the shopper `Purchase` adapter previously selected only `purchases.*`; `Closet` expected legacy product fields that are absent from the current `purchases` table. The adapter now fetches `purchase_items(*)`, normalizes sizes, colors, prices and quantities, and `Closet` renders the existing lines with a legacy fallback. New pure mapping tests added. This is **implemented in preview branch**, not independently confirmed as a signed-in shopper experience or yet released to production.
- **Retailer distinction verified (read-only):** `retailer_offer` has 1 offer with stock 7 and `purchases` has 3 online rows, while `inventory_items` contains 0 rows in the isolated test branch. Concierge Pro Home's Recent Online Orders reads business-scoped Purchase records including purchase lines; Concierge Pro Inventory reads the separate `inventory_items` table. Thus successful stock decrements are verified in the offer layer, but **retailer inventory-screen visibility/synchronization remains an explicit E2E gap**, not evidence that orders failed. Resolve mapping/UX deliberately, without manufacturing or duplicating inventory records.
- **Android smoke and release:** the updated release preview still requires authenticated Android checks for all eight style images, Home/onboarding consistency, white deletion dialog, startup errors and Closet purchases. Do not merge PR #38 or activate live Stripe from the preview build alone. Record and close any responsive/UI failures first.


## October 22 Android visual acceptance and retailer-offer follow-up

**Owner's real Android preview walkthrough (reported, not an automated E2E test):**

- **Visually checked:** Home layout, Shop layout, In-store location-detection and manual-store choices, empty wishlist, Profile, empty digital closet with photo/upload controls, Payment/Shipping empty states, Notifications empty state, Reviews/Feedback empty state, Precision Photo Scan foot/hat options, Friends email invitation choice, seven FAQs, Support actions, and the white high-contrast Request Account Deletion popup with its truthful non-automatic email-request wording and Cancel / Compose request controls. Owner reported no appearance or navigation problems during this walkthrough.
- **Not claimed tested:** Actually detecting location, selecting a retailer, uploading images, adding a friend, storing a card/address, receiving notifications, taking a photo scan, submitting a review, sending a deletion email, erasing customer data, or viewing an existing paid test purchase in a genuine signed-in shopper session. Visible controls and appropriate empty states are **UI smoke acceptance**, not completed workflows.
- **Shop listing imagery:** Existing shopper product pictures were missing from the preview. Owner recognizes pilot inventory images still need to be supplied; do **not** invent product images or call actual retailer catalog/photo readiness complete.
- **Later scope:** Facebook, Instagram, TikTok, Snapchat and other social-media contact connections are **requested future enhancements**, not part of the small Phase One pilot. Preserve email-based friends UI; do not claim third-party contact imports already work.
- **Retailer gap root cause (read-only inspection):** Isolated test branch's original canonical T-shirt offer has stock 7 in `retailer_offer`, while `inventory_items` is still empty. The offer's business ID joins the actual synthetic business. These are separate retail catalog and local inventory models. Do not create a duplicate stock row as a workaround.
- **Pro implementation in progress:** [Concierge Pro PR #18](https://github.com/shadowdevelopmentllc9605-arch/concierge-pro/pull/18) adds a **read-only online storefront offers panel** in Inventory using the signed-in retailer's business ID, current offer price/stock and product/variant labels. It intentionally leaves legacy local inventory controls, payment state and backend stock records intact. PR must pass automated validation plus an authenticated test-retailer UI check, and paired shopper/retailer testing remains open. This is a display reconciliation, not a verified bidirectional inventory-sync implementation.
- **Release status:** Shopper PR #38 passed CI and Vercel preview checks for its last audited SHA and received the owner's reported Android visual acceptance. Neither shopper PR #38 nor retailer PR #18 should be called live production without checking current merge and deployed SHAs first.
