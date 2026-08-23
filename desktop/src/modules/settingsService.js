'use strict';

// SettingsService — preferências do aplicativo persistidas em
// %APPDATA%/mainstreet-bios-optimizer/settings.json.
// Ações com efeito no sistema (iniciar com Windows) são aplicadas pelo
// processo principal via app.setLoginItemSettings.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  general: {
    startWithWindows: false,
    minimizeToTray: true,
    notifications: true
  },
  optimization: {
    createRestorePoint: true,
    confirmChanges: true,
    defaultProfile: 'balanced'
  },
  monitoring: {
    intervalSec: 2,
    metrics: ['cpu', 'ram', 'gpu', 'disk', 'network']
  },
  updates: {
    autoCheck: true
  },
  privacy: {
    syncHistoryWhenLicensed: true
  }
};

let file = null;

function init(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  file = path.join(userDataDir, 'settings.json');
}

function _read() {
  if (!file) return JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), parsed);
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function deepMerge(base, extra) {
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      deepMerge(base[k], v);
    } else if (base[k] !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

function get() {
  return _read();
}

/** Atualiza apenas as seções informadas (merge raso por seção). */
function set(patch) {
  const current = _read();
  const merged = deepMerge(current, patch || {});
  if (file) fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

module.exports = { init, get, set };
