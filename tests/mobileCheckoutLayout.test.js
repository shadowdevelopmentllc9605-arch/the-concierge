import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/pages/ProductDetail.jsx', import.meta.url), 'utf8');

test('mobile navigation never overlays shopper purchase actions', () => {
  assert.match(layout, /'ProductDetail', 'Cart', 'Checkout'/);
  assert.match(detail, /fixed bottom-0/);
  assert.match(detail, /safe-area-inset-bottom/);
});

test('successful Add to Cart offers a persistent path to checkout', () => {
  assert.match(detail, /setAddedToCart\(true\)/);
  assert.doesNotMatch(detail, /setTimeout\(\(\) => setAddedToCart\(false\)/);
  assert.match(detail, /navigate\(createPageUrl\('Cart'\)\)/);
  assert.match(detail, /View Cart & Checkout/);
});

test('product price is visibly denominated in dollars', () => {
  assert.match(detail, /<span>\$<\/span>\{product\.price\.toFixed\(2\)\}/);
});
