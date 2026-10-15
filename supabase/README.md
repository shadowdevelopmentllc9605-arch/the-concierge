# Shared Concierge Supabase backend

The Concierge (shopper) and Concierge Pro (retailer) use one Supabase project.
This repository holds the canonical versioned source for the shared `stripe-webhook` Edge Function and the Phase 1 hardening migration scripts.

The migrations listed here were applied to the shared database on October 14, 2026 (local Central time). These source copies document the applied changes; do not reapply blindly. Compare against Supabase migration history first.

`stripe-webhook` must keep `verify_jwt=false` **only** because it validates the incoming Stripe signature itself. Never remove that verification.

After any backend change: verify GitHub validation, deploy to Supabase, inspect the deployed function version, confirm RLS and webhook deduplication, and test a full Stripe sandbox transaction before approving payments for customer use.

Production Stripe checkout and refund handling are **not** certified simply because this source compiles. Database backups do not include the actual Storage objects.
