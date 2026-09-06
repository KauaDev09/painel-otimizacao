'use strict';

// DisplayService — controle direto da tela no Windows (estilo painel NVIDIA).
// Gama ramp por monitor (rápido) + DDC/CI no hardware (debounce, evita lag).
// Helper nativo fica residente — não spawna processo a cada slider.

const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const CSC_CANDIDATES = [
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
];

let rampExePromise = null;
let helperProc = null;
let helperBuf = '';
const helperWaiters = [];
let applyInflight = null;
let applyPending = null;
let ddcTimer = null;
let lastDdcOpts = null;

function helperDir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) return path.join(app.getPath('userData'), 'helpers');
  } catch (_) { /* preview */ }
  return path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'orion-optimizer', 'helpers');
}

function ensureRampExe() {
  if (rampExePromise) return rampExePromise;
  rampExePromise = (async () => {
    const dir = helperDir();
    fs.mkdirSync(dir, { recursive: true });
    const exe = path.join(dir, 'displayRamp.exe');
    const bundled = path.join(__dirname, 'displayRamp.cs');
    const src = path.join(dir, 'displayRamp.cs');
    try { fs.copyFileSync(bundled, src); } catch (_) { /* asar → disco */ }
    try {
      const srcStat = fs.existsSync(src) ? fs.statSync(src) : fs.statSync(bundled);
      const exeStat = fs.existsSync(exe) ? fs.statSync(exe) : null;
      if (exeStat && exeStat.mtimeMs >= srcStat.mtimeMs && exeStat.size > 1024) return exe;
    } catch (_) { /* recompila */ }
    const csc = CSC_CANDIDATES.find((p) => fs.existsSync(p));
    if (!csc || !fs.existsSync(src)) return null;
    await new Promise((resolve, reject) => {
      execFile(csc, ['/nologo', '/optimize+', '/out:' + exe, src], { windowsHide: true }, (err, _o, stderr) => {
        if (err) reject(new Error(String(stderr || err.message)));
        else resolve();
      });
    });
    return fs.existsSync(exe) ? exe : null;
  })().catch((err) => {
    console.error('[display] falha ao compilar helper de tela:', err && err.message);
    rampExePromise = null;
    return null;
  });
  return rampExePromise;
}

function killHelper() {
  if (!helperProc) return;
  try { helperProc.stdin.write('quit\n'); } catch (_) { /* ok */ }
  try { helperProc.kill(); } catch (_) { /* ok */ }
  helperProc = null;
  helperBuf = '';
  while (helperWaiters.length) {
    const w = helperWaiters.shift();
    if (w && w.reject) w.reject(new Error('helper-closed'));
  }
}

function attachHelper(proc) {
  helperProc = proc;
  helperBuf = '';
  proc.stdout.on('data', (chunk) => {
    helperBuf += String(chunk);
    let idx;
    while ((idx = helperBuf.indexOf('\n')) >= 0) {
      const line = helperBuf.slice(0, idx).trim();
      helperBuf = helperBuf.slice(idx + 1);
      const waiter = helperWaiters.shift();
      if (waiter) waiter.resolve(line);
    }
  });
  const onGone = () => {
    if (helperProc === proc) helperProc = null;
    helperBuf = '';
    while (helperWaiters.length) {
      const w = helperWaiters.shift();
      if (w && w.reject) w.reject(new Error('helper-exit'));
    }
  };
  proc.on('exit', onGone);
  proc.on('error', onGone);
}

function ensureHelper(exe) {
  if (helperProc && helperProc.exitCode == null) return helperProc;
  const proc = spawn(exe, ['--serve'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  attachHelper(proc);
  return proc;
}

function sendHelper(cmd, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    if (!helperProc || helperProc.exitCode != null) {
      reject(new Error('no-helper'));
      return;
    }
    const timer = setTimeout(() => {
      const i = helperWaiters.indexOf(waiter);
      if (i >= 0) helperWaiters.splice(i, 1);
      reject(new Error('helper-timeout'));
    }, timeoutMs);
    const waiter = {
      resolve: (line) => { clearTimeout(timer); resolve(line); },
      reject: (err) => { clearTimeout(timer); reject(err); }
    };
    helperWaiters.push(waiter);
    try {
      helperProc.stdin.write(cmd + '\n');
    } catch (err) {
      const i = helperWaiters.indexOf(waiter);
      if (i >= 0) helperWaiters.splice(i, 1);
      clearTimeout(timer);
      reject(err);
    }
  });
}

function parseHelperLine(line) {
  try { return JSON.parse(String(line || '').trim()); } catch (_) { return {}; }
}

function fmt(n, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? String(Math.round(v * 10) / 10) : String(fallback);
}

function monitorCenter(opts) {
  const b = opts && opts.bounds;
  if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height)) {
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  }
  const cx = Number(opts && opts.cx);
  const cy = Number(opts && opts.cy);
  if (Number.isFinite(cx) && Number.isFinite(cy)) return { cx, cy };
  return { cx: -1, cy: -1 };
}

