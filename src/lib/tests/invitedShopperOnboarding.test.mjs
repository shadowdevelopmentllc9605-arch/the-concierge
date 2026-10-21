import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const bridge = read('../../api/base44Client.js');
const setup = read('../../components/onboarding/ProfileSetup.jsx');
const onboarding = read('../../pages/Onboarding.jsx');

test('newly invited shoppers can update name through Supabase Auth instead of undefined legacy SDK', () => {
  assert.match(bridge, /async updateMe\(\{ full_name \} = \{\}\)/);
  assert.match(bridge, /supabase\.auth\.updateUser\(\{/);
  assert.match(bridge, /data: \{ full_name: trimmed \}/);
  assert.doesNotMatch(bridge, /service_role/);
});

test('profile form requires a name and persists display_name while allowing an empty birthday', () => {
  assert.match(setup, /profile\?\.display_name/);
  assert.match(setup, /name\.trim\(\)/);
  assert.match(setup, /display_name: displayName/);
  assert.match(setup, /birthday: birthday \|\| null/);
  assert.match(setup, /profile_picture: picture \|\| null/);
  assert.match(setup, /setFormError\(/);
  assert.match(bridge, /'display_name','birthday'/);
});

test('profile form gets a real save-failure signal rather than silently advancing', () => {
  assert.match(onboarding, /return true;/);
  assert.match(onboarding, /return false;/);
  assert.match(setup, /saved === false/);
});
