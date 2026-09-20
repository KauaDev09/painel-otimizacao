'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { safeEqualStr, cmpVer, isLifetimePlan, signToken, verifyToken } = require('../src/util');

test('safeEqualStr: comparação timing-safe', () => {
  assert.strictEqual(safeEqualStr('abc', 'abc'), true);
  assert.strictEqual(safeEqualStr('abc', 'abd'), false);
  assert.strictEqual(safeEqualStr('a', 'ab'), false);
  assert.strictEqual(safeEqualStr('', ''), true);
  assert.strictEqual(safeEqualStr(null, 'abc'), false);
  assert.strictEqual(safeEqualStr('abc', 123), false);
  assert.strictEqual(safeEqualStr(123, 123), false);
});

test('cmpVer: ordenação semântica X.Y.Z', () => {
  assert.strictEqual(cmpVer('2.1.10', '2.1.11'), -1);
  assert.strictEqual(cmpVer('2.1.11', '2.1.10'), 1);
  assert.strictEqual(cmpVer('3.0.0', '2.99.99'), 1);
  assert.strictEqual(cmpVer('2.1', '2.1.0'), 0);
  assert.strictEqual(cmpVer('2.1.0', '2.1.0'), 0);
  assert.strictEqual(cmpVer(null, '2.1.0'), -1);
  assert.strictEqual(cmpVer('1.9.9', '2.0.0'), -1);
});

test('isLifetimePlan: reconhece planos vitalícios', () => {
  assert.strictEqual(isLifetimePlan({ plano: 'lifetime' }), true);
  assert.strictEqual(isLifetimePlan({ plano: 'vitalicia' }), true);
  assert.strictEqual(isLifetimePlan({ expira_em: null, plano: 'mensal' }), true);
  assert.strictEqual(isLifetimePlan({ expira_em: '2027-01-01', plano: 'mensal' }), false);
  assert.strictEqual(isLifetimePlan(null), true);
});

test('signToken/verifyToken: roundtrip e rejeição de token adulterado', () => {
  const secret = 'chave-de-teste';
  const token = signToken({ typ: 'admin', usuario: 'root' }, secret, 3600);
  const payload = verifyToken(token, secret);
  assert.strictEqual(payload.typ, 'admin');
  assert.strictEqual(payload.usuario, 'root');
  const corrupted = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
  assert.strictEqual(verifyToken(corrupted, secret), null);
  assert.strictEqual(verifyToken(token, 'outra-chave'), null);
  assert.strictEqual(verifyToken('sem.mac', secret), null);
  assert.strictEqual(verifyToken(null, secret), null);
});