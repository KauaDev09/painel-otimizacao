'use strict';

const catalog = require('../catalog');
const { currentState } = require('../compatibility');
const { HIGH_PERF } = require('../extraScan');

class BaseBiosProvider {
  constructor(id, displayName) {
    this.id = id;
    this.displayName = displayName || id;
  }

  matches(_scan) {
    return false;
  }

  detect(scan) {
    const board = scan.profile && scan.profile.motherboard;
    const bios = scan.profile && scan.profile.bios;
    return {
      provider: this.id,
      vendorKey: board && board.vendorKey,
      boardProduct: board && board.boardProduct,
      biosVersion: bios && bios.version,
      biosVendor: bios && bios.vendor
    };
  }

  getCapabilities(scan) {
    return catalog.ITEMS.map((item) => {
      const cap = this.canApply(item, scan);
      return { id: item.id, operation: item.operation, mode: cap.mode, canApply: !!cap.ok };
    });
  }

  getCurrentSettings(scan) {
    const out = {};
    for (const item of catalog.ITEMS) out[item.id] = currentState(item, scan);
    return out;
  }

  canApply(item, _scan) {
    if (item.id === 'high_performance_plan') {
      return { ok: true, mode: 'auto', requiresAdmin: true, reason: 'powercfg nativo do Windows.' };
    }
    return {
      ok: false,
      mode: 'manual',
      reason: `Não existe método documentado e seguro para alterar ${item.name} a partir do Windows neste fabricante.`
    };
  }

  async apply(item, scan, ctx) {
    if (scan && scan.efiCap && scan.efiCap[item.id] && scan.efiCap[item.id].ok && scan.efiCap[item.id].mode === 'auto') {
      const { applyEfi } = require('../efiVar');
      return applyEfi(item.id, scan, ctx);
    }
    const cap = this.canApply(item, scan);
    if (!cap.ok || cap.mode !== 'auto') {
      const err = new Error(cap.reason || 'Aplicação automática indisponível.');
      err.code = 'MANUAL_ONLY';
      throw err;
    }
    if (item.id === 'high_performance_plan') {
      return this._applyPowerPlan(scan, ctx);
    }
    const err = new Error('Aplicação automática não implementada para este item.');
    err.code = 'MANUAL_ONLY';
    throw err;
  }

  async _applyPowerPlan(scan, ctx) {
    if (ctx && ctx.mock) {
      if (ctx.mock.flags && ctx.mock.flags.applyFail) {
        return { ok: false, message: 'Falha simulada ao aplicar o plano de energia.' };
      }
      if (scan.extra && scan.extra.power) {
        scan.extra.power.guid = HIGH_PERF;
        scan.extra.power.name = 'Alto desempenho';
        scan.extra.power.isHighPerformance = true;
      }
      return { ok: true, message: 'Plano Alto desempenho aplicado (mock).' };
    }
    const { runElevatedCommand } = require('../elevation');
    const result = await runElevatedCommand(`powercfg /setactive ${HIGH_PERF}`, 20000);
    if (result.code !== 0) {
      return { ok: false, message: result.error || 'Não foi possível ativar o plano de energia.' };
    }
    return { ok: true, message: 'Plano Alto desempenho aplicado.' };
  }

  async rollback(item, snapshot, ctx) {
    if (snapshot && snapshot.type === 'efi_var') {
      const { restoreEfi } = require('../efiVar');
      return restoreEfi(snapshot, ctx);
    }
    if (item.id !== 'high_performance_plan' || !snapshot || !snapshot.guid) {
      return { ok: false, manual: true, message: 'Rollback manual — reverta a opção na BIOS.' };
    }
    const guid = String(snapshot.guid).replace(/[^0-9a-fA-F-]/g, '');
    if (!guid) return { ok: false, message: 'Snapshot de plano inválido.' };
    if (ctx && ctx.mock) {
      if (ctx.scan && ctx.scan.extra && ctx.scan.extra.power) {
        ctx.scan.extra.power.guid = guid;
        ctx.scan.extra.power.name = snapshot.name || 'Anterior';
        ctx.scan.extra.power.isHighPerformance = guid.toLowerCase() === HIGH_PERF;
      }
      return { ok: true, message: 'Plano anterior restaurado (mock).' };
    }
    const { runElevatedCommand } = require('../elevation');
    const result = await runElevatedCommand(`powercfg /setactive ${guid}`, 20000);
    return {
      ok: result.code === 0,
      message: result.code === 0 ? 'Plano de energia anterior restaurado.' : (result.error || 'Falha no rollback.')
    };
  }

  verify(item, scan, expected) {
    const { matchesExpected } = require('../verification');
    return matchesExpected(item, scan, expected);
  }
}

module.exports = { BaseBiosProvider };
