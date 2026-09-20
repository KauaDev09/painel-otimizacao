'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { maskKey } = require('../src/services/accessLog');

test('maskKey: valor ausente/null vira null', () => {
  assert.strictEqual(maskKey(null), null);
  assert.strictEqual(maskKey(''), null);
  assert.strictEqual(maskKey('   '), null);
  assert.strictEqual(maskKey(undefined), null);
});

test('maskKey: chave muito curta vira placeholder', () => {
  assert.strictEqual(maskKey('ABC'), 'mascarada');
  assert.strictEqual(maskKey('12345678'), 'mascarada');
});

test('maskKey: mascarar mantém primeiros e últimos 4 e trunca em 32', () => {
  // A chave é truncada para 32 chars antes de mascarar, então o sufixo é dos 32 primeiros.
  const key = 'SEVEN-ABCD-EFGH-IJKL-MNOP-QRST-UVWX';
  assert.strictEqual(maskKey(key), 'SEVE...ST-U');
  const long = 'X'.repeat(60);
  const masked = maskKey(long);
  assert.strictEqual(masked, 'XXXX...XXXX');
  assert.ok(masked.length === 11);
  assert.ok(!masked.includes('X'.repeat(12)), 'não pode conter sequência longa da chave');
});

test('maskKey: nunca devolve a chave completa', () => {
  const key = 'A1B2-C3D4-E5F6-G7H8';
  assert.notStrictEqual(maskKey(key), key);
});