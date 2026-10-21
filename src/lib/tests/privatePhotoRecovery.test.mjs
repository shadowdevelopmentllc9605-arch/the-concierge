import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const body = readFileSync('src/components/onboarding/BodyScan.jsx', 'utf8');
const helper = readFileSync('src/lib/privateFiles.js','utf8');
const bridge = readFileSync('src/api/base44Client.js', 'utf8');

test('Android camera preview and each angle stay visible after saving', () => {
  assert.ok(body.includes('URL.createObjectURL(file)'));
  assert.ok(body.includes('const selectedView = currentScan'));
  assert.ok(body.includes('persistPrivateView(selectedView, file_uri)'));
  assert.ok(body.includes("['front', 'side', 'back'].includes(view)"));
  assert.ok(!body.includes('setTimeout(() => setCurrentScan'));
});

test('every angle is saved in the authenticated own fit profile, and reloaded', () => {
  assert.ok(body.includes("base44.entities.UserProfile.update(userId, { ['body_scan_' + view]: uri })"));
  assert.ok(body.includes('auth?.user?.id !== userId'));
  assert.ok(bridge.includes("if ('body_scan_front' in p)"));
  assert.ok(bridge.includes("if ('body_scan_side' in p)"));
  assert.ok(bridge.includes("if ('body_scan_back' in p)"));
  assert.ok(bridge.includes("if (entity === 'UserProfile') return saveProfile(id, payload, false)"));
  assert.ok(bridge.includes('body_scan_front: fit.body_scan_front_path'));
  assert.ok(bridge.includes('body_scan_side: fit.body_scan_side_path'));
  assert.ok(bridge.includes('body_scan_back: fit.body_scan_back_path'));
});

test('restores a different owner-private photo to the selected view', () => {
  assert.ok(body.includes('Restore saved photo to '));
  assert.ok(body.includes('findLatestOwnPrivatePhoto({ excludeUris: Object.values(scans).filter(Boolean) })'));
  assert.ok(body.includes('downloadPrivateImagePreview(uri)'));
  assert.ok(body.includes('persistPrivateView(selectedView, uri)'));
  assert.ok(helper.includes('excludeUris = []'));
  assert.ok(helper.includes('!assigned.has(prefix + entry.name)'));
  assert.ok(helper.includes(".list(auth.user.id"));
  assert.ok(helper.includes(".download(path)"));
});

test('retake clears the selected saved angle, not other angles', () => {
  assert.ok(body.includes('persistPrivateView(view, null)'));
  assert.ok(body.includes('setScans(prev => ({ ...prev, [view]: null }))'));
  assert.ok(body.includes('URL.revokeObjectURL'));
  assert.ok(body.includes('this browser could not display it'));
});
