'use strict';

// HistorySync — envia resumos de análises/segurança para o backend (quando
// licenciado e online). O histórico local continua sendo a fonte principal;
// a sincronização é best-effort: falhas de rede são silenciosamente ignoradas.

const { postJson } = require('../license/apiClient');
const { getApiBaseUrl } = require('../license/config');

class HistorySync {
  constructor(licenseService) {
    this.license = licenseService;
    this._machineIdPromise = null;
  }

  _canSend() {
    const s = this.license.getState();
    return s.active === true && s.key;
  }

  async _send(pathStr, payload) {
    if (!this._canSend()) return false;
    const s = this.license.getState();
    try {
      await postJson(getApiBaseUrl(), pathStr, {
        key: s.key,
        ...payload
      }, {
        headers: {},
        timeoutMs: 10000
      });
      return true;
    } catch (_) {
      return false; // nunca derruba o app por falha de sincronização
    }
  }

  sendAnalysis(entry, machineId) {
    return this._send('/api/v1/history/sync', {
      machineId,
      type: 'analysis',
      entry: {
        date: entry.date,
        score: entry.score,
        categories: entry.categories || null,
        counts: entry.counts || null,
        hardware: entry.hardware || null,
        bootMode: entry.bootMode ?? null
      }
    });
  }

  sendSecurity(summary, machineId) {
    return this._send('/api/v1/history/sync', {
      machineId,
      type: 'security',
      entry: {
        date: summary.analyzedAt,
        score: summary.score,
        threatCount: summary.threatCount,
        activeThreatCount: summary.activeThreatCount,
        defenderRealTime: summary.defender ? summary.defender.realTimeEnabled : null
      }
    });
  }

  // Dispara sem bloquear o fluxo da UI.
  fireAndForget(promise) {
    promise.catch(() => {});
  }
}

module.exports = { HistorySync };
