#!/usr/bin/env node
/**
 * Direct MeliPayamak smoke test, independent of Next, Prisma and the OTP UI.
 * Requires Node 22+ and an existing project .env file. It sends exactly one
 * SMS ONLY if --send is explicitly provided. No credentials or OTPs are logged.
 *
 * Examples:
 *   node --experimental-strip-types scripts/diagnose-sms.mjs
 *   node --experimental-strip-types scripts/diagnose-sms.mjs --to=09XXXXXXXXX --body-id=566864 --send
 */
import { existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { interpretSmsResponse } from '../src/server/services/sms-response.ts';

if (typeof process.loadEnvFile !== 'function') {
  console.error('Node.js 22+ is required for this diagnostic script.');
  process.exit(2);
}
if (existsSync('.env')) process.loadEnvFile('.env');

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--') && a.includes('='))
  .map((a) => { const p = a.indexOf('='); return [a.slice(2, p), a.slice(p + 1)]; }));
const send = process.argv.includes('--send');
const key = (process.env.MELIPAYAMAK_SHARED_KEY ?? '').trim();
const bodyId = flags['body-id'] ?? (process.env.MELIPAYAMAK_OTP_BODY_ID ?? '').trim();
const to = (flags.to ?? '').trim();
const id = Number(bodyId);
const masked = /^09\d{9}$/.test(to) ? `${to.slice(0, 3)}****${to.slice(-4)}` : '(not provided)';

console.log(JSON.stringify({
  test: 'melipayamak_shared_otp',
  mode: send ? 'SEND_ONE_REAL_SMS' : 'DRY_RUN',
  node: process.version,
  keyConfigured: Boolean(key),
  otpBodyId: bodyId || '(missing)',
  recipient: masked,
  mockEnabled: process.env.OTP_MOCK === 'true',
}));

if (!send) {
  console.log('Dry run only. Use --to=09XXXXXXXXX --body-id=566864 --send to test one real SMS.');
  process.exit(0);
}
if (!key || !Number.isSafeInteger(id) || id <= 0 || !/^09\d{9}$/.test(to)) {
  console.error('Missing shared key, valid body ID, or 11-digit Iranian mobile number.');
  process.exit(2);
}

// A disposable test code, NOT a login code; never stored in the application's OTP database.
const testCode = String(randomInt(100000, 1000000));
try {
  const response = await fetch(`https://console.melipayamak.com/api/send/shared/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ bodyId: id, to, args: [testCode] }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.text();
  const result = interpretSmsResponse(response.status, payload, [key, to, testCode]);
  console.log(JSON.stringify({ outcome: result.outcome, ...result.diagnostic }));
  if (!result.accepted) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ outcome: 'transport_error', name: error instanceof Error ? error.name : 'unknown' }));
  process.exitCode = 1;
}
