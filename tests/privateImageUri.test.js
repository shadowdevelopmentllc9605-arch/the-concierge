import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateImageUri } from '../src/lib/privateImageUri.js';

const owner = '11111111-2222-4333-8444-555555555555';

test('owner-scoped sensitive image references are accepted', () => {
  assert.equal(isPrivateImageUri(`concierge-sensitive/${owner}/abc-photo.jpg`), true);
});

test('public URLs and wrong storage buckets cannot masquerade as private scans', () => {
  for (const value of [
    'https://example.com/scan.jpg',
    'http://example.com/scan.jpg',
    `concierge-uploads/${owner}/abc-photo.jpg`,
    'concierge-sensitive/abc-photo.jpg',
    `concierge-sensitive/${owner}/../other.jpg`,
    `concierge-sensitive/${owner}/photo.jpg?token=x`,
    null,
    undefined,
    ''
  ]) {
    assert.equal(isPrivateImageUri(value), false, String(value));
  }
});
