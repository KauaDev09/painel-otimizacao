'use strict';

// Testes do módulo BIOS Optimization — SOMENTE mock.
// Nenhum comando real de BIOS/NVRAM/powercfg elevado é executado.

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { BiosManager } = require('../src/bios/optimization/biosManager');
const { assertAllowed, DENIED } = require('../src/bios/optimization/allowedOperations');
const { loadScenario, gigabyteA520Profile, extraFor } = require('../src/bios/optimization/mockHardware');
const { detectMotherboard } = require('../src/hardware/motherboardService');
const { detectBios } = require('../src/bios/biosService');
const { detectMemory } = require('../src/hardware/memoryService');
const { selectProvider } = require('../src/bios/optimization/providers');

function tmpMgr() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-bios-'));
  const mgr = new BiosManager();
  mgr.init(dir);
  return { mgr, dir };
}

function rawBoard(manufacturer, product, biosMfr, biosVer) {
  return {
    board: [{ Manufacturer: manufacturer, Product: product, Version: 'x.x' }],
    system: [{ Manufacturer: manufacturer, Model: product }],
    chassis: [{ ChassisTypes: [3] }],
    bios: [{ Manufacturer: biosMfr, SMBIOSBIOSVersion: biosVer, ReleaseDateStr: '2024-03-01', SMBIOSMajorVersion: 3, SMBIOSMinorVersion: 3 }],
    ram: [{
      Capacity: 8 * 1024 * 1024 * 1024,
      Speed: 3200,
      ConfiguredClockSpeed: 2133,
      Manufacturer: 'Kingston',
      PartNumber: 'MockPN',
      SMBIOSMemoryType: 26,
      FormFactor: 8,
      DeviceLocator: 'DIMM 0'
    }]
  };
}

