/** Run with: node --test tests/order-status-undo.test.mjs (no npm install needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/server/services/order-status.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', 'require', code)(exports, require);
const { previousOrderStatus, stockEffectForStatusChange } = exports;
const stages = ['awaiting_payment','preparing','packaged','shipped','delivered'];
const event = (status, isUndo = false) => ({ status, isUndo });

test('all fulfilment stages can walk backwards one step at a time', () => {
 const events = stages.map(s => event(s));
 for (let i=stages.length-1; i>0; i--) {
   assert.equal(previousOrderStatus(stages[i],events), stages[i-1]);
   events.push(event(stages[i-1],true));
 }
 assert.equal(previousOrderStatus('awaiting_payment',events),null);
});

test('undo handles legacy one-event manual orders', () => {
 assert.equal(previousOrderStatus('delivered',[event('delivered')]),'shipped');
 assert.equal(previousOrderStatus('shipped',[event('delivered'),event('shipped',true)]),'packaged');
});

test('refunds, returns, cancellations, failures and expiry undo to actual previous', () => {
 for (const terminal of ['cancelled','returned','refunded','payment_failed','expired']) {
   assert.equal(previousOrderStatus(terminal,[event('preparing'),event(terminal)]),'preparing');
 }
});

test('duplicate tracking events do not become previous statuses', () => {
 assert.equal(previousOrderStatus('shipped',[event('preparing'),event('shipped'),event('shipped')]),'preparing');
});

test('undo then forward then undo again uses the new history', () => {
 const events=[event('awaiting_payment'),event('preparing'),event('packaged'),event('preparing',true),event('packaged')];
 assert.equal(previousOrderStatus('packaged',events),'preparing');
});

test('inventory: restore once on cancellation and re-reserve only on reactivation', () => {
 const plan = (destination,stockCommitted,inventoryWasCommitted=true)=> stockEffectForStatusChange({destination,stockCommitted,inventoryWasCommitted});
 assert.equal(plan('cancelled',true),'restore');
 assert.equal(plan('cancelled',false),'none');
 assert.equal(plan('returned',true),'restore');
 assert.equal(plan('refunded',false),'none');
 assert.equal(plan('refunded',true),'none');
 assert.equal(plan('preparing',false),'reserve');
 assert.equal(plan('packaged',false),'reserve');
 assert.equal(plan('shipped',false),'reserve');
 assert.equal(plan('delivered',false),'reserve');
 assert.equal(plan('preparing',true),'none');
 assert.equal(plan('preparing',false,false),'none');
});
