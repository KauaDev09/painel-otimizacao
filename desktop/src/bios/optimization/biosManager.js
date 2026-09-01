'use strict';

const path = require('path');
const catalog = require('./catalog');
const { assertAllowed } = require('./allowedOperations');
const { BiosOperationLogger } = require('./biosLogger');
const { PendingStore } = require('./pendingStore');
const { collectExtra } = require('./extraScan');
const { selectProvider, providerById } = require('./providers');
const compat = require('./compatibility');
const { verifyOperation } = require('./verification');
const { snapshotFor, canRollback } = require('./rollback');
const { requestReboot } = require('./rebootManager');
const { isElevated } = require('./elevation');
const { loadScenario } = require('./mockHardware');

function hardwareSummary(profile) {
  if (!profile) return null;
  return {
    cpu: profile.cpu && profile.cpu.name,
    board: profile.motherboard && `${profile.motherboard.vendorDisplay || ''} ${profile.motherboard.boardProduct || ''}`.trim(),
    vendorKey: profile.motherboard && profile.motherboard.vendorKey,
    bios: profile.bios && `${profile.bios.vendor || ''} ${profile.bios.version || ''}`.trim(),
    ram: profile.ram && `${profile.ram.totalGB || '?'} GB @ ${profile.ram.minConfigMHz || '?'} MT/s`
  };
}

class BiosManager {
  constructor() {
    this.dir = null;
    this.logger = new BiosOperationLogger(null);
    this.store = null;
    this.mock = null;
    this.lastScan = null;
  }

  init(userDataDir) {
    this.dir = path.join(userDataDir, 'bios');
    this.logger = new BiosOperationLogger(path.join(this.dir, 'logs.json'));
    this.store = new PendingStore(path.join(this.dir, 'pending.json'));
    const { setBiosDir } = require('./efiVar');
    setBiosDir(this.dir);
  }

  setMock(scenarioOrObject) {
    if (!scenarioOrObject) {
      this.mock = null;
      return;
    }
    if (typeof scenarioOrObject === 'string') {
      this.mock = { scenario: scenarioOrObject, ...loadScenario(scenarioOrObject) };
    } else {
      this.mock = scenarioOrObject;
    }
  }

  _scanFromParts(profile, extra) {
    const scan = { profile, extra };
    const provider = selectProvider(scan);
    scan.provider = provider;
    this.lastScan = scan;
    return scan;
  }

  async scan(onStep = () => {}, opts = {}) {
    this.logger.log('Scanner iniciado');
    onStep({ key: 'bios-scan', label: 'Analisando hardware e firmware...' });

    let profile = opts.profile || null;
    if (this.mock && this.mock.profile) {
      profile = this.mock.profile;
    } else if (!profile) {
      const { runDetection } = require('../../core/detector');
      profile = await runDetection((step) => onStep(step));
    }

    const extra = this.mock && this.mock.extra
      ? this.mock.extra
      : await collectExtra();

    const scan = this._scanFromParts(profile, extra);
    if (!this.mock) {
      try {
        const { probeCapabilities } = require('./efiVar');
        scan.efiCap = await probeCapabilities(scan);
      } catch (_) {
        scan.efiCap = {};
      }
    }
    const board = profile.motherboard || {};
    const bios = profile.bios || {};
    const ram = profile.ram || {};
    this.logger.log(`Placa-mãe detectada: ${board.vendorDisplay || '?'} ${board.boardProduct || '?'}`);
    this.logger.log(`BIOS detectada: ${bios.vendor || '?'} ${bios.version || '?'}`);
    this.logger.log(`Memória detectada: ${ram.totalGB || '?'} GB @ ${ram.minConfigMHz || '?'} MT/s (anunciada ${ram.maxRatedMHz || '?'} MT/s)`);

    const items = this._buildItems(scan);
    const xmp = items.find((i) => i.id === 'xmp' || i.id === 'expo' || i.id === 'docp');
    if (xmp) {
      this.logger.log(`${xmp.name} ${xmp.state.key === 'disabled' ? 'disponível' : 'estado: ' + xmp.state.label}`);
      if (xmp.state.key === 'disabled') this.logger.log(`${xmp.name} atualmente desativado`);
    }
    return this._payload(scan, items);
  }

  evaluateProfile(profile) {
    return this.scan(() => {}, { profile });
  }