async function main() {
  console.log('> Testes BIOS Optimization (mock)\n');

  // ---- Detecção placa-mãe / BIOS / RAM (funções reais sobre dados sintéticos) ----
  const raw = rawBoard('Gigabyte Technology Co., Ltd.', 'A520M K V2', 'Award Software International, Inc.', 'F15');
  const board = detectMotherboard(raw);
  assert.strictEqual(board.vendorKey, 'gigabyte', 'placa-mãe Gigabyte');
  assert.ok(/A520M K V2/i.test(board.boardProduct), 'modelo A520M K V2');
  console.log('detecção placa-mãe OK');

  const bios = detectBios(raw);
  assert.ok(bios.detected, 'BIOS detectada');
  assert.ok(bios.version, 'versão BIOS');
  console.log('detecção BIOS OK');

  const ram = detectMemory(raw);
  assert.strictEqual(ram.profile, 'likely_inactive', 'XMP provavelmente inativo');
  assert.strictEqual(ram.minConfigMHz, 2133);
  assert.strictEqual(ram.maxRatedMHz, 3200);
  console.log('detecção RAM / XMP OK');

  // ---- Provider correto ----
  const { mgr } = tmpMgr();
  mgr.setMock('xmp_off');
  let payload = await mgr.scan();
  assert.strictEqual(payload.provider, 'gigabyte', 'provider Gigabyte');
  const xmp = payload.items.find((i) => i.id === 'xmp');
  assert.ok(xmp, 'item XMP presente');
  assert.strictEqual(xmp.state.key, 'disabled');
  assert.strictEqual(xmp.status, 'manual');
  assert.strictEqual(xmp.button, 'CONFIGURAÇÃO MANUAL');
  assert.ok(!xmp.auto, 'XMP sem apply automático nesta placa');
  console.log('XMP OFF + manual OK');

  const rebar = payload.items.find((i) => i.id === 'resizable_bar');
  assert.ok(rebar, 'Resizable BAR presente');
  assert.strictEqual(rebar.state.key, 'disabled');
  console.log('detecção Resizable BAR OK');

  const sb = payload.items.find((i) => i.id === 'secure_boot');
  assert.ok(sb, 'Secure Boot presente');
  assert.strictEqual(sb.state.key, 'disabled');
  console.log('detecção Secure Boot OK');

  // ---- EXPO (AMD DDR5) ----
  const expoProfile = gigabyteA520Profile({ ramConfigMhz: 4800, ramRatedMhz: 6000 });
  expoProfile.ram.ddrType = 'DDR5';
  expoProfile.ram.modules.forEach((m) => { m.type = 'DDR5'; });
  mgr.setMock({ profile: expoProfile, extra: extraFor({ rebar: 'disabled' }) });
  payload = await mgr.scan();
  assert.ok(payload.items.find((i) => i.id === 'expo'), 'EXPO em AMD DDR5');
  assert.ok(!payload.items.find((i) => i.id === 'xmp'), 'XMP oculto quando EXPO se aplica');
  console.log('detecção EXPO OK');

  // ---- Hardware incompatível ----
  mgr.setMock('unsupported');
  payload = await mgr.scan();
  assert.strictEqual(payload.provider, 'generic');
  const xmpU = payload.items.find((i) => i.id === 'xmp');
  assert.ok(xmpU);
  assert.strictEqual(xmpU.status, 'manual');
  console.log('hardware sem provider específico → manual OK');

  // ---- Operação não suportada / whitelist ----
  assert.throws(() => assertAllowed('bios_flash'), /bloqueada|não autorizada/i);
  assert.throws(() => assertAllowed('arbitrary_nvram_write'));
  assert.ok(DENIED.has('bios_flash'));
  console.log('whitelist / operação não suportada OK');

  // ---- Sem privilégios ----
  const priv = tmpMgr();
  priv.mgr.setMock('no_privileges');
  await priv.mgr.scan();
  const noPriv = await priv.mgr.apply('high_performance_plan');
  assert.strictEqual(noPriv.ok, false);
  assert.strictEqual(noPriv.code, 'NO_PRIVILEGES');
  console.log('ausência de privilégios OK');

  // ---- Provider incorreto ----
  const wrong = tmpMgr();
  wrong.mgr.setMock('wrong_provider');
  await wrong.mgr.scan();
  assert.strictEqual(wrong.mgr.lastScan.provider.id, 'asus');
  let threw = false;
  try {
    await wrong.mgr.apply('high_performance_plan', { requireProvider: 'gigabyte' });
  } catch (e) {
    threw = e.code === 'WRONG_PROVIDER';
  }
  assert.ok(threw, 'provider incorreto rejeitado');
  console.log('provider incorreto OK');

  // ---- Dry run + apply falha ----
  const fail = tmpMgr();
  fail.mgr.setMock({ ...loadScenario('apply_fail'), extra: extraFor({ elevated: true }), flags: { applyFail: true } });
  await fail.mgr.scan();
  const preview = fail.mgr.dryRun('high_performance_plan');
  assert.ok(preview.setting);
  const failedApply = await fail.mgr.apply('high_performance_plan');
  assert.strictEqual(failedApply.ok, false);
  console.log('dry-run + falha de aplicação OK');

  // ---- Pending + reboot flow + verificação XMP OFF→ON ----
  const flow = tmpMgr();
  flow.mgr.setMock({ ...loadScenario('xmp_off'), allowAuto: ['enable_xmp'] });
  await flow.mgr.scan();
  const listed = flow.mgr.list().items.find((i) => i.id === 'xmp');
  assert.strictEqual(listed.button, 'ATIVAR');
  const applied = await flow.mgr.apply('xmp', { reboot: true });
  assert.strictEqual(applied.ok, true);
  assert.strictEqual(applied.pending, true);
  assert.ok(applied.reboot && applied.reboot.ok);
  const afterApply = flow.mgr.list().items.find((i) => i.id === 'xmp');
  assert.strictEqual(afterApply.status, 'pending_reboot');
  assert.notStrictEqual(afterApply.status, 'active', 'nunca ATIVO sem verificação');
  console.log('pending + reboot flow OK');

  flow.mgr.setMock({ ...loadScenario('xmp_on'), allowAuto: ['enable_xmp'] });
  const verified = await flow.mgr.verifyPending();
  assert.strictEqual(verified.checked.length, 1);
  assert.strictEqual(verified.checked[0].status, 'success');
  const afterOk = flow.mgr.list().items.find((i) => i.id === 'xmp');
  assert.ok(afterOk.status === 'success' || afterOk.state.key === 'enabled_or_jedec');
  console.log('verificação pós-reboot XMP OK');

  // ---- ReBAR OFF→ON ----
  const rb = tmpMgr();
  rb.mgr.setMock({ ...loadScenario('rebar_off'), allowAuto: ['enable_resizable_bar'] });
  await rb.mgr.scan();
  const rbApply = await rb.mgr.apply('resizable_bar', { reboot: true });
  assert.ok(rbApply.ok && rbApply.pending);
  rb.mgr.setMock({ ...loadScenario('rebar_on'), allowAuto: ['enable_resizable_bar'] });
  const rbVer = await rb.mgr.verifyPending();
  assert.strictEqual(rbVer.checked[0].status, 'success');
  console.log('ReBAR OFF→ON OK');

  // ---- Falha após reboot ----
  const vfail = tmpMgr();
  vfail.mgr.setMock({ ...loadScenario('xmp_off'), allowAuto: ['enable_xmp'], flags: { verifyFail: true } });
  await vfail.mgr.scan();
  await vfail.mgr.apply('xmp', { reboot: true });
  const vf = await vfail.mgr.verifyPending();
  assert.strictEqual(vf.checked[0].status, 'failed');
  console.log('falha após reboot OK');

  // ---- Rollback (plano de energia, mock) ----
  const roll = tmpMgr();
  roll.mgr.setMock({
    profile: gigabyteA520Profile({}),
    extra: extraFor({ elevated: true, powerHigh: false })
  });
  await roll.mgr.scan();
  const pApply = await roll.mgr.apply('high_performance_plan');
  assert.ok(pApply.ok && pApply.verified);
  const undone = await roll.mgr.rollback('high_performance_plan');
  assert.ok(undone.ok, 'rollback do plano de energia');
  console.log('rollback OK');

  // ---- Rollback manual quando não há método ----
  const man = tmpMgr();
  man.mgr.setMock('xmp_off');
  await man.mgr.scan();
  const manRb = await man.mgr.rollback('xmp');
  assert.strictEqual(manRb.ok, false);
  assert.strictEqual(manRb.manual, true);
  console.log('rollback manual OK');

  // ---- Schedule verify (manual) ----
  const sch = tmpMgr();
  sch.mgr.setMock('xmp_off');
  await sch.mgr.scan();
  const scheduled = sch.mgr.scheduleVerify('xmp');
  assert.ok(scheduled.ok);
  assert.strictEqual(scheduled.operation.status, 'pending_reboot');
  console.log('operação pendente (manual) OK');

  // ---- selectProvider ----
  const asusScan = { profile: { motherboard: { vendorKey: 'asus' } } };
  assert.strictEqual(selectProvider(asusScan).id, 'asus');
  assert.strictEqual(selectProvider({ profile: { motherboard: { vendorKey: 'msi' } } }).id, 'msi');
  assert.strictEqual(selectProvider({ profile: { motherboard: { vendorKey: 'asrock' } } }).id, 'asrock');
  console.log('seleção de provider OK');

  console.log('\nTODOS OS TESTES DE BIOS OPTIMIZATION PASSARAM');
}

main().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});
