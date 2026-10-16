# Phase One — isolated Stripe sandbox checkout gate

Status (2026-10-16): **NOT PASSED**. No shopper-app purchase has been completed against the isolated branch.

## What we verified

- An isolated Supabase preview branch can be created from the shared project's migrations **without copying production customer data**.
- The fresh branch had zero users, zero businesses, zero products, zero orders, and an empty Vault.
- Both `concierge-actions` and `stripe-webhook` functions appeared active in the isolated branch.
- A safe, temporary Edge Function probe confirmed `SUPABASE_URL` referred to the preview branch, and `STRIPE_SECRET_KEY` was **not set**. Thus no payment could be initiated there until a dedicated Stripe test key was supplied.
- Shadow Development LLC's **sandbox** Stripe account had two *test-mode* connected accounts with `charges_enabled=true` and `payouts_enabled=true`. This does not mean the app retailer rows had been onboarded.
- The existing **sandbox** Stripe webhook endpoints were both disabled and targeted an obsolete Supabase project. Live-mode endpoints were enabled on the production shared project; those were left untouched.
- A synthetic test product (a clearly labeled fake tee, size M) was inserted **only into the temporary preview branch**. It was not a sellable checkout, because no authenticated shopper or seller was created.
- The production shared project and Stripe live-mode credentials were not changed.

## Controlled execution plan

1. Create a fresh Supabase **preview** branch under the existing organization after confirming the current hourly rate. Use its unique `project_ref` for all subsequent steps, and confirm the branch has no production data.
2. In that preview branch, under **Project Settings > Edge Functions > Secrets**, add **only** the Shadow Development LLC **sandbox** `sk_test_...` as `STRIPE_SECRET_KEY`. Do **not** paste keys in GitHub, commit them to a repository, pass them into browser code, or copy a live `sk_live_...` key. Validate only the prefix/mode, never print the secret.
3. Create two **test** users through Supabase Auth on the branch: (a) synthetic shopper and (b) synthetic merchant. Avoid real customer identities. Confirm both sign in normally; do not directly insert fake `auth.users` rows.
4. Configure a Stripe **test-mode** connected account for the synthetic merchant. Verify the test account is `charges_enabled`, `payouts_enabled`, and belongs to the same Stripe sandbox platform. Use that verified `acct_...` when associating the isolated merchant; never spoof these flags against a real retailer.
5. Use a synthetic product/variant and one unambiguous, fresh online retailer offer. The backend requires: `available_online=true`, `fulfillment IN ('shipping','shipping_and_pickup')`, `availability IN ('in_stock','limited')`, `stale_after>now()`, a valid price, one `business_id`, and a current, matching cart price/variant. The merchant must have trialing/active billing and verified test Stripe Connect readiness.
6. Create a new **sandbox** webhook endpoint targeted to `https://<PREVIEW_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook` for the events handled by the function: `checkout.session.completed`, async payment success/failure, expiry, `charge.refunded`, `application_fee.refunded`, subscriptions, paid invoices, and `account.updated` where appropriate. Store the newly generated `whsec_...` securely in the **preview branch** Vault under the expected name(s). Never overwrite the live signing secrets on the production project. Disable the temporary webhook when finished.
7. Configure a **separately scoped Vercel preview deployment** for both apps to point exclusively to the test branch (`VITE_SUPABASE_URL` and matching publishable key), and allow exactly those preview origins in `CONCIERGE_ALLOWED_ORIGINS`. Avoid changing shared production or generic preview variables that might impact unrelated deployments.
8. Use The Concierge UI as the synthetic shopper: add the designated item to cart, continue to the Stripe-hosted checkout, and pay with a Stripe **test card**, never a real card.
9. Verify all the following on the preview database:
    - Exactly one `orders` row with the Stripe session reference, correct subtotal/shipping/tax, correct `payment_status='paid'`.
    - `order_items` has the expected variant/quantity and business ID.
    - `purchases` has a completed retailer-visible record and `purchase_items` contains matching lines.
    - `private.stripe_webhook_events` records successful signed processing and does not duplicate lines on replay.
    - Shopper sees the paid order; merchant sees the sale and product lines in Concierge Pro; unauthorized second merchant cannot see it.
    - The platform fee is 4% of eligible merchandise subtotal, with the actual Stripe Connect destination and fee checked. Confirm the test refund path updates records correctly.
10. Run negative tests: expired offer, price changed, unconnected merchant, unauthorized cart, wrong origin, invalid webhook signature, duplicate Stripe event. **All must fail closed**.
11. Record actual evidence (redacted IDs, statuses, totals, test timestamps) and mark the checkout gate as passed **only** if both UI and backend checks succeed.
12. Immediately disable the temporary sandbox webhook, disconnect preview routing, and **delete the billable Supabase branch**. Do not merge synthetic data or sandbox secrets into production.

## Read-only verification query

Run on the branch **only** after completing checkout:

```sql
SELECT
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.order_items) AS order_items,
 (SELECT count(*) FROM public.purchases) AS purchases,
 (SELECT count(*) FROM public.purchase_items) AS purchase_items,
 (SELECT count(*) FROM private.stripe_webhook_events) AS webhook_events;
```

Do not interpret Stripe's `payment_status=paid` by itself as proof that the app checkout works. The prior Stripe sandbox test produced a completed payment while the production Concierge `orders`, `purchases`, and webhook-event tables all remained empty.

## Decision

The isolated environment test cannot safely proceed without its own **test Stripe API secret**, a real branch Auth user/session, and matching Vercel preview origins. Never swap the production webhook secret to make the sandbox pass. Never create paid test branches and leave them running when required setup cannot be finished.
