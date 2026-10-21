import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const login = readFileSync('src/components/SupabaseLogin.jsx', 'utf8');
const access = readFileSync('src/pages/AccountAccess.jsx', 'utf8');
const onboarding = readFileSync('src/pages/Onboarding.jsx','utf8');
const app = readFileSync('src/App.jsx', 'utf8');

test('an authenticated invitee can set a password without leaving unfinished onboarding', () => {
  assert.match(onboarding, /navigate\('\/AccountAccess'\)/);
  assert.match(app, /path="\/AccountAccess" element=\{<AccountAccess \/>\}/);
  assert.match(access, /supabase\.auth\.getUser\(\)/);
  assert.match(access, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(access, /MIN_PASSWORD_LENGTH = 12/);
  assert.match(access, /password !== confirm/);
  assert.match(access, /navigate\('\/Onboarding'\)/);
  assert.doesNotMatch(access, /localStorage\.setItem.*password|console\.log\(password/);
});

test('forgotten-password emails use allowlisted recovery redirect, not public signup', () => {
  assert.match(login, /VITE_ENABLE_AUTH_RECOVERY_EMAIL === 'true'/);
  assert.match(login, /recoveryEmailEnabled &&/);
  assert.match(login, /supabase\.auth\.resetPasswordForEmail\(email\.trim\(\),/);
  assert.match(login, /\/AccountAccess\?recovery=1/);
  assert.match(login, /If your invited account exists/);
  assert.match(login, /shouldCreateUser: false/);
  assert.match(login, /VITE_ENABLE_EMAIL_LINK_SIGNIN === 'true'/);
});

test('recovery requires established Supabase user session and strips recovery URL marker', () => {
  assert.match(access, /if \(userError \|\| !userData\?\.user\?\.id\)/);
  assert.match(access, /window\.history\.replaceState\(null, '', '\/AccountAccess'\)/);
  assert.match(access, /autoComplete="new-password"/);
  assert.doesNotMatch(access, /service_role|createUser\(|signUp\(/);
});
