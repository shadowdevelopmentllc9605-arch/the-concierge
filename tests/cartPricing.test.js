import test from 'node:test';
import assert from 'node:assert/strict';
import { getCartUnitPrice, getCartSubtotal } from '../src/lib/cartPricing.js';

test('migrated numeric or string unit prices display correctly', () => {
  assert.equal(getCartUnitPrice({ unit_price: '49.95' }), 49.95);
  assert.equal(getCartUnitPrice({ price: 24.5 }), 24.5);
  assert.equal(getCartUnitPrice({ product_price: 10 }), 10);
});

test('cart subtotal handles mixed legacy and new records', () => {
  assert.equal(getCartSubtotal([
    { unit_price: 12.5, quantity: 2 },
    { price: 5, quantity: 1 },
    { product_price: 20 }
  ]), 50);
});

test('invalid prices and quantities do not create misleading totals', () => {
  assert.equal(getCartSubtotal([{ price: 'unavailable', quantity: 2 }, { price: 30, quantity: 0 }]), 0);
});
