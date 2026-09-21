'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Protocolo local p/ ícones e capas — sem base64 na RAM do renderer.
protocol.registerSchemesAsPrivileged([{
  scheme: 's4-media',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    bypassCSP: true,
    stream: true,
    corsEnabled: true
  }
}]);

// Evita que um erro isolado (ex.: módulo screen antes de ready) mate o processo
// com o diálogo "A JavaScript error occurred in the main process".
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (err) => {
  console.error('[main] unhandledRejection:', err && err.stack ? err.stack : err);
});

const { runAnalysis } = require('./core/analyzer');
const { ReportService } = require('./reports/reportService');
const { HistoryService } = require('./history/historyService');
const { LicenseService } = require('./license/licenseService');
const { SecurityService } = require('./security/securityService');
const { GameBoostService, GameMode } = require('./gameboost/gameBoostService');
const { HistorySync } = require('./history/historySync');
const engineService = require('./engine/engineService');
const cleanerService = require('./engine/cleanerService');
const repairService = require('./engine/repairService');
const protection = require('./engine/restorePoint');
const runner = require('./engine/runner');

// Módulos adicionais integrados ao produto único.
const monitorService = require('./modules/monitorService');
const startupService = require('./modules/startupService');
const processService = require('./modules/processService');
const networkService = require('./modules/networkService');
const benchmarkService = require('./modules/benchmarkService');
const settingsService = require('./modules/settingsService');
const displayService = require('./modules/displayService');
const appLibrary = require('./modules/appLibrary');
const updaterService = require('./modules/updaterService');
const audit = require('./modules/auditService');
// screenOverlay acessa o módulo `screen` — só carrega depois de ready.
let screenOverlay = null;
function getScreenOverlay() {
  if (!screenOverlay) screenOverlay = require('./modules/screenOverlay');
  return screenOverlay;
}
const { biosManager } = require('./bios/optimization/biosManager');
const { APP_NAME } = require('./config/appConfig');

let mainWindow = null;
let tray = null;
let quitting = false;
let lastResult = null;
let analyzing = false;
let reportService = null;
let historyService = null;
let licenseService = null;
let securityService = null;
let gameBoostService = null;
let gameMode = null;
let historySync = null;

function appIcon() {
  const p = path.join(__dirname, 'assets', 'icon.png');
  return fs.existsSync(p) ? nativeImage.createFromPath(p) : undefined;
}

function createTray() {
  if (tray || !appIcon()) return;
  tray = new Tray(appIcon());
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}

function applyGeneralSettings(settings) {
  const g = settings.general;
  // Iniciar com o Windows (efetivo por usuário).
  try {
    app.setLoginItemSettings({ openAtLogin: !!g.startWithWindows });
  } catch (_) { /* ambientes sem suporte */ }
  if (g.minimizeToTray) createTray();
}

function migrateLegacyUserData() {
  // Mantém licença/histórico de versões anteriores do app (pacote antigo).
  try {
    const appData = app.getPath('appData');
    const legacyDirs = [
      path.join(appData, 'orion-optimizer'),
      path.join(appData, 'Orion Optimizer')
    ];
    const target = app.getPath('userData');
    const targetLicense = path.join(target, 'license');
    if (fs.existsSync(targetLicense)) return;

    for (const legacy of legacyDirs) {
      if (!fs.existsSync(legacy)) continue;
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(legacy)) {
        const src = path.join(legacy, name);
        const dest = path.join(target, name);
        if (!fs.existsSync(dest)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }
      break;
    }

    const docs = app.getPath('documents');
    const legacyDocs = path.join(docs, 'Orion Optimizer');
    const newDocs = path.join(docs, 'SevenOptimizer');
    if (fs.existsSync(legacyDocs) && !fs.existsSync(newDocs)) {
      fs.cpSync(legacyDocs, newDocs, { recursive: true });
    }
  } catch (err) {
    console.error('[main] migrateLegacyUserData:', err && err.message);
  }
}