async function runRamp(opts, withDdc) {
  const sat = fmt(opts.saturation, 100);
  const con = fmt(opts.contrast, 100);
  const bri = fmt(opts.brightness, 100);
  const gamma = fmt(opts.gamma, 100);
  const temp = fmt(opts.temperature, 100);
  const { cx, cy } = monitorCenter(opts);
  const ddcFlag = withDdc ? '1' : '0';
  const cmd = ['apply', sat, con, bri, gamma, temp, fmt(cx, -1), fmt(cy, -1), ddcFlag].join(' ');

  const exe = await ensureRampExe();
  if (!exe) return { applied: false, method: 'native-fail' };

  try {
    ensureHelper(exe);
    const line = await sendHelper(cmd, withDdc ? 4000 : 1500);
    const parsed = parseHelperLine(line);
    return {
      applied: !!(parsed.ddc || parsed.gamma),
      ddc: !!parsed.ddc,
      gamma: !!parsed.gamma,
      method: parsed.ddc ? 'ddc' : (parsed.gamma ? 'gamma-ramp' : 'none')
    };
  } catch (_) {
    killHelper();
  }

  return new Promise((resolve) => {
    execFile(exe, [sat, con, bri, gamma, temp, fmt(cx, -1), fmt(cy, -1), ddcFlag], {
      windowsHide: true,
      timeout: withDdc ? 5000 : 2500
    }, (err, stdout) => {
      if (err && !stdout) {
        resolve({ applied: false, method: 'native-fail' });
        return;
      }
      const parsed = parseHelperLine(stdout);
      resolve({
        applied: !!(parsed.ddc || parsed.gamma),
        ddc: !!parsed.ddc,
        gamma: !!parsed.gamma,
        method: parsed.ddc ? 'ddc' : (parsed.gamma ? 'gamma-ramp' : 'none')
      });
    });
  });
}

function cleanName(name) {
  return String(name || '').replace(/["\u0000]/g, '').trim() || 'Monitor';
}

/** Lista monitores reais via Electron (rápido, sem PowerShell). */
function getMonitors() {
  let list = [];
  let primary = null;
  try {
    const { app, screen } = require('electron');
    if (!app.isReady()) throw new Error('screen-not-ready');
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;
    list = displays.map((d, idx) => ({
      id: String(d.id),
      index: idx,
      name: cleanName(d.label || d.name || ('Monitor ' + (idx + 1))),
      width: d.size && d.size.width,
      height: d.size && d.size.height,
      refreshRate: d.displayFrequency || d.refreshRate || null,
      scaleFactor: d.scaleFactor || 1,
      connected: true,
      isPrimary: d.id === primaryId,
      internal: !!d.internal,
      bounds: d.bounds ? { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height } : null
    }));
    primary = list.find((m) => m.isPrimary) || list[0] || null;
  } catch (_) {
    list = [];
  }
  return { monitors: list, primary };
}

function findMonitor(opts) {
  const { monitors } = getMonitors();
  if (!monitors.length) return null;
  if (opts && opts.monitorId != null) {
    const hit = monitors.find((m) => String(m.id) === String(opts.monitorId));
    if (hit) return hit;
  }
  return monitors.find((m) => m.isPrimary) || monitors[0];
}

async function getBrightness() {
  return { supported: true, percent: null };
}

async function setBrightness() {
  return { applied: false, reason: 'USE_RAMP' };
}

function normalizeOpts(opts) {
  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const monitor = findMonitor(opts || {});
  return {
    saturation: clamp(opts && opts.saturation, 0, 200, 100),
    contrast: clamp(opts && opts.contrast, 0, 200, 100),
    brightness: clamp(opts && opts.brightness, 0, 200, 100),
    gamma: clamp(opts && opts.gamma, 40, 250, 100),
    temperature: clamp(opts && opts.temperature, 0, 200, 100),
    monitorId: monitor ? monitor.id : null,
    bounds: monitor && monitor.bounds ? monitor.bounds : null
  };
}

async function applyOnce(raw, withDdc) {
  const opts = normalizeOpts(raw);
  const native = await runRamp(opts, !!withDdc);
  return {
    applied: !!(native && native.applied),
    method: (native && native.method) || 'none',
    ddc: !!(native && native.ddc),
    gamma: !!(native && native.gamma),
    saturation: opts.saturation,
    contrast: opts.contrast,
    brightness: opts.brightness,
    gammaValue: opts.gamma,
    temperature: opts.temperature,
    monitorId: opts.monitorId
  };
}

function scheduleDdc(opts) {
  lastDdcOpts = opts;
  if (ddcTimer) clearTimeout(ddcTimer);
  ddcTimer = setTimeout(() => {
    ddcTimer = null;
    const next = lastDdcOpts;
    lastDdcOpts = null;
    if (!next) return;
    applyOnce(next, true).catch(() => {});
  }, 420);
}

/**
 * Aplica na tela real.
 * Slider: só gamma ramp (leve). Ao soltar / após debounce: DDC no monitor físico.
 */
async function applyScreenRamp(opts = {}) {
  const forceDdc = !!(opts && opts.forceDdc);
  applyPending = opts;
  if (applyInflight) return applyInflight;

  applyInflight = (async () => {
    let last = null;
    try {
      while (applyPending) {
        const next = applyPending;
        applyPending = null;
        last = await applyOnce(next, forceDdc);
        if (!forceDdc) scheduleDdc(next);
      }
    } finally {
      applyInflight = null;
      if (applyPending) applyScreenRamp(applyPending).catch(() => {});
    }
    return last || { applied: false, method: 'none' };
  })();
  return applyInflight;
}

function dispose() {
  if (ddcTimer) { clearTimeout(ddcTimer); ddcTimer = null; }
  killHelper();
}

function warmup() {
  ensureRampExe().then((exe) => {
    if (exe) {
      try { ensureHelper(exe); } catch (_) { /* ok */ }
    }
  }).catch(() => {});
}

module.exports = {
  getBrightness,
  setBrightness,
  getMonitors,
  applyScreenRamp,
  dispose,
  warmup
};
