import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../../components/SupabaseLogin.jsx', import.meta.url)), 'utf8');

test('pilot invitation requests have a real business contact, without pretending account creation is ready', () => {
  assert.match(source, /Phase One pilot access is by invitation/);
  assert.match(source, /Request pilot access/);
  assert.match(source, /mailto:shadowdevelopmentllc9605@gmail\.com\?subject=/);
});

test('sign-in link cannot silently provision an uninvited account', () => {
  assert.match(source, /signInWithOtp\(/);
  assert.match(source, /shouldCreateUser:\s*false/);
  assert.match(source, /emailRedirectTo:\s*window\.location\.origin/);
});
