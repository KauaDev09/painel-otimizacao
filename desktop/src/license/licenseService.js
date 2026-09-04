'use strict';

// LicenseService — validação/ativação de licença via API.
// - Nenhum segredo do servidor é armazenado aqui: apenas a chave do usuário,
//   o identificador da máquina e o último estado conhecido.
// - Tolerância offline: se a última validação bem-sucedida for recente (<72h),
//   o aplicativo continua utilizável sem internet.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const psRunner = require('../hardware/psRunner');
const { postJson } = require('./apiClient');
const { getApiBaseUrl } = require('./config');
const { APP_VERSION } = require('../config/appConfig');

const GRACE_MS = 72 * 60 * 60 * 1000; // 72 horas
const REFRESH_MS = 6 * 60 * 60 * 1000; // revalida a cada 6h com o app aberto

// Recursos do plano ULTRA — usados como fallback para licenças legadas
// (vitalícias) que ainda não têm o plan_slug SaaS definido no banco.
const FULL_FEATURES = [
  'system_monitoring', 'basic_cleanup', 'advanced_cleanup', 'fps_boost',
  'gaming_mode', 'process_optimizer', 'startup_optimizer', 'bios_optimizer',
  'xmp_optimizer', 'advanced_memory_optimizer', 'advanced_windows_optimizer',
  'realtime_telemetry', 'priority_features'
];

