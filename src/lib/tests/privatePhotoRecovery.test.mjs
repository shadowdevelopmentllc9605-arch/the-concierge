import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync('src/components/onboarding/BodyScan.jsx', 'utf8');
const helper = readFileSync('src/lib/privateFiles.js','utf8');

test('mobile camera preview remains visible after upload', () => {
  assert.ok(src.includes('URL.createObjectURL(file)'));
  assert.ok(src.includes('Photo saved privately'));
  assert.ok(!src.includes('setTimeout(() => setCurrentScan'));
});

test('saved image can be restored without creating another upload', () => {
  assert.ok(src.includes('Restore last private photo'));
  assert.ok(src.includes('findLatestOwnPrivatePhoto()'));
  assert.ok(src.includes('downloadPrivateImagePreview(uri)'));
  assert.ok(helper.includes(".list(auth.user.id"));
  assert.ok(helper.includes(".download(path)"));
});

test('preview cleanup and failure messaging are provided', () => {
  assert.ok(src.includes('URL.revokeObjectURL'));
  assert.ok(src.includes('this browser could not display it'));
});
