import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const registry = readFileSync(new URL('../src/pages.config.js', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8');

test('precision scan is registered as a shopper route', () => {
  assert.match(registry, /import PrecisionScan from ['"]\.\/pages\/PrecisionScan['"]/);
  assert.match(registry, /"PrecisionScan"\s*:\s*PrecisionScan/);
  assert.equal(existsSync(new URL('../src/pages/PrecisionScan.jsx', import.meta.url)), true);
});

test('profile Precision Fit Scan navigation resolves to registered page', () => {
  assert.match(profile, /label:\s*'Precision Fit Scan'[^\n]*path:\s*'PrecisionScan'/);
  assert.match(registry, /"PrecisionScan"\s*:/);
});

test('precision scan relies on the private image uploader, not public media', () => {
  const scan = readFileSync(new URL('../src/pages/PrecisionScan.jsx', import.meta.url), 'utf8');
  assert.match(scan, /Core\.UploadPrivateFile\(/);
  assert.match(scan, /resolveFileUrl\(/);
  assert.doesNotMatch(scan, /Core\.UploadFile\(/);
});
