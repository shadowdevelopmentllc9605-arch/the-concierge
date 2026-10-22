import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/onboarding/StylePreferences.jsx', 'utf8');
const home = readFileSync('src/pages/Home.jsx', 'utf8');
const photos = readFileSync('src/lib/styleImages.js', 'utf8');
const expected = ['business', 'casual', 'formal', 'evening', 'outdoor', 'active', 'nightlife', 'trendy'];

test('shared image assets have unique valid URLs for the eight categories', () => {
  const entries = [...photos.matchAll(/^  (\w+): '(https:\/\/[^']+)',?$/gm)];
  const ids = entries.map(m => m[1]);
  const urls = entries.map(m => m[2]);
  assert.deepEqual(ids, expected);
  assert.equal(new Set(urls).size, 8, 'Style image URLs must be unique');
  assert.ok(urls.every(url => !url.includes('placeholder')));
});

test('onboarding, Home Shop by Style and Home outfit carousel all use the same eight images', () => {
  assert.match(source, /import \{ STYLE_IMAGE_URLS \} from '@\/lib\/styleImages'/);
  assert.match(home, /import \{ STYLE_IMAGE_URLS \} from '@\/lib\/styleImages'/);
  const onboard = source.slice(source.indexOf('const styles = ['), source.indexOf('const toggleStyle'));
  const homeStyle = home.slice(home.indexOf('const styleCategories = ['), home.indexOf('  return (', home.indexOf('const styleCategories = [')));
  const homeOutfits = home.slice(home.indexOf('const outfitSuggestions = ['), home.indexOf('const handleRefresh', home.indexOf('const outfitSuggestions = [')));
  assert.deepEqual([...onboard.matchAll(/id: '(\w+)'/g)].map(m => m[1]), expected);
  for (const style of expected) {
    assert.match(onboard, new RegExp('image: STYLE_IMAGE_URLS\\.' + style + '\\b'));
    assert.match(homeStyle, new RegExp('image: STYLE_IMAGE_URLS\\.' + style + '\\b'));
    assert.match(homeOutfits, new RegExp('image: STYLE_IMAGE_URLS\\.' + style + '\\b'));
  }
});

test('style selection and saved preferences remain unchanged', () => {
  assert.match(source, /setSelected\(prev =>/);
  assert.match(source, /await onComplete\(\{ style_preferences: selected \}\)/);
  assert.match(source, /selected\.length === 0 \|\| saving/);
});

test('account deletion dialog has a white accessible modal outside page opacity context', () => {
  const dialog = readFileSync('src/components/DeleteAccountDialog.jsx', 'utf8');
  assert.match(dialog, /createPortal\(/);
  assert.match(dialog, /document\.body/);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /bg-white p-6 text-black/);
  assert.match(dialog, /text-gray-900/);
  assert.match(dialog, /!bg-white !text-black/);
  assert.match(dialog, /confirmText !== 'DELETE'/);
  assert.match(dialog, /await onConfirm\(\)/);
});
