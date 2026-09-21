'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const integrity = require('../src/security/scriptIntegrity');
const manifest = require('../src/security/script-manifest.json');

const keys = Object.keys(manifest.files || manifest);

test('manifest presente e com os scripts do pacote', () => {
  assert.ok(keys.length >= 70, `esperava >= 70 entradas, tem ${keys.length}`);
  assert.ok(keys.some((k) => /engine\/scripts\/.+\.bat$/i.test(k)));
});

test('arquivo adulterado é recusado (assertFile SCRIPT_INTEGRITY)', () => {
  const key = keys.find((k) => /engine\/scripts\/.+\.bat$/i.test(k));
  const realPath = path.join(__dirname, '..', 'src', key);
  assert.ok(fs.existsSync(realPath), `fonte deve existir: ${realPath}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's7-int-'));
  const tampered = path.join(dir, 'tampered.bat');
  fs.writeFileSync(tampered, Buffer.concat([
    fs.readFileSync(realPath),
    Buffer.from('\r\nREM ADULTERADO')
  ]));
  assert.throws(
    () => integrity.assertFile(key, tampered),
    (e) => e.code === 'SCRIPT_INTEGRITY' && /recusada/i.test(e.message)
  );
  assert.strictEqual(integrity.verifyFile(key, tampered), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('arquivo genuíno é aprovado', () => {
  const key = keys[0];
  const realPath = path.join(__dirname, '..', 'src', key);
  assert.ok(fs.existsSync(realPath), `fonte deve existir: ${realPath}`);
  assert.strictEqual(integrity.verifyFile(key, realPath), true);
});

test('verifyContent diferencia conteúdo em memória', () => {
  const key = keys[0];
  const real = fs.readFileSync(path.join(__dirname, '..', 'src', key));
  assert.strictEqual(integrity.verifyContent(key, real), true);
  assert.strictEqual(integrity.verifyContent(key, Buffer.concat([real, Buffer.from('x')])), false);
});

test('chave fora do manifest não bloqueia (script temporário)', () => {
  assert.strictEqual(integrity.verifyFile('engine/scripts/tmp/gerado-aqui.ps1', path.join(__dirname, 'x.ps1')), true);
});