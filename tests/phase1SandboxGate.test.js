import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const uploads = source('src/api/base44Client.js');
const actions = source('supabase/functions/concierge-actions/index.ts');
const webhook = source('supabase/functions/stripe-webhook/index.ts');

test('private body scans use a private storage bucket and require sign-in', () => {
  const start = uploads.indexOf('async UploadPrivateFile(');
  const end = uploads.indexOf('async CreateFileSignedUrl(', start);
  assert.ok(start > -1 && end > start);
  const part = uploads.slice(start, end);
  assert.match(part, /getUser\(\)/);
  assert.match(part, /storage\.from\('concierge-sensitive'\)/);
  assert.doesNotMatch(part, /getPublicUrl/);
});

test('private signed URLs are restricted to the signed-in account', () => {
  const start = uploads.indexOf('async CreateFileSignedUrl(');
  assert.ok(start > -1);
  const part = uploads.slice(start);
  assert.match(part, /auth\.user\.id/);
  assert.match(part, /file_uri\.startsWith\(prefix\)/);
  assert.match(part, /createSignedUrl\(path, 3600\)/);
});

test('checkout only uses eligible verified retailer offers', () => {
  assert.match(actions, /chosenBusinesses\.size!==1/);
  assert.match(actions, /stripe_connected_account_id/);
  assert.match(actions, /stripe_onboarding_complete/);
  assert.match(actions, /stripe_charges_enabled/);
  assert.match(actions, /stock_quantity/);
  assert.match(actions, /stale_after/);
});

test('live checkout remains off until explicitly approved and tax configured', () => {
  assert.match(actions, /CONCIERGE_LIVE_CHECKOUT_ENABLED/);
  assert.match(actions, /CONCIERGE_TAX_CONFIGURED/);
  assert.match(actions, /checkout_not_approved/);
});

test('Stripe webhook validates signed events and is retry-safe', () => {
  assert.match(webhook, /stripe-signature/);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /claim_stripe_webhook_event/);
});