function initServices() {
  migrateLegacyUserData();
  const docs = app.getPath('documents');
  const reportsDir = path.join(docs, 'SevenOptimizer', 'Relatorios');
  const rawDir = path.join(docs, 'SevenOptimizer', 'Dados');
  reportService = new ReportService(reportsDir);

  // Dados locais do aplicativo (%APPDATA%/sevenoptimizer)
  const userData = app.getPath('userData');
  historyService = new HistoryService(path.join(userData, 'history'));

  // Preferências do usuário (aplicadas imediatamente).
  settingsService.init(path.join(userData));
  applyGeneralSettings(settingsService.get());

  // Licenciamento, segurança e game boost (novos módulos integrados)
  const licenseDir = path.join(userData, 'license');
  licenseService = new LicenseService(licenseDir);
  licenseService.onChange((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('license:changed', state);
    }
  });
  licenseService.startBackgroundRefresh();

  securityService = new SecurityService();
  gameBoostService = new GameBoostService();
  gameMode = new GameMode();
  gameMode.setStoreDir(path.join(userData, 'gameboost'));
  gameMode.clearStale();
  historySync = new HistorySync(licenseService);

  // Motor de otimização (catálogo + executor silencioso + proteção)
  const stateDir = path.join(userData, 'engine');
  const logsDir = path.join(userData, 'engine', 'logs');
  const protectionDir = path.join(userData, 'engine', 'protection');
  runner.setLogsDir(logsDir);
  protection.setBaseDir(protectionDir);
  engineService.setStateDir(path.join(stateDir, 'operations'));

  // Benchmarks locais (comparação antes/depois)
  benchmarkService.setStoreDir(path.join(userData, 'benchmarks'));

  // Módulo de BIOS Optimization (scanner, pending, verificação pós-reboot)
  biosManager.init(userData);
  return rawDir;
}

// Compatibilidade máxima: detecta renderização por software (sem GPU ou GPU
// bloqueada) e avisa o renderer/CSS para degradar efeitos pesados (glass/glow).
// Também aceita a flag manual --s4-disable-effects para testes/uso em HW fraco.
function isSoftwareRendering() {
  try {
    const st = app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : null;
    if (!st) return false;
    const weak = (v) => v === 'software' || v === 'disabled' || v === 'blocklisted' || v === 'unavailable_off';
    return weak(st.gpu_compositing) || weak(st.opengl);
  } catch (_) {
    return false;
  }
}

