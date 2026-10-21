import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scan = readFileSync('src/components/onboarding/BodyScan.jsx', 'utf8');
const style = readFileSync('src/components/onboarding/StylePreferences.jsx', 'utf8');
const onboarding = readFileSync('src/pages/Onboarding.jsx', 'utf8');
const bridge = readFileSync('src/api/base44Client.js', 'utf8');

test('pilot customer can explicitly continue without fake body measurements', () => {
  assert.match(scan, /Continue without body measurements/);
  assert.match(scan, /const handleSkipMeasurements = async \(\) =>/);
  assert.match(scan, /const saved = await onComplete\(\{\}\)/);
  assert.match(scan, /saved === false/);
  assert.match(scan, /saving \|\| uploading \|\| restoring \|\| analyzing/);
  assert.match(scan, /no body measurements or verified clothing sizes/);
  const skipPath = scan.split('const handleSkipMeasurements = async () =>')[1].split('const allScansComplete')[0];
  assert.doesNotMatch(skipPath, /measureBodyFromImages|measurement_confidence|suggested_sizes|body_scan_front|measurement_values_cm/);
});

test('skip advances only after secure onboarding progress persists', () => {
  assert.match(onboarding, /onboarding_step: nextStep/);
  assert.match(onboarding, /onboarding_completed: isComplete/);
  assert.match(onboarding, /await base44\.entities\.UserProfile\.update\(profile\.id, updateData\)/);
  assert.match(onboarding, /return false;/);
  assert.match(bridge, /if \(entity === 'UserProfile'\) return saveProfile\(id, payload, false\)/);
});

test('style screen preserves customer choice and exposes persistence failure', () => {
  assert.match(style, /style_preferences: selected/);
  assert.match(style, /saved === false/);
  assert.match(style, /role="alert"/);
  assert.match(style, /selected\.length === 0 \|\| saving/);
});
