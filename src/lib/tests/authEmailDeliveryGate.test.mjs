import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../../components/SupabaseLogin.jsx', import.meta.url)), 'utf8');

test('email Auth actions stay off by default until delivery is certified', () => {
  assert.match(src, /VITE_ENABLE_EMAIL_LINK_SIGNIN\s*===\s*'true'/);
  assert.match(src, /\{emailLinkEnabled \? \(/);
  assert.match(src, /Email sign-in and password recovery are not yet available/);
  assert.match(src, /need help accessing an invited account/);
});

test('invitation-only guard and password sign-in remain available', () => {
  assert.match(src, /signInWithPassword\(/);
  assert.match(src, /signInWithOtp\(/);
  assert.match(src, /shouldCreateUser:\s*false/);
  assert.match(src, /Request pilot access/);
  assert.match(src, /mailto:shadowdevelopmentllc9605@gmail\.com/);
});