function createWindow() {
  const forcedCompatibility = process.argv.includes('--s4-disable-effects');
  const lowPower = forcedCompatibility || isSoftwareRendering();
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#00000000',
    transparent: true,
    title: APP_NAME,
    icon: appIcon(),
    frame: false,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: [`--s4-low-power=${lowPower ? 1 : 0}`]
    }
  });
  mainWindow.setMenuBarVisibility(false);
  const reactIndex = path.join(__dirname, '..', 'app', 'dist', 'index.html');
  mainWindow.loadFile(reactIndex);

  // Navegação restrita: o app é 100% local (arquivos do pacote). Nenhuma
  // página/chave externa pode trocar o conteúdo da janela principal.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!String(url).startsWith('file://')) e.preventDefault();
  });
  // Links externos (Discord, loja, checkout, suporte) abrem no navegador do
  // sistema, jamais em janelas com acesso ao preload/IPC do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString());
    } catch (_) { /* ignora navegações inválidas */ }
    return { action: 'deny' };
  });

  setTimeout(() => {
    try { displayService.warmup(); } catch (_) { /* ok */ }
    const disp = settingsService.get().display || {};
    const needsRestore = ['saturation', 'contrast', 'brightness', 'gamma', 'temperature']
      .some((k) => Number(disp[k] ?? 100) !== 100);
    if (needsRestore) applyScreenRampAndOverlay({ ...disp, forceDdc: false }).catch(() => {});
    // Biblioteca em idle — não bloqueia a UI na abertura.
    setTimeout(() => {
      try { appLibrary.warmupLibrary(); } catch (_) { /* ok */ }
    }, 2500);
  }, 900);

  // Envia referência da janela ao updater para comunicação via IPC.
  updaterService.setMainWindow(mainWindow);
  if (gameMode) gameMode.setMainWindow(mainWindow);

  // Notifica o renderer sobre o estado de maximização (ícone maximizar/restaurar).
  const sendMaxState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', sendMaxState);
  mainWindow.on('unmaximize', sendMaxState);

  // Minimizar para a bandeja em vez de fechar (preferência do usuário).
  mainWindow.on('close', (e) => {
    const minimize = settingsService.get().general.minimizeToTray;
    if (!quitting && minimize && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// Aplica a curva de gama na tela real (contraste/saturação/brilho). Quando o
// driver bloqueia a gamma ramp — comum no Windows 10/11 — o brilho é tratado
// por uma camada transparente (overlay dim) que escurece a tela inteira.
async function applyScreenRampAndOverlay(opts = {}) {
  const bri = Number(opts.brightness);
  const brightness = Number.isFinite(bri) ? Math.max(0, Math.min(200, Math.round(bri))) : 100;
  let res;
  try {
    res = await displayService.applyScreenRamp({
      saturation: opts.saturation,
      contrast: opts.contrast,
      brightness,
      gamma: opts.gamma,
      temperature: opts.temperature,
      monitorId: opts.monitorId,
      bounds: opts.bounds,
      forceDdc: !!(opts && opts.forceDdc)
    });
  } catch (_) {
    res = { applied: false, method: 'gamma-ramp' };
  }
  if (res.applied) {
    getScreenOverlay().hide();
    const mode = res.ddc ? 'ddc' : (res.gamma || res.method === 'gamma-ramp' ? 'gamma' : (res.wmi ? 'wmi' : (res.method || 'gamma')));
    return {
      ...res,
      overlay: false,
      effectiveBrightness: brightness,
      brightnessMode: mode,
      saturationMode: res.ddc || res.gamma ? mode : mode,
      contrastMode: res.ddc || res.gamma ? mode : mode
    };
  }
  // Sem DDC/gamma: overlay só cobre brilho abaixo de 100.
  getScreenOverlay().setBrightness(Math.min(100, brightness));
  const overlayActive = brightness < 100;
  return {
    ...res,
    applied: overlayActive,
    overlay: overlayActive,
    effectiveBrightness: brightness,
    brightnessMode: overlayActive ? 'overlay' : 'none',
    saturationMode: 'blocked',
    contrastMode: 'blocked'
  };
}

function checkUpdatesOnStartup() {
  if (!settingsService.get().updates.autoCheck) return;
  updaterService.checkForUpdate(licenseService.getLicenseKey())
    .then((res) => {
      if (res.available && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', res);
      }
    })
    .catch(() => { /* silencioso — sem rede não há como saber */ });
}

app.whenReady().then(() => {
  protocol.handle('s4-media', (request) => {
    try {
      const filePath = appLibrary.resolveMediaUrl(request.url);
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }
      const { pathToFileURL } = require('url');
      return net.fetch(pathToFileURL(filePath).href);
    } catch (_) {
      return new Response('Error', { status: 500 });
    }
  });

  initServices();
  registerIpc();
  createWindow();
  setTimeout(() => {
    try {
      require('./engine/scriptsSync').reinit();
      try { require('./engine/catalog').invalidateScriptsBase(); } catch (_) { /* ok */ }
    } catch (_) { /* ok */ }
  }, 400);
  setTimeout(() => {
    biosManager.verifyPending().then((res) => {
      if (res && res.checked && res.checked.length && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bios:boot-verify', res);
      }
    }).catch(() => { /* verificação best-effort */ });
  }, 1200);
  setTimeout(checkUpdatesOnStartup, 8000); // não atrasa a inicialização
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
  try { if (screenOverlay) screenOverlay.dispose(); } catch (_) {}
  try { displayService.dispose(); } catch (_) {}
});

app.on('window-all-closed', () => {
  app.quit();
});

function sendStep(step) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('analysis:step', step);
  }
}

function sendSecurityStep(step) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('security:step', step);
  }
}

function requireActiveLicense() {
  const s = licenseService.getState();
  if (!s.active) {
    const e = new Error('Este recurso faz parte dos planos pagos. Ative sua licença na aba Licença para continuar.');
    e.code = 'LICENSE_REQUIRED';
    throw e;
  }
}

function sendEngineStep(name, ok, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('engine:step', { name, ok, message });
  }
}

// Itens gratuitos rodam sem licença; itens PRO exigem licença ativa.
function ensureLicenseForItems(ids) {
  const items = engineService.listItems();
  const proIds = new Set(items.filter((i) => i.proOnly).map((i) => i.id));
  const hasPro = (ids || []).some((id) => proIds.has(String(id)));
  if (hasPro) requireActiveLicense();
}

