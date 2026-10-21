# Phase One: encrypted Supabase Storage backups to Google Drive

**Status: STAGED, NOT RUNNING.** The manual workflow has no schedule. Private body-scan uploads stay **OFF** until real encrypted backup, independent download, decryption, and recovery checks all pass.

## Scope and limits

- Source: production Supabase project `jtnyqzxlipekwtoyvcmb`, buckets `concierge-sensitive` and `concierge-uploads`.
- Destination: dedicated **Automated Encrypted Snapshots** subfolder of the existing private Concierge Google Drive backup folder.
- Encryption: `age` with a recipient **PUBLIC** key only. No decryption key or plaintext archive is placed in GitHub, Vercel, Supabase, or Google Drive.
- Per run: full stream-encrypted `.tar.gz.age` snapshot containing both buckets plus an encrypted JSON manifest with each object's SHA-256 hash and full key. No automated overwrite or deletion of past backups.
- Explicit Phase One cap: 15 MiB per object, 512 MiB total. This is suitable for a *small pilot*, not indefinite growth. Larger catalogs require an incremental approach, retention management, quota budgeting, alerting, and tested operations.
- This does not back up the Supabase Postgres database, credentials, or Auth records. Those require independent recovery procedures.
- GitHub runner temporarily handles original bytes **in memory** to encrypt them; no unencrypted archive is intentionally written to disk. Secrets and OAuth tokens reside in GitHub's protected environment, which still requires strong account security.

## Before first run (only the account owner can complete these)

1. On a trusted device, locally create an `age` identity using `age-keygen -o concierge-backup-identity.txt`. Record the output recipient beginning with `age1...`. Protect the **private identity** in a password manager and a separate offline recovery location. **Never put the identity in this repository, the Drive folder, an environment variable, or a ChatGPT message.** Losing it permanently prevents recovery.
2. Using the owner's Google Drive account, set up `rclone` Google Drive OAuth access with a remote named **`conciergebackups`**, rooted at the dedicated private *Automated Encrypted Snapshots* folder. Verify `rclone lsd conciergebackups:` works. Store the complete rclone configuration as a **base64-encoded GitHub environment secret** `RCLONE_CONFIG_B64`. Base64 is NOT encryption; treat it as an OAuth credential. The config's `root_folder_id` must target the new subfolder, not Drive root. Do not paste its contents here.
3. Obtain a server-side Supabase service-role Storage API credential for the **production project**. In the GitHub repository, create the protected environment `phase1-backups`, and add the environment secret `SUPABASE_BACKUP_SERVICE_KEY`. This credential is powerful; never place it in the app, repository source, screenshots, chat, or a public workflow artifact. Restrict workflow changes/reviews and use the least privilege your deployment can support.
4. Add GitHub environment secret `RCLONE_CONFIG_B64` and repository variable `AGE_RECIPIENT` (the public `age1...` recipient). Keep decryption private key out of the GitHub environment.
5. Once the workflow is on the default GitHub branch, select Actions → **Phase One encrypted Storage snapshot (manual commissioning)** → Run workflow. A run failing on a missing credential is expected until setup is complete.

## Required acceptance test before enabling daily runs

- GitHub Actions reports successful encryption and ciphertext round-trip from Google Drive. This only proves encrypted transport/copy, not that bytes are restorable.
- Download the resulting `.tar.gz.age` file **from Google Drive** to a trusted local device.
- Decrypt **locally** with the independently held `age` private identity, piping into `scripts/verify_storage_archive.py` (do not extract files unless needed, and never upload decrypted files back to Drive):
  ```bash
  age --decrypt --identity /secure/offline/concierge-backup-identity.txt backup.tar.gz.age \
    | python3 scripts/verify_storage_archive.py
  ```
- Verify that every file listed in the encrypted manifest matches its own SHA-256 hash; independently restore a synthetic JPEG and test owner vs unrelated-user access in an isolated Supabase preview. Prior manual recovery drills do not replace this first *automated* snapshot test.
- Remember: production currently has **zero** Storage objects. An empty, valid archive can prove the pipeline works but **cannot** prove a real file's automated backup and restore.
- Confirm someone receives and acts on failure notifications, the Drive quota is sufficient, key recovery is survivable, and an archive older than one day can actually be decrypted.
- **Only after those checks**, add a daily `schedule` event to the workflow through a reviewed PR. Keep both apps' `VITE_PRIVATE_UPLOADS_ENABLED` setting disabled until automatic backup/restore is operational and approved.

## Rollback, failures, and incident response

- On any failed scheduled backup, *do not delete originals* and do not enable sensitive uploads. Inspect job status without copying private object names or secrets into issues.
- Every run writes a uniquely named encrypted snapshot; automated rotation/deletion is intentionally not implemented.
- To revoke backup access, rotate the Supabase service-role credential and revoke the Google OAuth grant, then update protected environment secrets.
- If the GitHub environment or Google OAuth token is compromised, treat the Storage backup credentials as exposed. The historical ciphertext cannot be decrypted solely with those credentials if the `age` secret identity remained offline.
- If the private decryption identity is lost, previously encrypted backup files cannot be recovered; this is why independent safe custody is a required release gate.
