# Draft repair plan — Supabase migration history mismatch

**Status: PLAN ONLY. The 24 original migration SQL files have NOT yet been restored. Do not merge this draft until that is done and checked.**

## Observed failure

Supabase Git-branch workflow for `main` fails with: `Remote migration versions not found in local migrations directory.`
Production project ref: `jtnyqzxlipekwtoyvcmb`. The production database is healthy, but this error blocks clean rebuilding of a development database.
`supabase_migrations.schema_migrations` has 26 applied migration versions with stored SQL statements. Only the final two SQL files currently exist in this repository.

## Required file restoration

Recover the exact SQL represented by `supabase_migrations.schema_migrations.statements` for the following 24 versions. One file per version in `supabase/migrations/`:

- `supabase/migrations/20261007213456_create_shared_catalog_core.sql`
- `supabase/migrations/20261007213535_harden_private_catalog_objects.sql`
- `supabase/migrations/20261007215429_identity_profile_fit_foundation.sql`
- `supabase/migrations/20261007215645_claim_base44_identity_on_auth_signup.sql`
- `supabase/migrations/20261007215748_identity_staging_indexes.sql`
- `supabase/migrations/20261007220705_shopper_closet_wishlist.sql`
- `supabase/migrations/20261007220924_retailer_business_locations.sql`
- `supabase/migrations/20261007221138_retailer_employees_permissions.sql`
- `supabase/migrations/20261007221322_retailer_inventory_management.sql`
- `supabase/migrations/20261007221516_store_customer_interactions.sql`
- `supabase/migrations/20261007221743_commerce_orders_checkout_foundation.sql`
- `supabase/migrations/20261007221927_notifications_foundation.sql`
- `supabase/migrations/20261007222000_ai_feedback_history.sql`
- `supabase/migrations/20261008013815_create_concierge_uploads_bucket.sql`
- `supabase/migrations/20261008014530_add_remaining_concierge_entities.sql`
- `supabase/migrations/20261008014607_add_checkout_session_reference.sql`
- `supabase/migrations/20261008022248_add_brand_size_charts.sql`
- `supabase/migrations/20261008022524_secure_webhook_runtime_secret_access.sql`
- `supabase/migrations/20261008022535_stripe_webhook_event_rpcs.sql`
- `supabase/migrations/20261008022544_stripe_processor_reference_rpcs.sql`
- `supabase/migrations/20261008023423_atomic_cash_sale_rpc.sql`
- `supabase/migrations/20261008025229_release_hardening_fk_indexes_and_rls.sql`
- `supabase/migrations/20261008031605_optimize_auth_rls_initplans_v2.sql`
- `supabase/migrations/20261014143728_separate_sensitive_uploads_and_scope_storage_ownership.sql`

The two newest files already in GitHub must remain unchanged:
- `supabase/migrations/20261015032300_retry_failed_stripe_webhook_events.sql`
- `supabase/migrations/20261015032507_make_online_purchase_items_idempotent.sql`

## Safe recovery sequence (review required)

1. Confirm which GitHub repository is actually connected to Supabase Branching. This repository (`the-concierge`) should be the single authoritative migration source for the one shared database, not a separate divergent copy in `concierge-pro`.
2. Read the stored SQL statements for each listed version from the **production migration registry** using a privileged **read-only query**. Reconstruct the SQL files with the exact recorded names/versions and contents; do not invent empty placeholders, remove applied history rows, or run `migration repair` merely to suppress the error.
3. Security-review the recovered statements *before committing to this public repository*: check for actual secrets, personal data, service-role keys, signed URLs, and privileged definitions, including any `SECURITY DEFINER` function and RLS/grant patterns. Block and escalate any potential sensitive contents.
4. Compare the two existing latest migration files against the corresponding recorded SQL. If different, investigate rather than silently overwriting them.
5. Before any database recreation or preview, obtain approval for any additional cost; do not reset, restore over, or modify the working production database.
6. Validate all 26 ordered migrations against a fresh **isolated** database, starting from an empty schema. Do not import real customer or payment data. Run access-control/RLS checks, regression tests, and a safe Stripe sandbox checkout and webhook test only after configuration isolation.
7. Once the migration replay passes, confirm the Supabase branch transitions out of `MIGRATIONS_FAILED`, run GitHub checks and both Vercel preview/release gates, and only then consider merging.

## Safety boundaries

- No production data, migration-history rows, Stripe keys, webhook secrets, branch resets, database restores, or live checkout settings were changed in preparation of this draft.
- This PR documents the fix and is intentionally incomplete. It does **not** itself fix Supabase branching.
- Vercel `READY` by itself does not prove database migrations or end-to-end payments passed.

## Source notes

Original records: Supabase `supabase_migrations.schema_migrations` (`version`, `name`, `statements`). Failure observed in `main` branch workflow logs October 15, 2026.