class LicenseService {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'cache.json');
    fs.mkdirSync(dir, { recursive: true });
    this.listeners = new Set();
    this.cache = this._load();
    this._machineIdPromise = null;
  }

  // ---------- persistência local ----------
  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return data && typeof data === 'object' ? data : null;
    } catch (_) {
      return null;
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (_) { /* falha de disco não derruba o app */ }
  }

  onChange(cb) {
    this.listeners.add(cb);
  }

  _emit() {
    const state = this.getState();
    for (const cb of this.listeners) {
      try { cb(state); } catch (_) { /* isolado */ }
    }
  }

  // ---------- fingerprint da máquina ----------
  async getMachineId() {
    if (!this._machineIdPromise) {
      this._machineIdPromise = (async () => {
        try {
          const { stdout } = await psRunner.runPowerShell(
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid"
          );
          const guid = String(stdout || '').trim();
          if (guid) {
            return 'm-' + crypto.createHash('sha256').update(`orion::${guid}`).digest('hex').slice(0, 32);
          }
        } catch (_) { /* cai no fallback */ }
        const fallback = `${process.env.COMPUTERNAME || 'pc'}\\${process.env.USERNAME || 'user'}`;
        return 'f-' + crypto.createHash('sha256').update(fallback).digest('hex').slice(0, 32);
      })();
    }
    return this._machineIdPromise;
  }

  async _deviceInfo() {
    const machineId = await this.getMachineId();
    return { machineId, hostname: process.env.COMPUTERNAME || null };
  }

  // ---------- estado ----------
  getState() {
    const c = this.cache;
    if (!c) return { active: false, state: 'inactive', reason: 'PRODUCT_NOT_ACTIVATED', key: null };
    const age = Date.now() - Date.parse(c.lastValidatedAt || 0);
    const expiredLocally = c.expiresAt && Date.parse(c.expiresAt) <= Date.now();
    let active = false;
    let reason = null;
    if (c.state === 'blocked') {
      reason = 'LICENSE_BLOCKED';
    } else if (expiredLocally) {
      reason = 'LICENSE_EXPIRED';
    } else if (c.canRunVersion === false) {
      reason = 'VERSION_NOT_AUTHORIZED';
    } else if (c.state === 'active') {
      active = age < GRACE_MS; // fora da tolerância, exige nova validação online
      if (!active) reason = 'VALIDATION_REQUIRED';
    } else {
      reason = c.state === 'expired' ? 'LICENSE_EXPIRED' : 'PRODUCT_NOT_ACTIVATED';
    }
    const daysLeft = c.expiresAt
      ? Math.max(0, Math.ceil((Date.parse(c.expiresAt) - Date.now()) / 86400000))
      : null;
    const isLegacyLifetime = !c.planSlug && (c.plan === 'vitalicia' || c.plan === 'lifetime' || !c.plan);
    const features = Array.isArray(c.features) && c.features.length
      ? c.features.slice()
      : (isLegacyLifetime ? FULL_FEATURES.slice() : []);
    return {
      active,
      state: c.state,
      reason,
      plan: (c.planSlug || c.plan) || null,
      planSlug: c.planSlug || null,
      features,
      isLegacyLifetime,
      expiresAt: c.expiresAt || null,
      daysLeft,
      lastValidatedAt: c.lastValidatedAt || null,
      offlineGrace: active && age > 0,
      authorizedVersion: c.authorizedVersion || null,
      serverVersion: c.serverVersion || null,
      canRunVersion: c.canRunVersion !== false,
      updateAvailable: !!c.updateAvailable,
      updateRequiresPurchase: !!c.updateRequiresPurchase,
      updatePrice: c.updatePrice || null,
      storeUrl: c.storeUrl || null,
      key: c.key ? c.key.replace(/(.{4})[A-Z0-9-]+$/, '$1-••••-••••') : null
    };
  }

  _applySuccess(data) {
    const features = Array.isArray(data.features)
      ? data.features.map(String)
      : (this.cache && Array.isArray(this.cache.features) ? this.cache.features : []);
    this.cache = {
      key: data.key,
      state: data.status === 'active' ? 'active' : data.status,
      plan: data.plan || null,
      planSlug: data.planSlug || (this.cache && this.cache.planSlug) || null,
      features,
      expiresAt: data.expiresAt || null,
      lastValidatedAt: new Date().toISOString(),
      token: data.token || (this.cache && this.cache.token) || null,
      machineId: data.machineId,
      authorizedVersion: data.authorizedVersion || null,
      serverVersion: data.serverVersion || null,
      canRunVersion: data.canRunVersion !== false,
      updateAvailable: !!data.updateAvailable,
      updateRequiresPurchase: !!data.updateRequiresPurchase,
      updatePrice: data.updatePrice || null,
      storeUrl: data.storeUrl || null
    };
    this._save();
    this._emit();
    return this.getState();
  }

  _applyFailure(err) {
    const code = err.code || 'SERVER_ERROR';
    if (['LICENSE_NOT_FOUND', 'LICENSE_EXPIRED', 'LICENSE_BLOCKED'].includes(code)) {
      if (!this.cache) this.cache = {};
      this.cache.state = code === 'LICENSE_BLOCKED'
        ? 'blocked'
        : code === 'LICENSE_EXPIRED' ? 'expired' : 'inactive';
      this.cache.key = this.cache.key || null;
      this.cache.lastValidatedAt = new Date().toISOString();
      this._save();
      this._emit();
    }
    throw err;
  }

  /** Chave real (não mascarada) para uso interno — sincronização/validação. */
  getLicenseKey() {
    return (this.cache && this.cache.key) || null;
  }

  async activate(keyRaw) {
    const key = String(keyRaw || '').trim().toUpperCase();
    if (!key) {
      const e = new Error('Informe uma chave de licença.');
      e.code = 'EMPTY_KEY';
      throw e;
    }
    const dev = await this._deviceInfo();
    try {
      const res = await postJson(getApiBaseUrl(), '/api/v1/license/activate', {
        ...dev,
        key,
        appVersion: APP_VERSION
      });
      return this._applySuccess({ ...res, key, machineId: dev.machineId });
    } catch (err) {
      return this._applyFailure(err);
    }
  }

  async validateNow() {
    const c = this.cache;
    if (!c || !c.key) return this.getState();
    const dev = await this._deviceInfo();
    try {
      const res = await postJson(
        getApiBaseUrl(),
        '/api/v1/license/validate',
        { ...dev, key: c.key, appVersion: APP_VERSION },
        { headers: c.token ? { Authorization: `Bearer ${c.token}` } : {} }
      );
      return this._applySuccess({ ...res, key: c.key, machineId: dev.machineId });
    } catch (err) {
      // Falha de rede não invalida a licença em cache — só impede renovação.
      if (!err.code || err.code === 'NETWORK_ERROR' || err.code === 'HTTP_ERROR') {
        this._emit(); // publica estado atual (permanece em tolerância offline)
        return { ...this.getState(), serverUnreachable: true };
      }
      return this._applyFailure(err);
    }
  }

  /** Remove a sessão local (logout) e volta ao estado sem chave. */
  clear() {
    this.cache = null;
    try { fs.rmSync(this.file, { force: true }); } catch (_) { /* isolado */ }
    this._emit();
    return this.getState();
  }

  startBackgroundRefresh() {
    setTimeout(() => { this.validateNow().catch(() => {}); }, 8000); // pouco após abrir
    setInterval(() => { this.validateNow().catch(() => {}); }, REFRESH_MS);
  }
}

module.exports = { LicenseService };