  _buildItems(scan) {
    const provider = scan.provider;
    const pending = this.store ? this.store.getPending() : [];
    const items = [];
    for (const spec of catalog.ITEMS) {
      if ((spec.id === 'xmp' || spec.id === 'expo' || spec.id === 'docp') && !compat.hardwareOk(spec, scan)) {
        continue;
      }
      if (spec.id === 'csm' && !(scan.profile && scan.profile.boot && scan.profile.boot.mode !== 'unknown')) {
        continue;
      }

      let evald = compat.evaluateItem(spec, scan, provider, scan.efiCap && scan.efiCap[spec.id]);
      if (this.mock && this.mock.allowAuto && this.mock.allowAuto.includes(spec.operation)) {
        evald = Object.assign({}, evald, {
          auto: true,
          applyOk: true,
          capability: { ok: true, mode: 'auto', requiresAdmin: false, reason: 'Mock: aplicação simulada.' },
          uiStatus: evald.state.key === 'disabled' ? 'available' : evald.uiStatus,
          button: evald.state.key === 'disabled' ? 'ATIVAR' : evald.button
        });
      }

      const pend = pending.find((p) => p.setting === spec.id);
      let uiStatus = evald.uiStatus;
      let button = evald.button;
      if (pend && pend.status === 'pending_reboot') {
        uiStatus = 'pending_reboot';
        button = 'AGUARDANDO REINICIALIZAÇÃO';
      } else if (pend && pend.status === 'verifying') {
        uiStatus = 'verifying';
        button = 'VERIFICANDO';
      } else if (pend && pend.status === 'success' && (evald.state.key === 'enabled' || evald.state.key === 'enabled_or_jedec' || evald.state.key === 'likely_enabled')) {
        uiStatus = 'success';
        button = 'SUCESSO';
      } else if (pend && pend.status === 'failed') {
        uiStatus = 'failed';
        button = 'FALHOU';
      }

      if (uiStatus === 'active' && evald.state.key !== 'enabled' && evald.state.key !== 'likely_enabled' && evald.state.key !== 'enabled_or_jedec') {
        uiStatus = 'manual';
        button = 'CONFIGURAÇÃO MANUAL';
      }

      const rollbackOk = canRollback(spec, pend && pend.rollbackSnapshot);
      items.push({
        id: spec.id,
        operation: spec.operation,
        name: spec.name,
        description: spec.description,
        category: spec.category,
        level: spec.level,
        risk: spec.risk,
        impact: spec.impact,
        requiresReboot: spec.requiresReboot,
        rollbackSupported: rollbackOk,
        rollbackManual: spec.rollbackSupported ? !rollbackOk : true,
        status: uiStatus,
        button,
        state: evald.state,
        expected: evald.expected,
        auto: evald.auto,
        capability: evald.capability,
        compatibility: evald.compatibilityNote,
        provider: provider.id,
        paths: catalog.pathsFor(scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey, spec.id),
        steps: catalog.MANUAL_STEPS[spec.id] || [],
        pending: pend ? { operationId: pend.operationId, status: pend.status } : null,
        currentMhz: evald.state.currentMhz || null,
        ratedMhz: evald.state.ratedMhz || null
      });
    }
    return items;
  }

  _payload(scan, items) {
    const available = items.filter((i) => i.status === 'available' || i.status === 'manual');
    return {
      provider: scan.provider.id,
      providerName: scan.provider.displayName,
      elevated: !!(scan.extra && scan.extra.elevated) || isElevated(),
      extra: {
        power: scan.extra && scan.extra.power,
        rebar: scan.extra && scan.extra.rebar,
        vendorTools: scan.extra && scan.extra.vendorTools
      },
      hardware: hardwareSummary(scan.profile),
      items,
      counts: {
        all: items.length,
        available: items.filter((i) => i.status === 'available').length,
        manual: items.filter((i) => i.status === 'manual').length,
        active: items.filter((i) => i.status === 'active' || i.status === 'success').length,
        pending: items.filter((i) => i.status === 'pending_reboot').length,
        found: available.length
      },
      pending: this.store ? this.store.getPending() : [],
      logs: this.logger.getLines().slice(-40)
    };
  }

  list() {
    if (!this.lastScan) return { items: [], counts: { all: 0, found: 0 }, pending: [], logs: this.logger.getLines().slice(-40) };
    return this._payload(this.lastScan, this._buildItems(this.lastScan));
  }

  getLogs() {
    return this.logger.getLines();
  }

  guide(id) {
    const spec = catalog.itemById(id);
    if (!spec) throw new Error('Otimização desconhecida.');
    const scan = this.lastScan;
    const vendor = scan && scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey;
    const state = scan ? compat.currentState(spec, scan) : { key: 'unknown', label: 'NÃO DETERMINADO' };
    return {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      current: state,
      recommended: spec.id === 'csm' ? 'Desativado (UEFI nativo)' : 'Ativado',
      paths: catalog.pathsFor(vendor, spec.id),
      steps: catalog.MANUAL_STEPS[spec.id] || [],
      requiresReboot: spec.requiresReboot,
      rollbackManual: !spec.rollbackSupported
    };
  }

