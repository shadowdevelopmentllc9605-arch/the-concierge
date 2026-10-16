import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedCartLine, getAvailableCartOffers } from '../src/lib/cartVariantSelection.js';

const now = Date.parse('2026-10-16T12:00:00Z');
const product = () => ({
  id: 'product-123',
  product_name: 'Phase One Test Tee',
  images: ['https://example.test/image.png'],
  variants: [
    { id: 'variant-M-blue', active: true, size_label: 'M', color_name: 'Blue', width_code: null },
    { id: 'variant-L-blue', active: true, size_label: 'L', color_name: 'Blue', width_code: null }
  ],
  offers: [{
    id: 'offer1', product_master_id: 'product-123', product_variant_id: 'variant-M-blue',
    offer_scope: 'variant', business_id: 'merchant-123',
    active: true, available_online: true, availability: 'in_stock',
    fulfillment: 'shipping', stock_quantity: 4, stale_after: '2026-10-18T12:00:00Z',
    currency: 'USD', current_price: 25, regular_price: 30, sale_active: false
  }]
});
const selected = { size: 'M', color: 'Blue', width: '' };

test('maps the exact selected variant and verified price to Supabase cart fields', () => {
  const line = buildVerifiedCartLine(product(), selected, now);
  assert.deepEqual(line, {
    product_master_id: 'product-123', product_variant_id: 'variant-M-blue',
    product_name: 'Phase One Test Tee', product_image_url: 'https://example.test/image.png',
    unit_price: 25, size_label: 'M', color_name: 'Blue',
    width_code: null, quantity: 1
  });
  assert.equal(Object.hasOwn(line, 'size'), false);
  assert.equal(Object.hasOwn(line, 'product_id'), false);
});

test('never guesses a variant when the selected size differs', () => {
  assert.equal(getAvailableCartOffers(product(), { size: 'L', color: 'Blue' }, now).length, 0);
  assert.throws(() => buildVerifiedCartLine(product(), { size: 'XL', color: 'Blue' }, now), /verified/);
});
test('rejects expired, unavailable, non-online, and unsourced offers', () => {
  for (const patch of [
    { stale_after: '2026-10-15T12:00:00Z' },
    { availability: 'out_of_stock' },
    { active: false },
    { available_online: false },
    { fulfillment: 'pickup' },
    { business_id: null },
    { stock_quantity: 0 },
    { current_price: -2, regular_price: -3 },
    { currency: 'EUR' }
  ]) {
    const p = product();
    Object.assign(p.offers[0], patch);
    assert.throws(() => buildVerifiedCartLine(p, selected, now), /verified/, JSON.stringify(patch));
  }
});
test('requires exactly one offer: multiple merchants must not be silently selected', () => {
  const p = product(); p.offers.push({ ...p.offers[0], id: 'offer2', business_id: 'merchant-456' });
  assert.throws(() => buildVerifiedCartLine(p, selected, now), /exactly one/);
});
test('uses a valid promotional price only when the sale is active', () => {
  const p = product(); Object.assign(p.offers[0], { sale_price: 19.99, sale_active: true });
  assert.equal(buildVerifiedCartLine(p, selected, now).unit_price, 19.99);
  p.offers[0].sale_active = false;
  assert.equal(buildVerifiedCartLine(p, selected, now).unit_price, 25);
});
