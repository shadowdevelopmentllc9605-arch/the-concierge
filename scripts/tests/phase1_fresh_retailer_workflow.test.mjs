import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../phase1_test_fresh_retailer_onboarding.mjs', import.meta.url)), 'utf8');
const workflow = readFileSync(fileURLToPath(new URL('../../.github/workflows/phase1-fresh-retailer-onboarding.yml', import.meta.url)), 'utf8');

test('new retailer rehearsal is restricted to the already-approved sandbox branch', () => {
  assert.match(src, /const REF = 'cbqxcbvjezehxowarkoq'/);
  assert.doesNotMatch(src, /jtnyqzxlipekwtoyvcmb|acct_1UMyzw5ty13mCGMM/);
  assert.match(src, /PHASE1_SOURCE_BRANCH_SECRET/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: phase1-storage-restore/);
  assert.doesNotMatch(workflow, /push:|schedule:|pull_request:/);
});

test('test verifies real RLS and independent deletion of its synthetic users and business', () => {
  assert.match(src, /signInWithPassword/);
  assert.match(src, /owner_user_id: retailer\.id/);
  assert.match(src, /outsiderRead\.data\?\.length === 0/);
  assert.match(src, /admin\.from\('businesses'\)\.delete\(\)/);
  assert.match(src, /getUserById/);
  assert.match(src, /stillThere\.data\?\.user/);
  assert.match(src, /email_confirm: true/);
  assert.doesNotMatch(src, /createStripeCheckout|sendLink|signInWithOtp|inviteUserByEmail/);
});