  dryRun(id) {
    const spec = catalog.itemById(id);
    if (!spec) throw new Error('Otimização desconhecida.');
    if (!this.lastScan) throw new Error('Execute a análise antes de simular.');
    const item = this._buildItems(this.lastScan).find((x) => x.id === id);
    if (!item) throw new Error('Otimização indisponível neste hardware.');
    return {
      setting: spec.name,
      operation: spec.operation,
      current: item.state.label,
      next: item.expected.key === 'enabled' || item.expected.key === 'likely_enabled' ? 'ATIVADO' : item.expected.key,
      reboot: spec.requiresReboot ? 'SIM' : 'NÃO',
      provider: this.lastScan.provider.displayName,
      mode: item.auto ? 'automático' : 'manual',
      reason: item.capability && item.capability.reason,
      currentMhz: item.currentMhz,
      ratedMhz: item.ratedMhz
    };
  }

  async apply(id, opts = {}) {
    const spec = catalog.itemById(id);
    if (!spec) throw new Error('Otimização desconhecida.');
    assertAllowed(spec.operation);

    if (!this.lastScan) await this.scan();
    const scan = this.lastScan;
    const provider = selectProvider(scan);
    if (opts.requireProvider && opts.requireProvider !== provider.id) {
      const err = new Error('Provider incompatível com a placa detectada.');
      err.code = 'WRONG_PROVIDER';
      throw err;
    }

    const item = this._buildItems(scan).find((x) => x.id === id);
    if (!item) {
      const err = new Error('Hardware incompatível com esta otimização.');
      err.code = 'UNSUPPORTED_HARDWARE';
      throw err;
    }

    const preview = this.dryRun(id);
    if (opts.dryRunOnly) return { ok: true, dryRun: preview, applied: false };

    if (this.mock && this.mock.flags && this.mock.flags.applyFail) {
      this.logger.log(`Operação ${spec.name} falhou (simulado)`);
      return { ok: false, dryRun: preview, applied: false, message: 'Falha ao aplicar a configuração.' };
    }

    if (this.mock && item.capability && item.capability.requiresAdmin && scan.extra && scan.extra.elevated === false &&
        !(this.mock.allowAuto && this.mock.allowAuto.includes(spec.operation))) {
      this.logger.log('Aplicação bloqueada: privilégios insuficientes');
      return { ok: false, dryRun: preview, applied: false, code: 'NO_PRIVILEGES', message: 'Privilégios insuficientes. O UAC seria solicitado.' };
    }

    if (!item.auto) {
      return {
        ok: false,
        dryRun: preview,
        applied: false,
        manual: true,
        message: 'Não é possível alterar automaticamente nesta placa.',
        guide: this.guide(id)
      };
    }

    if (spec.id === 'high_performance_plan' && scan.extra && scan.extra.elevated === false && !(this.mock && this.mock.allowAuto)) {
      this.logger.log('Aplicação exige privilégio elevado');
    }

    this.logger.log(`Operação ${spec.name} criada`);
    const snapshot = await snapshotFor(spec, scan);
    let result;
    if (this.mock && this.mock.allowAuto && this.mock.allowAuto.includes(spec.operation) && spec.id !== 'high_performance_plan') {
      result = { ok: true, message: 'Aplicação simulada (mock).' };
    } else {
      result = await provider.apply(spec, scan, { mock: this.mock, scan });
    }
    if (!result.ok) {
      this.logger.log(`Aplicação de ${spec.name} falhou`);
      return { ok: false, dryRun: preview, applied: false, message: result.message };
    }

    const effSnapshot = result.snapshot ? Object.assign({}, snapshot, result.snapshot) : snapshot;

    if (spec.requiresReboot) {
      const op = this.store.create({
        setting: spec.id,
        operation: spec.operation,
        status: 'pending_reboot',
        provider: provider.id,
        applyMethod: 'auto',
        expectedState: item.expected,
        previousState: item.state,
        hardware: hardwareSummary(scan.profile),
        rollbackSupported: canRollback(spec, effSnapshot),
        rollbackSnapshot: effSnapshot
      });
      this.logger.log('Aguardando reinicialização');
      let reboot = null;
      if (opts.reboot) {
        this.logger.log('Reinicialização solicitada');
        reboot = this.mock
          ? { ok: true, message: 'Reinício simulado.' }
          : await requestReboot();
      }
      return {
        ok: true,
        applied: true,
        pending: true,
        operation: op,
        dryRun: preview,
        reboot,
        message: 'Preparando otimização. É necessário reiniciar para confirmar.'
      };
    }

    const verify = provider.verify(spec, scan, item.expected);
    if (!verify.ok) {
      this.logger.log(`${spec.name} aplicado mas não confirmado`);
      return { ok: false, applied: true, verified: false, message: verify.detail, dryRun: preview };
    }
    this.store.create({
      setting: spec.id,
      operation: spec.operation,
      status: 'success',
      provider: provider.id,
      applyMethod: 'auto',
      expectedState: item.expected,
      previousState: item.state,
      hardware: hardwareSummary(scan.profile),
      rollbackSupported: canRollback(spec, effSnapshot),
      rollbackSnapshot: effSnapshot
    });
    this.logger.log(`${spec.name} confirmado como ativo`);
    return { ok: true, applied: true, verified: true, message: verify.detail, dryRun: preview };
  }

