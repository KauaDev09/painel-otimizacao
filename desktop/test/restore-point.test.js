'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildRestorePointScript } = require('../src/engine/restorePoint');

test('descrição com aspas simples é escapada (não só removida)', () => {
  const script = buildRestorePointScript("Otimização de 'BIOS'");
  assert.ok(script.includes("-Description 'Otimização de ''BIOS'''"), 'aspa simples deve dobrar em \'\'');
});

test('descrição longa é truncada em 100 caracteres', () => {
  const script = buildRestorePointScript('x'.repeat(300));
  assert.ok(!script.includes('x'.repeat(200)));
  const m = /-Description '([^']*)'/.exec(script);
  assert.ok(m, 'deve conter a descrição montada');
  assert.ok(m[1].length <= 100);
});

test('descrição padrão é usada quando nada é informado', () => {
  const script = buildRestorePointScript();
  assert.ok(script.includes("'SevenOptimizer'"));
});

test('resto do script é estável e válido (arquivo isolado)', () => {
  const script = buildRestorePointScript('Teste');
  assert.ok(/Checkpoint-Computer/.test(script));
  assert.ok(/exit 0/.test(script));
});