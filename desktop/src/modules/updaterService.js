'use strict';

// UpdaterService — verificação de novas versões contra a API.
// Fluxo seguro: consulta /api/v1/app/updates/latest, compara versões e
// notifica a interface. O download/instalação SEMPRE abre a página oficial
// no navegador externo — o aplicativo nunca executa binários baixados.

const { getJson } = require('../license/apiClient');
const { getApiBaseUrl } = require('../license/config');
const { APP_VERSION } = require('../config/appConfig');

function parseVersion(v) {
  const parts = String(v || '').split('.').map((x) => parseInt(x, 10));
  return parts.map((n) => (Number.isFinite(n) ? n : 0));
}

/** Retorna positivo quando `candidate` é mais nova que `current`. */
function isNewer(candidate, current = APP_VERSION) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Consulta o servidor. Retorna:
 *   { available: false }                       — sem atualização
 *   { available: true, update: {...} }         — nova versão publicada
 * Lança erro apenas em falha de rede/configuração (chamador decide).
 */
async function checkForUpdate() {
  const base = getApiBaseUrl();
  const res = await getJson(base, '/api/v1/app/updates/latest', { timeoutMs: 12000 });
  const upd = res.update;
  if (!upd || !upd.version) return { available: false };
  if (!isNewer(upd.version)) return { available: false };
  return {
    available: true,
    update: {
      version: String(upd.version),
      url: String(upd.downloadUrl || ''),
      changelog: String(upd.changelog || ''),
      mandatory: !!upd.mandatory,
      releasedAt: upd.releasedAt || null
    },
    currentVersion: APP_VERSION
  };
}

module.exports = { checkForUpdate, isNewer, APP_VERSION };
