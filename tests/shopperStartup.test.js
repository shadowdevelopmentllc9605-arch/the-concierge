import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('shopper root never mounts retired Base44 page logging', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /import\s+NavigationTracker\s+from/);
  assert.doesNotMatch(app, /<NavigationTracker\s*\/>/);
});

test('production replacement does not expose the retired Base44 appLogs API', () => {
  const backend = readFileSync(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  const legacyTracker = readFileSync(new URL('../src/lib/NavigationTracker.jsx', import.meta.url), 'utf8');
  assert.match(legacyTracker, /base44\.appLogs\.logUserInApp/);
  assert.doesNotMatch(backend, /appLogs\s*:/);
});
