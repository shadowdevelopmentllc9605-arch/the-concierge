import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeShopperPurchase } from '../shopperPurchases.js';

test('shopper purchase includes purchased line items with sizes, quantity and price', () => {
  const original = {
    id: 'purchase-1',
    shopper_user_id: 'shopper-1',
    order_id: 'order-1',
    total: '67.50',
    purchase_items: [
      { id: 'line-1', product_name: 'Jacket', size_label: 'M', color_name: 'Navy', unit_price: '45.00', quantity: 1 },
      { id: 'line-2', product_name: 'Socks', size_label: 'L', color_name: 'Black', unit_price: '11.25', quantity: 2 },
    ],
  };
  const result = normalizeShopperPurchase(original);
  assert.equal(result.user_id, 'shopper-1');
  assert.equal(result.order_id, 'order-1');
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map(line => [line.name, line.size, line.color, line.price, line.quantity]), [
    ['Jacket', 'M', 'Navy', 45, 1],
    ['Socks', 'L', 'Black', 11.25, 2],
  ]);
  assert.equal(result.purchase_items, undefined);
  assert.equal(original.purchase_items.length, 2, 'source record remains unchanged');
});

test('older purchases without line items remain readable', () => {
  const result = normalizeShopperPurchase({ id: 'legacy-1', product_name: 'Hat', product_price: 19.99 });
  assert.deepEqual(result.items, []);
  assert.equal(result.product_name, 'Hat');
});

test('shopper adapter fetches line items; Closet renders line data', () => {
  const adapter = readFileSync('src/api/base44Client.js', 'utf8');
  const closet = readFileSync('src/pages/Closet.jsx', 'utf8');
  assert.match(adapter, /normalizeShopperPurchase\(out\)/);
  assert.equal((adapter.match(/select\(entity === 'Purchase' \? '\*,purchase_items\(\*\)' : '\*'\)/g) || []).length, 2);
  assert.match(closet, /const lines = Array\.isArray\(item\.items\)/);
  assert.match(closet, /lines\.map\(/);
});
