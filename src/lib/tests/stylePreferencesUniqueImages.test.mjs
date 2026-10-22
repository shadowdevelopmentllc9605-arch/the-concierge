import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/onboarding/StylePreferences.jsx', 'utf8');

test('the eight onboarding style cards use eight distinct real image sources', () => {
  const optionStart = source.indexOf('const styles = [');
  const optionEnd = source.indexOf('const toggleStyle', optionStart);
  assert.ok(optionStart !== -1 && optionEnd > optionStart);
  const options = source.slice(optionStart, optionEnd);
  const ids = [...options.matchAll(/id: '([^']+)'/g)].map(m => m[1]);
  const images = [...options.matchAll(/image: '(https:\/\/[^']+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['business','casual','formal','evening','outdoor','active','nightlife','trendy']);
  assert.equal(images.length, 8);
  assert.equal(new Set(images).size, 8, 'No photo URL may be reused for another style');
  assert.ok(images.every(url => /^https:\/\//.test(url)));
  assert.ok(images.every(url => !url.includes('placeholder')));
});

test('style selection and saved preferences remain unchanged', () => {
  assert.match(source, /setSelected\(prev =>/);
  assert.match(source, /await onComplete\(\{ style_preferences: selected \}\)/);
  assert.match(source, /selected\.length === 0 \|\| saving/);
});
