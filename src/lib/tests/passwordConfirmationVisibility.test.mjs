import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync('src/lib/AuthContext.jsx', 'utf8');
const access = readFileSync('src/pages/AccountAccess.jsx', 'utf8');

test('Supabase USER_UPDATED refreshes account silently so success notice stays mounted', () => {
  assert.match(auth, /const checkAppState = async \(\{ background = false \} = \{\}\) =>/);
  assert.match(auth, /if \(!background\) setIsLoadingAuth\(true\)/);
  assert.match(auth, /if \(!background\) setIsLoadingAuth\(false\)/);
  assert.match(auth, /checkAppState\(\{ background: event === 'USER_UPDATED' \}\)/);
});

test('normal sign-in and sign-out continue revalidating auth', () => {
  assert.match(auth, /\['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'\]/);
  assert.match(auth, /checkAppState\(\);/);
  assert.match(auth, /setAuthError\(\{ type: 'auth_required'/);
});

test('password confirmation remains an accessible persistent success message', () => {
  assert.match(access, /if \(updateError\) throw updateError/);
  assert.match(access, /setMessage\('Your account password was saved/);
  assert.match(access, /role="status"/);
  assert.match(access, /window\.history\.replaceState/);
  assert.doesNotMatch(access, /console\.log\(password\)/);
});