  scheduleVerify(id) {
    const spec = catalog.itemById(id);
    if (!spec) throw new Error('Otimização desconhecida.');
    assertAllowed('schedule_verify');
    if (!this.lastScan) throw new Error('Execute a análise antes.');
    const item = this._buildItems(this.lastScan).find((x) => x.id === id);
    if (!item) throw new Error('Otimização indisponível.');
    const op = this.store.create({
      setting: spec.id,
      operation: spec.operation,
      status: 'pending_reboot',
      provider: this.lastScan.provider.id,
      applyMethod: 'manual',
      expectedState: Object.assign({}, item.expected, { previousMhz: item.currentMhz }),
      previousState: item.state,
      hardware: hardwareSummary(this.lastScan.profile),
      rollbackSupported: false,
      note: 'Verificação após alteração manual na BIOS'
    });
    this.logger.log(`Operação ${spec.name} criada (verificação manual)`);
    return { ok: true, operation: op };
  }

  async verifyPending() {
    if (!this.store) return { checked: [], payload: this.list() };
    const pending = this.store.getPending();
    if (!pending.length) return { checked: [], payload: this.list() };

    this.logger.boot();
    this.logger.log('Orion iniciado');
    this.logger.log('Operação pendente encontrada');

    const payload = await this.scan();
    const scan = this.lastScan;
    const checked = [];

    for (const op of pending) {
      this.store.update(op.operationId, { status: 'verifying' });
      const spec = catalog.itemById(op.setting);
      this.logger.log(`Verificando ${spec ? spec.name : op.setting}`);
      if (this.mock && this.mock.flags && this.mock.flags.verifyFail) {
        this.store.update(op.operationId, { status: 'failed', verifyDetail: 'Falha simulada após reboot.' });
        this.logger.log(`${spec ? spec.name : op.setting} não confirmado`);
        checked.push({ operationId: op.operationId, setting: op.setting, status: 'failed' });
        continue;
      }
      const result = verifyOperation(op, scan);
      const status = result.ok ? 'success' : 'failed';
      this.store.update(op.operationId, { status, verifyDetail: result.detail });
      if (result.ok) this.logger.log(`${spec ? spec.name : op.setting} confirmado como ativo`);
      else this.logger.log(`${spec ? spec.name : op.setting} falhou na verificação`);
      checked.push({ operationId: op.operationId, setting: op.setting, status, detail: result.detail });
    }
    return { checked, payload: this.list() };
  }

  async rollback(id) {
    assertAllowed('rollback');
    const spec = catalog.itemById(id);
    if (!spec) throw new Error('Otimização desconhecida.');
    const hist = (this.store ? this.store.getBySetting(id) : []).slice().reverse();
    const last = hist.find((o) => o.rollbackSupported && o.rollbackSnapshot);
    if (!last) {
      return { ok: false, manual: true, message: 'Rollback manual — reverta a opção na BIOS.' };
    }
    const provider = (this.lastScan && this.lastScan.provider) || providerById(last.provider) || selectProvider(this.lastScan || { profile: { motherboard: {} } });
    const result = await provider.rollback(spec, last.rollbackSnapshot, { mock: this.mock, scan: this.lastScan });
    if (result.ok) {
      this.store.update(last.operationId, { status: 'rolled_back' });
      this.logger.log(`Rollback de ${spec.name} concluído`);
    }
    return result;
  }

  async requestReboot() {
    this.logger.log('Reinicialização solicitada');
    if (this.mock) return { ok: true, message: 'Reinício simulado.' };
    return requestReboot();
  }
}

const biosManager = new BiosManager();

module.exports = { BiosManager, biosManager };
