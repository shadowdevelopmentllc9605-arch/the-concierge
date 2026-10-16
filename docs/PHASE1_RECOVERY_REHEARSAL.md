# Phase One recovery rehearsal — **not yet passed**

Last reviewed: October 16, 2026. This runbook is a procedure and a baseline, **not** proof that a recoverable backup exists or that restoration has succeeded.

## Environment boundaries

- Live shared Supabase project ref: `jtnyqzxlipekwtoyvcmb`. Do **not** restore over this live project as part of the pilot exercise.
- Vercel production projects: The Concierge and Concierge Pro. Keep their production environment variables pointed at the live project; test recovery using isolated preview deployments and keys.
- Live Stripe webhook endpoints are configured on the shared project. **Never replace or overwrite existing live Stripe signing secrets to configure sandbox webhooks.**
- Recovery test project/branch must be isolated, temporary, and intentionally authorized if it incurs charges. Tear down temporary resources when finished.

## 1. Verify the actual backup source

Confirm the project's billing tier and backup availability in Supabase > Database > Backups. Daily managed backups depend on plan; on tiers without them, schedule and securely retain off-site logical backups (consult the current [Supabase backup guide](https://supabase.com/docs/guides/platform/backups)).

Record a dated recoverable database backup or a logical dump, its timestamp, retention, storage location, and verified ability to access it. Include schema, functions, policies, identity data, and application tables. Do not commit any backup, database dump, customer PII, credentials, session data, or tokens to GitHub.

**Important:** Supabase database backups include Storage metadata, **not the actual Storage object bytes**. Maintain a separate secure object backup. Do not call a backup complete until both sides are covered.

## 2. Restore in isolation

Use a separate authorized test project and the documented database restore/import procedure appropriate to the backup format. Some managed restore actions affect the original project; do **not** invoke an in-place production restore to prove this gate. If a managed backup cannot be restored into a separate target, create a logical dump and import it into the isolated database instead.

Reinstall the versioned Edge Functions from GitHub on the isolated target. Confirm that sensitive object storage is still private and all authentication/row-level security policies remain intact. Reconfigure **test-only** environment secrets and Stripe sandbox webhooks for the isolated project; never reuse or overwrite live webhook signing secrets.

Restore test Storage objects separately from a secure object backup. Validate sample object hashes or file content, and confirm image links are generated only through signed private URLs.

## 3. Compare recorded state

On the source and restored target, run the following read-only query and compare table counts, allowing for writes made after the backup timestamp:

```sql
SELECT 'profiles' AS entity, COUNT(*) AS rows FROM public.profiles
UNION ALL SELECT 'fit_profiles', COUNT(*) FROM public.fit_profiles
UNION ALL SELECT 'businesses', COUNT(*) FROM public.businesses
UNION ALL SELECT 'employees', COUNT(*) FROM public.employees
UNION ALL SELECT 'product_master', COUNT(*) FROM public.product_master
UNION ALL SELECT 'product_variant', COUNT(*) FROM public.product_variant
UNION ALL SELECT 'retailer_offer', COUNT(*) FROM public.retailer_offer
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items
UNION ALL SELECT 'purchases', COUNT(*) FROM public.purchases
UNION ALL SELECT 'purchase_items', COUNT(*) FROM public.purchase_items;
```

Check referential integrity:

```sql
SELECT 'variants_missing_master' AS check_name, COUNT(*) AS affected
FROM public.product_variant v LEFT JOIN public.product_master p ON p.id = v.product_master_id WHERE p.id IS NULL
UNION ALL
SELECT 'offers_missing_master', COUNT(*)
FROM public.retailer_offer o LEFT JOIN public.product_master p ON p.id = o.product_master_id WHERE p.id IS NULL
UNION ALL
SELECT 'order_items_missing_order', COUNT(*)
FROM public.order_items i LEFT JOIN public.orders o ON o.id = i.order_id WHERE o.id IS NULL
UNION ALL
SELECT 'purchase_items_missing_purchase', COUNT(*)
FROM public.purchase_items i LEFT JOIN public.purchases p ON p.id = i.purchase_id WHERE p.id IS NULL;
```

## 4. Exercise real access and merchant flows

1. Use two distinct **test** users. Verify each can read their own restored profile, measurements, closet/cart, and private images, but cannot read the other user's.
2. In the isolated restored environment, check that Concierge Pro users see only their authorized retailer's records, inventory, orders, and sale items.
3. Verify the Stripe sandbox webhook endpoint points to the isolated project and that a signed **test** payment produces an order, purchase header, purchase line items, and an idempotent webhook record. Confirm returns/refunds and replay handling.
4. Test a simulated deployment/application failure and recovery to the previous working Vercel deployment without altering production.

## Acceptance criteria

Mark **RECOVERY PASS** only if:
- A timestamped backup was actually obtained and restored in isolation.
- Source and target data counts/integrity reconcile for the backup point.
- A restored private object can be read by its owner but not by another user.
- Supabase Auth, RLS, Edge Functions, webhook signing, and both application interfaces behave correctly in the restored target.
- Restoration time, lost-data window, and cleanup outcome are recorded.

### Verified baseline (read-only, October 16, 2026)

Source database counts: profiles 1; fit_profiles 1; businesses 1; employees 1; product_master 27; product_variant 51; retailer_offer 32; orders 0; purchases 0. Referential-integrity spot checks returned 0 orphan variants, offers, order lines, and purchase lines. Both Supabase storage buckets currently contain 0 objects.

**Remaining: actual backup availability, actual isolated restore, separate object-backup demonstration, and restored app access tests are all unverified.**
