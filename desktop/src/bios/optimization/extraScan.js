'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { isElevated, runHidden } = require('./elevation');

const HIGH_PERF = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const POWER_SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a';
const ULTIMATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

const PLAN_NAMES = {
  [HIGH_PERF]: 'Alto desempenho',
  [BALANCED]: 'Equilibrado',
  [POWER_SAVER]: 'Economia de energia',
  [ULTIMATE]: 'Desempenho máximo'
};

function dirExists(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function detectVendorTools() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return {
    gigabyteGcc: dirExists(path.join(pf, 'GIGABYTE', 'Control Center')) ||
      dirExists(path.join(pf86, 'GIGABYTE', 'Control Center')) ||
      dirExists(path.join(pf86, 'GIGABYTE', 'APP Center')),
    gigabyteEasyTune: dirExists(path.join(pf86, 'GIGABYTE', 'EasyTune')) ||
      dirExists(path.join(pf, 'GIGABYTE', 'EasyTune')),
    asusArmoury: dirExists(path.join(pf, 'ASUS', 'Armoury Crate')) ||
      dirExists(path.join(pf86, 'ASUS', 'ARMOURY CRATE SERVICE')),
    asusAiSuite: dirExists(path.join(pf86, 'ASUS', 'AI Suite III')) ||
      dirExists(path.join(pf, 'ASUS', 'AI Suite III')),
    msiCenter: dirExists(path.join(pf86, 'MSI', 'MSI Center')) ||
      dirExists(path.join(pf, 'MSI', 'MSI Center')),
    asrockTuning: dirExists(path.join(pf, 'ASRock', 'A-Tuning')) ||
      dirExists(path.join(pf86, 'ASRock', 'A-Tuning'))
  };
}

function parsePowercfg(stdout) {
  const text = String(stdout || '');
  const m = text.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  const guid = m ? m[1].toLowerCase() : null;
  let name = null;
  const named = text.match(/\(([^)]+)\)\s*$/m);
  if (named) name = named[1].trim();
  if (!name && guid && PLAN_NAMES[guid]) name = PLAN_NAMES[guid];
  return { guid, name: name || 'Desconhecido' };
}

async function detectPowerPlan() {
  const result = await runHidden('powercfg.exe', ['/getactivescheme'], 8000);
  if (result.code !== 0) {
    return { guid: null, name: null, detected: false };
  }
  const parsed = parsePowercfg(result.stdout);
  return {
    guid: parsed.guid,
    name: parsed.name,
    detected: Boolean(parsed.guid),
    isHighPerformance: parsed.guid === HIGH_PERF || parsed.guid === ULTIMATE
  };
}

function queryNvidiaRebar(timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const child = spawn('nvidia-smi', ['-q'], { windowsHide: true });
      let out = '';
      let done = false;
      const finish = (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
      const t = setTimeout(() => { try { child.kill(); } catch (_) { /* ignore */ } finish(null); }, timeoutMs);
      child.stdout.on('data', (d) => { out += d.toString('utf8'); });
      child.on('error', () => finish(null));
      child.on('close', () => {
        const m = out.match(/Resizable BAR\s*:\s*(\w+)/i);
        if (!m) return finish({ state: 'unknown', raw: null });
        const v = m[1].toLowerCase();
        if (v === 'yes' || v === 'enabled' || v === 'on') return finish({ state: 'enabled', raw: m[1] });
        if (v === 'no' || v === 'disabled' || v === 'off') return finish({ state: 'disabled', raw: m[1] });
        finish({ state: 'unknown', raw: m[1] });
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function collectExtra(mockExtra) {
  if (mockExtra) return JSON.parse(JSON.stringify(mockExtra));
  const [power, rebar] = await Promise.all([
    detectPowerPlan().catch(() => ({ guid: null, name: null, detected: false })),
    queryNvidiaRebar().catch(() => null)
  ]);
  return {
    power,
    rebar: rebar || { state: 'unknown', raw: null },
    elevated: isElevated(),
    vendorTools: detectVendorTools()
  };
}

module.exports = {
  collectExtra,
  detectPowerPlan,
  parsePowercfg,
  detectVendorTools,
  HIGH_PERF,
  BALANCED,
  POWER_SAVER,
  ULTIMATE
};
