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
