#!/usr/bin/env node
/**
 * Phase One: invite-only fresh synthetic-account onboarding & RLS rehearsal.
 * Hard restricted to existing Supabase E2E branch; never production.
 * Runs manually through GitHub protected environment, no SMTP or Stripe.
 */
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const REF = 'cbqxcbvjezehxowarkoq';
const URL = 'https://' + REF + '.supabase.co';
const PUBLIC = "sb_publishable_a8b1RKXtZdcSYp1z1D6ryg_0BrTYl78";
const PRIVILEGED = process.env.PHASE1_SOURCE_BRANCH_SECRET || '';
if (!PRIVILEGED.startsWith('sb_secret_')) {
  throw new Error('Protected test-branch credential is missing or wrong format.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, PRIVILEGED, options);
const newClient = () => createClient(URL, PUBLIC, options);
const testUsers = [];
const testBusinesses = [];
let failed = false;
function check(truth, message) {
  if (!truth) throw new Error(message);
}

async function freshUser(kind) {
  const email = 'concierge-phase1-' + kind + '-' + randomUUID() + '@example.com';
  const password = randomBytes(32).toString('base64url') + 'A7!';
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { phase1_synthetic_only: true }
  });
  check(!created.error && created.data?.user?.id, 'Synthetic Auth account creation failed: ' + (created.error?.code || 'unknown'));
  const id = created.data.user.id;
  testUsers.push({ id });
  const client = newClient();
  const signed = await client.auth.signInWithPassword({ email, password });
  check(!signed.error && signed.data?.user?.id === id, 'Fresh synthetic account could not log in.');
  const { data: identity, error: identityError } = await client.auth.getUser();
  check(!identityError && identity?.user?.id === id, 'Authenticated identity did not match issued account.');
  return { id, client };
}

async function main() {
  const retailer = await freshUser('retailer');
  const outsider = await freshUser('outsider');
  check(retailer.id !== outsider.id, 'Test identities unexpectedly match');

  // Newly invited user must be able to establish and read their own profile.
  const profile = await retailer.client.from('profiles')
    .upsert({ user_id: retailer.id, display_name: 'Phase One Synthetic Retailer' }, { onConflict: 'user_id' })
    .select('user_id,display_name').single();
  check(!profile.error && profile.data?.user_id === retailer.id, 'Fresh retailer profile upsert failed: ' + (profile.error?.code || 'unknown'));
  const someoneElseProfile = await outsider.client.from('profiles').select('user_id').eq('user_id', retailer.id);
  check(!someoneElseProfile.error && someoneElseProfile.data?.length === 0, 'Privacy failure: another account read retailer profile.');

  const newBiz = await retailer.client.from('businesses').insert({
    owner_user_id: retailer.id,
    name: 'PHASE ONE FRESH TEST RETAILER — DO NOT USE',
    tax_rate: 0,
    setup_complete: false
  }).select('id,owner_user_id,name,setup_complete').single();
  check(!newBiz.error && newBiz.data?.id && newBiz.data.owner_user_id === retailer.id,
    'New retailer could not create business via owner-restricted Data API: ' + (newBiz.error?.code || newBiz.error?.message || 'unknown'));
  const bizId = newBiz.data.id;
  testBusinesses.push(bizId);

  const outsiderRead = await outsider.client.from('businesses').select('id,name').eq('id',bizId);
  check(!outsiderRead.error && outsiderRead.data?.length === 0, 'Privacy failure: outsider could view new retailer business.');

  // Follow the business setup flow: authenticated owner updates permitted fields only.
  const updated = await retailer.client.from('businesses').update({
    name: 'PHASE ONE FRESH TEST RETAILER — SETUP COMPLETE',
    setup_complete: true,
    tax_rate: 0,
  }).eq('id',bizId).select('id,setup_complete,name').single();
  check(!updated.error && updated.data?.setup_complete === true,
    'New business owner could not complete setup using normal account credentials: ' + (updated.error?.code || updated.error?.message || 'unknown'));

  // Never count a returned mutation success as evidence; independently read through admin.
  const outsiderUpdate = await outsider.client.from('businesses').update({ name: 'UNAUTHORIZED' }).eq('id',bizId).select('id');
  check(outsiderUpdate.error || outsiderUpdate.data?.length === 0, 'Privacy failure: outsider updated another business.');
  await outsider.client.from('businesses').delete().eq('id',bizId);
  const after = await admin.from('businesses').select('id,name,owner_user_id,setup_complete').eq('id',bizId).single();
  check(!after.error && after.data?.owner_user_id === retailer.id && after.data?.setup_complete
    && after.data?.name === 'PHASE ONE FRESH TEST RETAILER — SETUP COMPLETE',
    'Privacy failure: business was removed or changed by outsider.');

  console.log('PASS: two newly invited synthetic users signed in with actual Auth sessions.');
  console.log('PASS: retailer profile upsert and private ownership read rules.');
  console.log('PASS: new retailer created business and completed setup using its own JWT.');
  console.log('PASS: unrelated account cannot read, update or delete that business.');
  console.log('No Stripe actions, SMTP sends or production connections were made.');
}

try {
  await main();
} catch (e) {
  failed = true;
  console.error('ONBOARDING TEST FAIL: ' + (e?.message || String(e)));
} finally {
  // Delete ONLY rows that THIS script created. Verify deletion; do not trust an empty response.
  for (const id of [...testBusinesses].reverse()) {
    const deleted = await admin.from('businesses').delete().eq('id',id).select('id');
    const remaining = await admin.from('businesses').select('id').eq('id',id);
    if (deleted.error || remaining.error || remaining.data?.length !== 0) {
      failed = true;
      console.error('CLEANUP FAIL: synthetic business row remains; manual branch-only cleanup required.');
    }
  }
  for (const { id } of [...testUsers].reverse()) {
    const removed = await admin.auth.admin.deleteUser(id);
    const stillThere = await admin.auth.admin.getUserById(id);
    if (removed.error || stillThere.data?.user) {
      failed = true;
      console.error('CLEANUP FAIL: synthetic Auth user remains; manual branch-only cleanup required.');
    }
  }
}
if (failed) process.exitCode = 1;
else console.log('PASS: all newly created synthetic businesses and Auth accounts deleted and independently verified.');
