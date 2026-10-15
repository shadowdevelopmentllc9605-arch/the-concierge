import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const actions = readFileSync(new URL('../supabase/functions/concierge-actions/index.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');

for (const [name, code] of [['actions', actions], ['webhook', webhook]]) {
  test(`Supabase ${name} source parses as TypeScript`, () => {
    const source = ts.createSourceFile(`${name}.ts`, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.deepEqual(source.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
  });
}

test('public shopper checkout does not trust cart prices or ambiguous retailer offers', () => {
  assert.match(actions, /retailer_offer/);
  assert.match(actions, /priceByItem\.set/);
  assert.match(actions, /eligible\.length!==1/);
  assert.match(actions, /Refresh your cart before paying/);
  assert.match(actions, /stale_after/);
  assert.match(actions, /priceCents/);
});

test('Stripe checkout includes real shipping, tax, and valid order status', () => {
  assert.match(actions, /fulfillment_status:"pending_payment"/);
  assert.doesNotMatch(actions, /fulfillment_status:"pending"/);
  assert.match(actions, /shipping_options:\[/);
  assert.match(actions, /shipping_address_collection/);
  assert.match(actions, /automatic_tax:\{enabled:true\}/);
  assert.match(actions, /application_fee_amount:feeCents/);
});

test('live Stripe Checkout remains disabled until owner approval', () => {
  assert.match(actions, /CONCIERGE_LIVE_CHECKOUT_ENABLED/);
  assert.match(actions, /CONCIERGE_TAX_CONFIGURED/);
  assert.match(actions, /checkout_not_approved/);
  assert.match(actions, /Unapproved checkout origin/);
  assert.match(actions, /CONCIERGE_ALLOWED_ORIGINS/);
});

test('Stripe webhook stores actual shipping and taxes and handles full refund', () => {
  assert.match(webhook, /amount_shipping/);
  assert.match(webhook, /amount_tax/);
  assert.match(webhook, /event\.type==="charge\.refunded"/);
  assert.match(webhook, /checkout_session_id===matched\.id/);
  assert.match(webhook, /payment_status:"refunded"/);
  assert.match(webhook, /status:"refunded"/);
  assert.doesNotMatch(webhook, /payment_status:event\.type\.endsWith\("expired"\)\?"expired"/);
  assert.match(webhook, /eq\("payment_status","pending"\)/);
});

test('refund event cannot claim that application fee was returned', () => {
  const start=webhook.indexOf('event.type==="charge.refunded"');
  const end=webhook.indexOf('event.type==="checkout.session.async_payment_succeeded"',start);
  assert.ok(start>0&&end>start);
  const section=webhook.slice(start,end);
  assert.doesNotMatch(section, /platform_fee_status:"refunded"/);
});
