import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shop = readFileSync(new URL('../src/pages/Shop.jsx', import.meta.url), 'utf8');
const instore = readFileSync(new URL('../src/pages/InStoreMode.jsx', import.meta.url), 'utf8');

test('product card and wishlist action are separate mobile interactive targets', () => {
  assert.match(shop, /filteredProducts\.map\(\(product, idx\) => \(\s*<motion\.div/);
  assert.doesNotMatch(shop, /filteredProducts\.map\(\(product, idx\) => \(\s*<motion\.button/);
  assert.match(shop, /role="link"/);
  assert.match(shop, /onKeyDown=\{\(e\) => \{/);
  assert.match(shop, /type="button"\s+aria-label=\{wishlist\.includes\(product\.id\)/);
  assert.match(shop, /toggleWishlist\(product, e\)/);
});

test('shopper sees a retry state rather than empty catalog on product fetch error', () => {
  assert.match(shop, /setCatalogLoadError\('Products could not be loaded right now/);
  assert.match(shop, /catalogLoadError \? \(/);
  assert.match(shop, /onClick=\{\(\) => loadData\(\)\}/);
});

test('manual store selection has explicit readable high contrast colors', () => {
  assert.match(instore, /Select Store Manually/);
  assert.match(instore, /backgroundColor: '#272727', color: '#ffffff'/);
});