function registerIpc() {
  ipcMain.handle('app:analyze', async () => {
    if (analyzing) throw new Error('Uma análise já está em andamento.');
    analyzing = true;
    try {
      lastResult = await runAnalysis(sendStep);
      try { await biosManager.evaluateProfile(lastResult.profile); } catch (_) { /* módulo BIOS não deve derrubar a análise */ }
      const entry = historyService.saveFromResult(lastResult);
      lastResult.historyId = entry.id;

      // Sincroniza resumo com o backend quando licenciado (best-effort).
      licenseService.getMachineId().then((machineId) => {
        historySync.fireAndForget(historySync.sendAnalysis(entry, machineId));
      });

      return summarize(lastResult);
    } finally {
      analyzing = false;
    }
  });

  ipcMain.handle('app:getLast', () => (lastResult ? stripRaw(lastResult) : null));

  ipcMain.handle('report:generate', () => {
    if (!lastResult) throw new Error('Nenhuma análise concluída.');
    return reportService.generate(lastResult);
  });

  ipcMain.handle('raw:export', (e, payload) => {
    if (!lastResult) throw new Error('Nenhuma análise concluída.');
    const dir = path.join(app.getPath('documents'), 'SevenOptimizer', 'Dados');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(dir, `dados-brutos-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(payload || stripRaw(lastResult).profile, null, 2), 'utf8');
    return file;
  });

  ipcMain.handle('history:list', () => historyService.list());
  ipcMain.handle('history:compare', (_e, { before, after }) => historyService.compare(before, after));
  ipcMain.handle('shell:openPath', (_e, target) => {
    const t = String(target || '');
    if (!t || !fs.existsSync(t)) throw new Error('Caminho não encontrado.');
    return shell.openPath(t);
  });

  // ---- Licença ----
  ipcMain.handle('license:getState', () => licenseService.getState());
  ipcMain.handle('license:activate', (_e, key) => licenseService.activate(key));
  ipcMain.handle('license:refresh', () => licenseService.validateNow());
  ipcMain.handle('license:logout', () => licenseService.clear());

  // ---- Segurança (Defender / malware) ----
  ipcMain.handle('security:analyze', async () => {
    requireActiveLicense();
    return securityService.analyze(sendSecurityStep);
  });
  ipcMain.handle('security:quickscan', async () => {
    requireActiveLicense();
    return securityService.quickScanStart(sendSecurityStep);
  });

  // ---- Game Boost ----
  ipcMain.handle('gameboost:analyze', async () => {
    requireActiveLicense();
    return gameBoostService.analyze(sendSecurityStep);
  });

  // ---- Modo Jogo (Game Booster) ----
  ipcMain.handle('gameboost:listGames', () => gameMode.list());
  ipcMain.handle('gameboost:listLibrary', async () => {
    try {
      return await new Promise((resolve) => {
        setImmediate(() => {
          try { resolve(appLibrary.listLibrary()); }
          catch (_) { resolve([]); }
        });
      });
    } catch (_) {
      return [];
    }
  });
  ipcMain.handle('gameboost:icon', async (_e, exePath) => {
    try { return await appLibrary.getIconDataUrl(exePath); }
    catch (_) { return { ok: false, dataUrl: null }; }
  });
  ipcMain.handle('gameboost:artwork', async (_e, artworkPath) => {
    try {
      return await new Promise((resolve) => {
        setImmediate(() => {
          try { resolve(appLibrary.getArtworkDataUrl(artworkPath)); }
          catch (_) { resolve({ ok: false, dataUrl: null }); }
        });
      });
    } catch (_) {
      return { ok: false, dataUrl: null };
    }
  });
  ipcMain.handle('gameboost:addGame', (_e, payload) => gameMode.add(payload || {}));
  ipcMain.handle('gameboost:removeGame', (_e, id) => gameMode.remove(id));
  ipcMain.handle('gameboost:sessionStatus', () => gameMode.status());
  ipcMain.handle('gameboost:validate', (_e, id) => gameMode.validate(id));
  ipcMain.handle('gameboost:startSession', async (_e, id) => {
    requireActiveLicense();
    return gameMode.start(id);
  });
  ipcMain.handle('gameboost:stopSession', async () => {
    requireActiveLicense();
    return gameMode.stop();
  });
  ipcMain.handle('gameboost:pickExe', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecione o jogo ou aplicativo',
      properties: ['openFile'],
      filters: [
        { name: 'Executáveis e atalhos', extensions: ['exe', 'lnk', 'bat'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  // ---- Motor de Otimização (catálogo) ----
  ipcMain.handle('engine:listItems', () => engineService.listItems());
  ipcMain.handle('engine:getProfiles', () => engineService.getProfiles());
  ipcMain.handle('engine:getDrivers', () => engineService.getDrivers());
  ipcMain.handle('engine:apply', async (_e, payload) => {
    const ids = Array.isArray(payload && payload.ids) ? payload.ids.map(String) : [];
    ensureLicenseForItems(ids);
    try {
      const result = await engineService.applyItems(ids, {
        label: payload && payload.label,
        profile: (payload && payload.profile) || null,
        createRestorePoint: !!(payload && payload.createRestorePoint),
        onStep: sendEngineStep
      });
      audit.record('engine', 'apply', 'ok', {
        ids, count: ids.length,
        label: (payload && payload.label) || null,
        profile: (payload && payload.profile) || null
      });
      return result;
    } catch (err) {
      audit.record('engine', 'apply', 'error', { ids, message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });
  ipcMain.handle('engine:undoItem', async (_e, id) => {
    const item = engineService.listItems().find((i) => i.id === String(id));
    if (item && item.proOnly) requireActiveLicense();
    try {
      const result = await engineService.undoItem(id);
      audit.record('engine', 'undoItem', result && result.ok === false ? 'fail' : 'ok', { id: String(id), name: item && item.name });
      return result;
    } catch (err) {
      audit.record('engine', 'undoItem', 'error', { id: String(id), message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });
  ipcMain.handle('engine:listOperations', () => engineService.listOperations());
  ipcMain.handle('engine:getOperation', (_e, opId) => engineService.getOperation(opId));
  ipcMain.handle('engine:undoOperation', async (_e, opId) => {
    try {
      const result = await engineService.undoOperation(opId, { onStep: sendEngineStep });
      audit.record('engine', 'undoOperation', result && result.ok === false ? 'fail' : 'ok', { opId: String(opId) });
      return result;
    } catch (err) {
      audit.record('engine', 'undoOperation', 'error', { opId: String(opId), message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });

  // ---- Limpeza nativa ----
  ipcMain.handle('cleaner:targets', () => cleanerService.listTargets());
  ipcMain.handle('cleaner:measure', (_e, ids) => cleanerService.measureTargets(Array.isArray(ids) ? ids.map(String) : undefined));
  ipcMain.handle('cleaner:clean', async (_e, ids) => {
    const list = Array.isArray(ids) ? ids.map(String) : [];
    try {
      const result = await cleanerService.clean(list, { onStep: sendEngineStep });
      audit.record('cleaner', 'clean', 'ok', { targets: list, count: list.length });
      return result;
    } catch (err) {
      audit.record('cleaner', 'clean', 'error', { targets: list, message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });

  // ---- Reparo do sistema ----
  ipcMain.handle('repair:options', () => repairService.listOptions());
  ipcMain.handle('repair:run', audit.wrap('repair:run', 'repair', 'run', async (_e, optionId) => {
    requireActiveLicense();
    return repairService.runRepair(optionId, { onStep: sendEngineStep });
  }, (result, _e, optionId) => ({ option: optionId, ok: !!(result && result.ok === undefined ? true : result.ok) })));
  ipcMain.handle('repair:quickfix', audit.wrap('repair:quickfix', 'repair', 'quickfix', async () => {
    requireActiveLicense();
    return repairService.runQuickFix({ onStep: sendEngineStep });
  }));

  // ---- Monitor em tempo real (cache curto evita PowerShell empilhado) ----
  let snapshotCache = { data: null, ts: 0, inflight: null };
  ipcMain.handle('monitor:snapshot', () => {
    const now = Date.now();
    if (snapshotCache.data && now - snapshotCache.ts < 2500) return snapshotCache.data;
    if (snapshotCache.inflight) return snapshotCache.inflight;
    snapshotCache.inflight = monitorService.getSnapshot().then((data) => {
      snapshotCache = { data, ts: Date.now(), inflight: null };
      return data;
    }).catch((err) => {
      snapshotCache.inflight = null;
      throw err;
    });
    return snapshotCache.inflight;
  });

  // ---- Inicialização (Startup Manager) ----
  ipcMain.handle('startup:list', () => startupService.listStartup());
  ipcMain.handle('startup:setEnabled', async (_e, payload) => {
    const entry = payload && payload.entry;
    if (!entry || typeof entry.enabled !== 'boolean') {
      throw new Error('Solicitação inválida.');
    }
    try {
      const result = await startupService.setEnabled(entry, !!entry.enabled);
      audit.record('startup', 'setEnabled', 'ok', { name: entry.name || entry.command || null, enabled: !!entry.enabled });
      return result;
    } catch (err) {
      audit.record('startup', 'setEnabled', 'error', { name: entry.name || entry.command || null, message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });

  // ---- Processos ----
  ipcMain.handle('process:list', () => processService.listProcesses());
  ipcMain.handle('process:kill', audit.wrap('process:kill', 'process', 'kill', async (_e, { pid, name }) => {
    requireActiveLicense();
    return processService.killProcess(pid, name);
  }, (result, _e, args) => ({ pid: args && args.pid, name: args && args.name })));
  ipcMain.handle('process:setPriority', audit.wrap('process:setPriority', 'process', 'setPriority', async (_e, { pid, name, level }) => {
    requireActiveLicense();
    return processService.setPriority(pid, name, level);
  }, (result, _e, args) => ({ pid: args && args.pid, name: args && args.name, level: args && args.level })));

  // ---- Rede ----
  ipcMain.handle('network:info', () => networkService.getAdapterInfo());
  ipcMain.handle('network:pingTest', async (_e, opts) => {
    requireActiveLicense();
    return networkService.pingTest(opts || {});
  });
  ipcMain.handle('network:dnsTest', async (_e, domain) => {
    requireActiveLicense();
    return networkService.dnsTest(domain);
  });

  // ---- Benchmark ----
  ipcMain.handle('benchmark:list', () => benchmarkService.listBenchmarks());
  ipcMain.handle('benchmark:run', async (_e, payload) => {
    requireActiveLicense();
    return benchmarkService.runBenchmark({
      kinds: payload && payload.kinds,
      label: payload && payload.label
    });
  });

  // ---- Configurações ----
  ipcMain.handle('settings:get', () => settingsService.get());
  ipcMain.handle('settings:set', (_e, patch) => {
    const merged = settingsService.set(patch);
    applyGeneralSettings(merged);
    return merged;
  });

  // ---- Tela (Display) ----
  ipcMain.handle('display:monitors', () => displayService.getMonitors());
  ipcMain.handle('display:brightness:get', () => displayService.getBrightness());
  ipcMain.handle('display:brightness:set', (_e, percent) => displayService.setBrightness(percent));
  ipcMain.handle('display:screen-ramp', (_e, opts) => applyScreenRampAndOverlay(opts || {}));

  // ---- Atualizações ----
  ipcMain.handle('update:check', () => updaterService.checkForUpdate(licenseService.getLicenseKey()));
  ipcMain.handle('update:download', (_e, url) => updaterService.downloadUpdate(url));
  ipcMain.handle('update:install', audit.wrap('update:install', 'update', 'install', (_e, filePath) => updaterService.installUpdate(filePath), (result, _e, f) => ({ file: f ? path.basename(f) : null })));
  ipcMain.handle('update:cancel', () => updaterService.cancelDownload());

  // ---- Metadados do produto / saúde da API ----
  const { APP_VERSION, OFFICIAL_URL } = require('./config/appConfig');
  ipcMain.handle('app:meta', () => ({ appName: APP_NAME, version: APP_VERSION, officialUrl: OFFICIAL_URL }));
  ipcMain.handle('app:health', async () => {
    try {
      const { getApiBaseUrl } = require('./license/config');
      await require('./license/apiClient').getJson(getApiBaseUrl(), '/api/v1/health', { timeoutMs: 8000 });
      return { online: true };
    } catch (_) {
      return { online: false };
    }
  });

  // ---- SevenIA (assistente de IA) ----
  // O token HMAC do cliente fica apenas no processo principal; o renderer
  // nunca recebe o token. Uso offline é informativo (não bloqueia).
  // O renderer depende de { ok, code, message } — nunca lançar Error pelo
  // IPC, pois o Electron só preserva "message" (o "code" se perde).
  const seveniaFailure = (code, message) => ({ ok: false, code, message });

  ipcMain.handle('sevenia:usage', async () => {
    const { getApiBaseUrl } = require('./license/config');
    const { getJson } = require('./license/apiClient');
    if (!licenseService.getToken()) {
      return seveniaFailure('LICENSE_REQUIRED', 'Ative sua licença para usar a SevenIA.');
    }
    try {
      return await getJson(getApiBaseUrl(), '/api/v1/sevenia/uso-hoje', {
        headers: { Authorization: `Bearer ${licenseService.getToken()}` },
        timeoutMs: 10000
      });
    } catch (err) {
      if (!err.code || err.code === 'NETWORK_ERROR' || err.code === 'HTTP_ERROR') {
        return { ok: false, usage: null, offline: true };
      }
      return seveniaFailure(err.code || 'SEVENIA_ERROR', err.message || 'Não foi possível falar com a SevenIA.');
    }
  });
  ipcMain.handle('sevenia:chat', async (_e, payload) => {
    const { getApiBaseUrl } = require('./license/config');
    const { postJson } = require('./license/apiClient');
    if (!licenseService.getToken()) {
      return seveniaFailure('LICENSE_REQUIRED', 'Ative sua licença para usar a SevenIA.');
    }
    const message = String((payload && payload.message) || '').trim();
    if (!message) return seveniaFailure('BAD_REQUEST', 'Digite uma mensagem para a SevenIA.');
    const history = Array.isArray(payload && payload.history) ? payload.history : [];
    try {
      return await postJson(
        getApiBaseUrl(),
        '/api/v1/sevenia/chat',
        { message, history: history.slice(-12) },
        {
          headers: { Authorization: `Bearer ${licenseService.getToken()}` },
          timeoutMs: 70000
        }
      );
    } catch (err) {
      const code = err.code || 'SEVENIA_ERROR';
      let text = err.message || 'Não foi possível falar com a SevenIA.';
      if (code === 'NETWORK_ERROR') {
        text = 'Sem conexão com o servidor agora. Verifique sua internet e tente novamente.';
      } else if (code === 'SEVENIA_TIMEOUT') {
        text = 'A SevenIA está demorando para responder. Tente novamente.';
      }
      return seveniaFailure(code, text);
    }
  });

  // ---- Links externos (somente URLs http/https) ----
  // ---- BIOS Optimization ----
  ipcMain.handle('bios:scan', async () => {
    return biosManager.scan(sendStep, { profile: lastResult && lastResult.profile });
  });
  ipcMain.handle('bios:list', () => biosManager.list());
  ipcMain.handle('bios:dryRun', (_e, id) => biosManager.dryRun(String(id || '')));
  ipcMain.handle('bios:guide', (_e, id) => biosManager.guide(String(id || '')));
  ipcMain.handle('bios:apply', async (_e, payload) => {
    const id = payload && payload.id;
    if (payload && payload.dryRunOnly) return biosManager.apply(String(id || ''), { dryRunOnly: true });
    requireActiveLicense();
    try {
      const result = await biosManager.apply(String(id || ''), {
        reboot: !!(payload && payload.reboot),
        dryRunOnly: false
      });
      audit.record('bios', 'apply', 'ok', { id: String(id), reboot: !!(payload && payload.reboot) });
      return result;
    } catch (err) {
      audit.record('bios', 'apply', 'error', { id: String(id), message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });
  ipcMain.handle('bios:scheduleVerify', (_e, id) => biosManager.scheduleVerify(String(id || '')));
  ipcMain.handle('bios:verifyPending', () => biosManager.verifyPending());
  ipcMain.handle('bios:rollback', async (_e, id) => {
    requireActiveLicense();
    try {
      const result = await biosManager.rollback(String(id || ''));
      audit.record('bios', 'rollback', 'ok', { id: String(id) });
      return result;
    } catch (err) {
      audit.record('bios', 'rollback', 'error', { id: String(id), message: String(err && err.message || err).slice(0, 300) });
      throw err;
    }
  });
  ipcMain.handle('bios:reboot', async () => {
    requireActiveLicense();
    return biosManager.requestReboot();
  });
  ipcMain.handle('bios:logs', () => biosManager.getLogs());

  ipcMain.handle('shell:openExternal', (_e, url) => {
    let u;
    try { u = new URL(String(url)); } catch (_) { throw new Error('URL inválida.'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new Error('Somente links http/https podem ser abertos.');
    }
    return shell.openExternal(u.toString());
  });

  // Window controls (frameless)
  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
  ipcMain.handle('window:isMaximized', () => !!(mainWindow && mainWindow.isMaximized()));
}

function stripRaw(result) {
  const { profile, ...rest } = result;
  const { raw, ...profileClean } = profile;
  return { profile: profileClean, ...rest };
}

function summarize(result) {
  return {
    overall: result.scores.overall,
    categories: Object.fromEntries(Object.entries(result.scores.categories).map(([k, v]) => [k, v.percent])),
    counts: result.counts,
    historyId: result.historyId
  };
}
