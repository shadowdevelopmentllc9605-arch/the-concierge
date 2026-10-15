import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');

test('deployed Supabase webhook TypeScript has no parse errors', () => {
  const source = ts.createSourceFile('index.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(source.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('webhook requires signed Stripe events and deduplicates', () => {
  assert.match(code, /constructEventAsync/);
  assert.match(code, /claim_stripe_webhook_event/);
  assert.match(code, /finish_stripe_webhook_event/);
});

test('replayed payment webhook can repair missing purchase lines', () => {
  assert.doesNotMatch(code, /if\(o\.data\.payment_status==="paid"\)return/);
  assert.match(code, /purchase_items"\)\.upsert/);
  assert.match(code, /onConflict:"purchase_id,external_line_key"/);
  assert.ok(code.indexOf('purchase_items").upsert') < code.indexOf('payment_status:"paid"'));
});
