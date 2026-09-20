'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  efiNameArg,
  efiGuidArg,
  efiHexArg,
  applyOffset,
  firmwareVendor
} = require('../src/bios/optimization/efiVar');

const GUID = '{E2C95E0B-5A9F-46D5-BE6A-70A6BA6F5A53}';

test('efiNameArg: aceita nome válido e rejeita injeção', () => {
  assert.strictEqual(efiNameArg('Setup'), '"Setup"');
  assert.throws(() => efiNameArg('x & calc.exe'), /inválido/i);
  assert.throws(() => efiNameArg('a" | whoami'), /inválido/i);
  assert.throws(() => efiNameArg('a'.repeat(65)), /inválido/i);
  assert.throws(() => efiNameArg(''), /inválido/i);
});

test('efiGuidArg: aceita GUID com chaves e rejeita variações perigosas', () => {
  assert.strictEqual(efiGuidArg(GUID), `"${GUID}"`);
  assert.strictEqual(efiGuidArg(GUID.toLowerCase()), `"${GUID.toLowerCase()}"`);
  assert.throws(() => efiGuidArg('E2C95E0B-5A9F-46D5-BE6A-70A6BA6F5A53'), /inválido/i);
  assert.throws(() => efiGuidArg(`${GUID} & calc`), /inválido/i);
  assert.throws(() => efiGuidArg(''), /inválido/i);
});

test('efiHexArg: aceita só hex', () => {
  assert.strictEqual(efiHexArg('00ffAb'), '00ffAb');
  assert.throws(() => efiHexArg('zz'), /inválido/i);
  assert.throws(() => efiHexArg('0x10'), /inválido/i);
  assert.throws(() => efiHexArg('abcd & whoami'), /inválido/i);
});

test('applyOffset: aplica byte-exato little-endian', () => {
  const r = applyOffset('0100', { offset: 0, size: 2, andMask: 0x0000, value: 0x0200 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.bytesHex, '0002');
});

test('applyOffset: unchanged quando o bit já está setado', () => {
  const r = applyOffset('01', { offset: 0, size: 1, andMask: 0xff, value: 0x01 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.unchanged, true);
  assert.strictEqual(r.bytesHex, '01');
});

test('applyOffset: offset fora dos limites é recusado', () => {
  const r = applyOffset('01', { offset: 5, size: 1, value: 1 });
  assert.strictEqual(r.ok, false);
});

test('firmwareVendor: identifica Insyde e AMI por fingerprint', () => {
  assert.strictEqual(firmwareVendor({ profile: { bios: { vendor: 'Insyde Corp.' } } }), 'insyde');
  assert.strictEqual(firmwareVendor({ profile: { bios: { vendor: 'American Megatrends Inc.' } } }), 'ami');
  assert.strictEqual(firmwareVendor({ profile: { bios: { vendor: '' } } }), 'ami');
});