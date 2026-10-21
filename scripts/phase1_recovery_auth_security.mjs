#!/usr/bin/env node
/**
 * Manual Phase One genuine-session Storage RLS checks (recovery branch ONLY).
 *
 * - Creates two throwaway confirmed Auth accounts in isolated recovery target.
 * - Signs in both using the PUBLIC browser key, NOT the privileged secret.
 * - Tests real RLS on private/private and public/owner-written image uploads.
 * - Tests outsider list/download/update/delete rejection and source survival.
 * - Removes its own objects and test accounts; NEVER alters the recovered JPEGs.
 * - No outbound email, production access, Stripe, or real customer identity.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { removeAndVerifyTestObject } from './phase1_verified_cleanup.mjs';

const RECOVERY = 'eszpxvgsmsjptagoyxzu';
const URL = 'https://' + RECOVERY + '.supabase.co';
const PUBLIC_KEY = 'sb_publishable_80P9lruoQgXY1UvEjDDZ_w_xj9qjxNC';
const SECRET = process.env.PHASE1_RECOVERY_BRANCH_SECRET || '';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPUil3AwMDAxMDAwMDAAAANiAErap7CmQAAAABJRU5ErkJggg==', 'base64');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (msg) => { throw new Error(msg); };
const requireTrue = (value, msg) => { if (!value) fail(msg); };

if (!SECRET.startsWith('sb_secret_')) fail('Dedicated recovery-branch secret must be configured');
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, SECRET, opts);
const ordinary = () => createClient(URL, PUBLIC_KEY, opts);
const created = [];
const ownedFiles = [];

function asUpload() {
  return new Blob([PNG], { type: 'image/png' });
}
async function getBytes(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path);
  return { data: data ? Buffer.from(await data.arrayBuffer()) : null, error };
}
async function assertPreserved(client, bucket, path, expected) {
  const result = await getBytes(client, bucket, path);
  requireTrue(!result.error && result.data, 'Owner could not read original ' + bucket + ' bytes');
  requireTrue(sha(result.data) === sha(expected), 'Original object was changed by unauthorized operation');
}
async function makeUser(tag) {
  const email = 'concierge-phase1-' + tag + '-' + randomUUID() + '@example.com';
  const password = randomBytes(32).toString('base64url') + 'Bb9!';
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { synthetic: true, phase1_recovery: true }
  });
  if (error || !data?.user?.id) fail('Could not create synthetic Auth test user: ' + (error?.code || error?.message || 'missing id'));
  created.push(data.user.id);
  const client = ordinary();
  const signed = await client.auth.signInWithPassword({ email, password });
  requireTrue(!signed.error && signed.data?.session?.access_token, 'Synthetic account sign-in failed');
  const confirmed = await client.auth.getUser();
  requireTrue(!confirmed.error && confirmed.data?.user?.id === data.user.id, 'Signed-in user identity mismatch');
  return { client, id: data.user.id };
}
async function upload(client, bucket, path) {
  const { error } = await client.storage.from(bucket).upload(path, asUpload(), { upsert: false, contentType: 'image/png' });
  if (error) fail('Owner upload failed for ' + bucket + ': ' + (error.code || error.message));
  ownedFiles.push({ bucket, path, client });
}
async function assertOutsiderDenied(other, owner, bucket, path, original) {
  const unauthorizedRead = await getBytes(other, bucket, path);
  requireTrue(unauthorizedRead.error || !unauthorizedRead.data, 'CRITICAL: non-owner read private bytes');
  const listed = await other.storage.from(bucket).list(path.split('/')[0], { limit: 50 });
  requireTrue(listed.error || !listed.data?.some(x => x.name === path.split('/').slice(-1)[0]),
    'CRITICAL: non-owner can list private object');

  const invalidUpdate = await other.storage.from(bucket).update(path, asUpload(), { contentType: 'image/png' });
  requireTrue(!!invalidUpdate.error, 'CRITICAL: non-owner UPDATE unexpectedly succeeded');
  await assertPreserved(owner, bucket, path, original);

  // RLS-blocked DELETE may return success with an empty removed list; validate by effect.
  await other.storage.from(bucket).remove([path]);
  await assertPreserved(owner, bucket, path, original);
}
async function assertOutsiderCannotModifyPublic(other, owner, path, original) {
  const publicRead = await getBytes(other, 'concierge-uploads', path);
  requireTrue(!publicRead.error && publicRead.data && sha(publicRead.data) === sha(original),
    'Other account could not read intentionally public asset');
  const invalidUpdate = await other.storage.from('concierge-uploads').update(path, asUpload(), { contentType: 'image/png' });
  requireTrue(!!invalidUpdate.error, 'CRITICAL: other user updated a publicly readable object');
  await assertPreserved(owner, 'concierge-uploads', path, original);
  await other.storage.from('concierge-uploads').remove([path]);
  await assertPreserved(owner, 'concierge-uploads', path, original);
}

let successful = false;
try {
  // Detect scope errors and refuse to run if recovered evidence is missing.
  for (const bucket of ['concierge-sensitive', 'concierge-uploads']) {
    const { data, error } = await admin.storage.from(bucket).list('', { limit: 100 });
    if (error) fail('Recovery target Storage not accessible: ' + bucket);
    requireTrue(data?.length === 1, 'Expected exactly one restored owner folder in ' + bucket);
  }

  const shopper = await makeUser('shopper');
  const retailer = await makeUser('retailer');
  requireTrue(shopper.id !== retailer.id, 'Test accounts must differ');

  const privatePath = shopper.id + '/phase1-isolation-' + randomUUID() + '.png';
  await upload(shopper.client, 'concierge-sensitive', privatePath);
  await assertPreserved(shopper.client, 'concierge-sensitive', privatePath, PNG);
  await assertOutsiderDenied(retailer.client, shopper.client, 'concierge-sensitive', privatePath, PNG);

  const publicPath = retailer.id + '/phase1-isolation-' + randomUUID() + '.png';
  await upload(retailer.client, 'concierge-uploads', publicPath);
  await assertPreserved(retailer.client, 'concierge-uploads', publicPath, PNG);
  await assertOutsiderCannotModifyPublic(shopper.client, retailer.client, publicPath, PNG);

  // Restored original private object must remain invisible to unrelated accounts.
  const { data: topLevel } = await admin.storage.from('concierge-sensitive').list('', { limit: 100 });
  const restoredOwner = topLevel.find(x => x.name !== shopper.id)?.name;
  requireTrue(restoredOwner, 'Restored original owner folder not found');
  const originalFolder = await admin.storage.from('concierge-sensitive').list(restoredOwner, { limit: 100 });
  requireTrue(!originalFolder.error && originalFolder.data?.length === 1, 'Unexpected restored private object layout');
  const oldPath = restoredOwner + '/' + originalFolder.data[0].name;
  for (const u of [shopper, retailer]) {
    const denied = await getBytes(u.client, 'concierge-sensitive', oldPath);
    requireTrue(denied.error || !denied.data, 'CRITICAL: unrelated test account read restored private JPEG');
  }

  successful = true;
  console.log('PASS: two real Auth sessions signed in on isolated branch.');
  console.log('PASS: private owner upload/read, outsider read/list/update/delete denied.');
  console.log('PASS: public image readable by both accounts, non-owner modification blocked.');
  console.log('PASS: restored private JPEG denied to unrelated users; no production calls.');
} finally {
  let cleanupFailed = false;
  for (const { bucket, path, client } of ownedFiles.reverse()) {
    try {
      // Ownership-based delete can return success without deleting the file.
      // Independently list with the test-branch admin to verify absence.
      await removeAndVerifyTestObject({ client, admin, bucket, path });
    } catch {
      cleanupFailed = true;
    }
  }
  for (const id of created.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error('Cleanup warning: disposable test objects or accounts may remain on isolated branch.');
    process.exitCode = 1;
  }
}
if (successful && process.exitCode !== 1) console.log('PASS: disposable test accounts and images cleanup completed.');
