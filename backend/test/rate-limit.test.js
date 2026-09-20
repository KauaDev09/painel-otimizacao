'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const rateLimit = require('../src/rateLimit');

function uniq(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

test('permite requisições dentro do limite e conta restantes', () => {
  const key = uniq('rl');
  const r1 = rateLimit.hit(key, 3, 10000);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 2);
  assert.strictEqual(rateLimit.hit(key, 3, 10000).allowed, true);
  const r3 = rateLimit.hit(key, 3, 10000);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);
});

test('bloqueia ao exceder o limite e informa retryAfter', () => {
  const key = uniq('rl');
  for (let i = 0; i < 3; i++) rateLimit.hit(key, 3, 60000);
  const blocked = rateLimit.hit(key, 3, 60000);
  assert.strictEqual(blocked.allowed, false);
  assert.ok(Number.isFinite(blocked.retryAfter) && blocked.retryAfter > 0);
});

test('janelas são independentes por chave', () => {
  const k1 = uniq('rl');
  const k2 = uniq('rl');
  rateLimit.hit(k1, 1, 60000);
  assert.strictEqual(rateLimit.hit(k1, 1, 60000).allowed, false);
  assert.strictEqual(rateLimit.hit(k2, 1, 60000).allowed, true);
});

test('limite 0 ou negativo bloqueia sempre', () => {
  const key = uniq('rl');
  const r = rateLimit.hit(key, 0, 10000);
  assert.strictEqual(r.allowed, false);
});