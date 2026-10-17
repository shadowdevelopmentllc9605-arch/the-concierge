# The Concierge — Storage image disaster recovery runbook

Status: **operational plan ready; object-byte restore drill not yet performed** (2026-10-17).

## Why this is a separate workstream
A Supabase **database** restore restores Storage bucket metadata and object *records* but **does not restore file bytes**. The Concierge uses two buckets:

| Bucket | Privacy | Contents | Required safeguards |
| --- | --- | --- | --- |
| `concierge-sensitive` | Private | Body/precision scan photographs | Never publish, enforce user-folder RLS, encrypt backup |
| `concierge-uploads` | Public | Retailer logos and authorized public product/store imagery | Verify ownership, licenses, paths, correct content types |

The completed October 16 production physical restore to a new Supabase project proved database recovery only. Its source production buckets happened to contain **zero uploaded objects**; the two actual Phase One image test objects are in the separate temporary E2E branch.

## Preparation (before accepting real customer photos)

1. Designate an **independent, access-restricted encrypted backup destination**, not a directory inside GitHub, Vercel, or the database project itself. Set retention and deletion policy, business owner, offboarding procedure and minimum-privilege access. Encrypted local backups must be transferred to independent storage and removed from the working machine afterward.
2. Determine the backup cadence and recovery target objectives. For an initial pilot, propose daily copies and a manual weekly integrity check, but do **not** claim an RPO/RTO until measured. Daily snapshots can lose up to 24 hours of new photos.
3. Configure dedicated least-privilege credentials for a **server-side** backup job. Never put Supabase `service_role` or S3 secret keys into Vite/Vercel public environment variables or GitHub source. Store credentials in a secrets manager; rotate them if exposed.
4. Use Supabase's [Storage download](https://supabase.com/docs/guides/storage/management/download-objects) and [S3 access](https://supabase.com/docs/guides/storage/s3/authentication) guidance to select an authenticated, paginated export mechanism. For larger uploads use S3-compatible tooling (e.g. rclone), supporting retries and checksums. Configure an **independent read-only copy** of each of the two buckets, preserving exact key prefixes (UUID/user ID and object filename), content type and image bytes.
5. Produce a per-snapshot manifest that contains the **source project ref, UTC time, bucket, object key, byte length, SHA-256 digest, content type, and expected number of objects**. Encrypt the private manifest along with private image bytes; store integrity digests separately from decryption keys. Confirm checksums after transfer.
6. Pair the snapshot with the nearest dated Supabase **database backup**. Retain both restore points; a DB record referring to an image missing in the blob snapshot is a partial recovery, not a success.

## Isolated restore drill (must be verified once with real bytes)

1. Obtain explicit approval and cost estimate for a new **recovery target project**; never restore over production or the working Supabase E2E branch.
2. Restore a dated database backup into the target. **Disable/not deploy payment, outbound email, webhooks, reminders, and live integrations**. Keep new Auth/Stripe/API credentials isolated.
3. Provision the two buckets in the recovery target with the correct private/public settings, object size and MIME allowlist. Restore the encrypted object archive with credentials restricted to that project.
4. For every object, independently download the *restored* bytes using an administrative verification process and compare their SHA-256 and byte length with the encrypted manifest. A matching `storage.objects` row alone does not count.
5. Verify that bucket owners/path ownership and security policies work after service-role restores. A privileged bulk upload may **not preserve `owner_id` automatically**; restore object authorization metadata where supported or recreate ownership through an approved procedure, then validate RLS. Do not quietly broaden policies to make restored files visible.
6. Sign in as the synthetic shopper and retailer on the recovery target using its isolated Auth configuration. Verify the shopper can view its restored private image and the retailer gets **401/403/404**, not bytes, for the shopper's private object. The public store logo should remain visible but non-owners must not overwrite/delete it.
7. Verify that existing application references resolve (including signed previews), test both mobile apps, record elapsed recovery time, count any missing/newer files, and explicitly document observed RTO/RPO. Confirm no live Stripe webhook or charge was sent.
8. Only after recording evidence and securing the encrypted archive may the temporary target be deleted with explicit approval. Verify the project was removed and the backup source/destination retained.

## Security API negative-test gate

To prove browser-level authorization, perform direct Supabase Storage SDK **download/list and write-negative** checks using **genuine signed-in** synthetic shopper/retailer sessions. Do not generate an admin-signed link or use `service_role` for these checks—those would bypass the policies under test. Do not attempt a destructive delete against an irreplaceable or unbacked-up file.

Passing SQL `SET LOCAL ROLE authenticated` tests for `storage.objects` is useful coverage but **not** a substitute for a real authenticated HTTP API request. Test a new, disposable, owner-created file for negative delete permission and verify it survived. Remove test images through authenticated API after tests; retain audit evidence without exposing their bytes.

## Automated operation and alerts

- Schedule backup copies after the pilot goes live, and alert if a job fails, an object count unexpectedly drops, or a checksum mismatches.
- Rehearse restore at least quarterly initially and after material Storage/RLS changes.
- Never store personal scans in app logs, GitHub issue attachments, analytics events, or plaintext archive manifests.
- Limit who can read the encrypted archive; audit access; delete on a documented retention schedule.
- Revisit retention, consent, deletion-request handling, and ownership before accepting actual user body photography.

### Evidence as of 2026-10-17

- Production October 16 physical **database** restore: **PASSED**, isolated and safely deleted afterward.
- Actual test-branch shopper private JPEG and retailer public JPEG upload/retrieval: **PASSED**.
- SQL-policy read/write impersonation for shopper/retailer: **PASSED**.
- Storage API cross-account denial: **OPEN** until real signed-in tests.
- Independently encrypted **image-byte** backup/restore: **OPEN** until destination, tooling, and isolated restored bytes are verified.

Do not represent the last two gates as passed based only on this runbook.
