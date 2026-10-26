import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretSmsResponse, safeSmsDiagnosticText } from '../src/server/services/sms-response.ts';

test('valid recId means queued, not just HTTP success', () => {
  const r = interpretSmsResponse(200, JSON.stringify({recId: '3741437414', status: ''}));
  assert.equal(r.accepted, true);
  assert.equal(r.outcome, 'accepted');
  assert.equal(r.diagnostic.recIdPresent, true);
});

test('HTTP 200 with provider status error is rejected and safe', () => {
  const r = interpretSmsResponse(200, JSON.stringify({ status: 'Invalid body 566864, OTP 123456 for 09014968828' }), ['123456', '09014968828']);
  assert.equal(r.accepted, false);
  assert.equal(r.outcome, 'rejected');
  assert.match(r.diagnostic.providerMessage, /Invalid body/);
  assert.ok(!JSON.stringify(r).includes('123456'));
  assert.ok(!JSON.stringify(r).includes('09014968828'));
});

test('2xx empty response is unconfirmed, not falsely successful', () => {
  const r = interpretSmsResponse(200, '');
  assert.equal(r.accepted, false);
  assert.equal(r.outcome, 'unconfirmed');
});

test('2xx status OK with no receipt ID is unconfirmed', () => {
  const r = interpretSmsResponse(200, '{"status":"ok"}');
  assert.equal(r.accepted, false);
  assert.equal(r.outcome, 'unconfirmed');
});

test('non-2xx error is rejected and exposes provider reason', () => {
  const r = interpretSmsResponse(401, JSON.stringify({status: 'InvalidKey'}));
  assert.equal(r.accepted, false);
  assert.equal(r.diagnostic.providerMessage, 'InvalidKey');
});

test('old provider RetStatus format is recognized', () => {
  const r = interpretSmsResponse(200, JSON.stringify({ Value: '-110', RetStatus: 35, StrRetStatus: 'InvalidData' }));
  assert.equal(r.accepted, false);
  assert.equal(r.diagnostic.providerCode, '35');
  assert.equal(r.diagnostic.providerMessage, 'InvalidData');
});

test('non-JSON HTML is never copied into logs', () => {
  const r = interpretSmsResponse(200, '<h1>Error token abc</h1>');
  assert.equal(r.accepted, false);
  assert.equal(r.diagnostic.responseFormat, 'non_json');
  assert.ok(!JSON.stringify(r).includes('abc'));
});

test('nonnumeric and negative recId are not acknowledgements', () => {
  assert.equal(interpretSmsResponse(200, '{"recId":"-110"}').accepted, false);
  assert.equal(interpretSmsResponse(200, '{"recId":"oops"}').accepted, false);
  assert.equal(interpretSmsResponse(200, '{"data":{"recId":"1234567"}}').accepted, true);
});

test('sanitize secrets and OTP echoes', () => {
  const message = safeSmsDiagnosticText('Invalid 123456 with KEYABC and 09121234567', ['123456', 'KEYABC']);
  assert.equal(message.includes('123456'), false);
  assert.equal(message.includes('KEYABC'), false);
  assert.equal(message.includes('09121234567'), false);
});
