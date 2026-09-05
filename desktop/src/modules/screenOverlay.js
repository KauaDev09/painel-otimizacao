'use strict';

// ScreenOverlay — camada escura transparente sobre todos os monitores.
//
// Fallback de BRILHO quando o driver de vídeo bloqueia a gamma ramp global
// (comportamento comum no Windows 10/11 com os drivers modernos, onde o DWM
// restringe SetDeviceGammaRamp). A janela é always-on-top, sem foco, sem clique
// (clique atravessa) e totalmente transparente — apenas a opacidade de preto
// escurece a tela inteira, exatamente como um dim.
//
// IMPORTANTE: o módulo `screen` do Electron lança se for lido antes de
// app.ready. Nunca desestruture `screen` no topo deste arquivo.

const { BrowserWindow, app } = require('electron');

const MAX_ALPHA = 0.85;

function overlayHtml(alpha) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;width:100vw;height:100vh;background:rgba(0,0,0,${alpha});user-select:none;"></body></html>`
  )}`;
}

function displayKey(d) {
  return `${d.bounds.x},${d.bounds.y},${d.bounds.width},${d.bounds.height}@${d.scaleFactor || 1}`;
}

let overlays = new Map(); // key -> { win, ready }
let listenersBound = false;

function getScreen() {
  if (!app || !app.isReady()) return null;
  try {
    return require('electron').screen;
  } catch (_) {
    return null;
  }
}

function bindDisplayListeners() {
  const screen = getScreen();
  if (!screen || listenersBound) return;
  listenersBound = true;
  screen.on('display-added', syncDisplays);
  screen.on('display-removed', syncDisplays);
  screen.on('display-metrics-changed', syncDisplays);
}

function createFor(display) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    show: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setContentProtection(true);

  const entry = { win, ready: new Promise((resolve) => {
    win.webContents.once('did-finish-load', () => resolve());
  }), displayKey: displayKey(display) };

  win.loadURL(overlayHtml(0.01));
  win.on('closed', () => { if (overlays.get(entry.displayKey) === entry) overlays.delete(entry.displayKey); });
  return entry;
}

function syncDisplays() {
  const screen = getScreen();
  if (!screen) return;
  bindDisplayListeners();
  const displays = screen.getAllDisplays();
  const keys = new Set(displays.map(displayKey));
  for (const [key, entry] of overlays) {
    if (!keys.has(key)) { entry.win.destroy(); overlays.delete(key); }
  }
  for (const display of displays) {
    const key = displayKey(display);
    if (!overlays.has(key)) overlays.set(key, createFor(display));
  }
}

function setAlpha(alpha) {
  syncDisplays();
  for (const entry of overlays.values()) {
    (entry.ready || Promise.resolve()).then(() => {
      if (overlays.size) {
        entry.win.webContents.executeJavaScript(
          `document.body.style.background='rgba(0,0,0,${alpha})';`
        ).catch(() => {});
      }
    }).catch(() => {});
  }
}

/** Brilho 0..100 → alpha 0 (100%) a MAX_ALPHA (0%). */
function setBrightness(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  if (p >= 100) { hide(); return; }
  const alpha = Math.min(MAX_ALPHA, ((100 - p) / 100) * 1.1);
  setAlpha(alpha.toFixed(3));
}

function hide() {
  for (const entry of overlays.values()) {
    (entry.ready || Promise.resolve()).then(() => {
      entry.win.webContents.executeJavaScript(`document.body.style.background='rgba(0,0,0,0)';`).catch(() => {});
    }).catch(() => {});
  }
}

function dispose() {
  for (const entry of overlays.values()) {
    try { entry.win.destroy(); } catch (_) { /* já fechada */ }
  }
  overlays.clear();
}

if (app) {
  if (app.isReady()) bindDisplayListeners();
  else app.once('ready', bindDisplayListeners);
}

module.exports = { setBrightness, hide, dispose };
