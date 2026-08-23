'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const { runAnalysis } = require('./core/analyzer');
const { ReportService } = require('./reports/reportService');
const { HistoryService } = require('./history/historyService');
const { LicenseService } = require('./license/licenseService');
const { SecurityService } = require('./security/securityService');
const { GameBoostService } = require('./gameboost/gameBoostService');
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
const updaterService = require('./modules/updaterService');
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

function initServices() {
  const docs = app.getPath('documents');
  const reportsDir = path.join(docs, 'Mainstreet BIOS Optimizer', 'Relatorios');
  const rawDir = path.join(docs, 'Mainstreet BIOS Optimizer', 'Dados');
  reportService = new ReportService(reportsDir);

  // Dados locais do aplicativo (%APPDATA%/mainstreet-bios-optimizer)
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
  return rawDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#0b0b0d',
    title: APP_NAME,
    icon: appIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Minimizar para a bandeja em vez de fechar (preferência do usuário).
  mainWindow.on('close', (e) => {
    const minimize = settingsService.get().general.minimizeToTray;
    if (!quitting && minimize && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function checkUpdatesOnStartup() {
  if (!settingsService.get().updates.autoCheck) return;
  updaterService.checkForUpdate()
    .then((res) => {
      if (res.available && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:available', res);
      }
    })
    .catch(() => { /* silencioso — sem rede não há como saber */ });
}

app.whenReady().then(() => {
  initServices();
  registerIpc();
  createWindow();
  setTimeout(checkUpdatesOnStartup, 8000); // não atrasa a inicialização
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { quitting = true; });

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
    const e = new Error('Licença inválida, expirada ou não ativada. Ative o produto para usar este recurso.');
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
    const dir = path.join(app.getPath('documents'), 'Mainstreet BIOS Optimizer', 'Dados');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(dir, `dados-brutos-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(payload || stripRaw(lastResult).profile, null, 2), 'utf8');
    return file;
  });

  ipcMain.handle('history:list', () => historyService.list());
  ipcMain.handle('history:compare', (_e, { before, after }) => historyService.compare(before, after));
  ipcMain.handle('shell:openPath', (_e, target) => shell.openPath(target));

  // ---- Licença ----
  ipcMain.handle('license:getState', () => licenseService.getState());
  ipcMain.handle('license:activate', (_e, key) => licenseService.activate(key));
  ipcMain.handle('license:refresh', () => licenseService.validateNow());

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

  // ---- Motor de Otimização (catálogo) ----
  ipcMain.handle('engine:listItems', () => engineService.listItems());
  ipcMain.handle('engine:getProfiles', () => engineService.getProfiles());
  ipcMain.handle('engine:getDrivers', () => engineService.getDrivers());
  ipcMain.handle('engine:apply', async (_e, payload) => {
    const ids = Array.isArray(payload && payload.ids) ? payload.ids.map(String) : [];
    ensureLicenseForItems(ids);
    return engineService.applyItems(ids, {
      label: payload && payload.label,
      profile: (payload && payload.profile) || null,
      createRestorePoint: !!(payload && payload.createRestorePoint),
      onStep: sendEngineStep
    });
  });
  ipcMain.handle('engine:undoItem', async (_e, id) => {
    const item = engineService.listItems().find((i) => i.id === String(id));
    if (item && item.proOnly) requireActiveLicense();
    return engineService.undoItem(id);
  });
  ipcMain.handle('engine:listOperations', () => engineService.listOperations());
  ipcMain.handle('engine:getOperation', (_e, opId) => engineService.getOperation(opId));
  ipcMain.handle('engine:undoOperation', async (_e, opId) => {
    requireActiveLicense();
    return engineService.undoOperation(opId, { onStep: sendEngineStep });
  });

  // ---- Limpeza nativa ----
  ipcMain.handle('cleaner:targets', () => cleanerService.listTargets());
  ipcMain.handle('cleaner:measure', (_e, ids) => cleanerService.measureTargets(Array.isArray(ids) ? ids.map(String) : undefined));
  ipcMain.handle('cleaner:clean', async (_e, ids) => {
    requireActiveLicense();
    return cleanerService.clean(Array.isArray(ids) ? ids.map(String) : [], { onStep: sendEngineStep });
  });

  // ---- Reparo do sistema ----
  ipcMain.handle('repair:options', () => repairService.listOptions());
  ipcMain.handle('repair:run', async (_e, optionId) => {
    requireActiveLicense();
    return repairService.runRepair(optionId, { onStep: sendEngineStep });
  });
  ipcMain.handle('repair:quickfix', async () => {
    requireActiveLicense();
    return repairService.runQuickFix({ onStep: sendEngineStep });
  });

  // ---- Monitor em tempo real (dados reais; leitura somente) ----
  ipcMain.handle('monitor:snapshot', () => monitorService.getSnapshot());

  // ---- Inicialização (Startup Manager) ----
  ipcMain.handle('startup:list', () => startupService.listStartup());
  ipcMain.handle('startup:setEnabled', async (_e, payload) => {
    const entry = payload && payload.entry;
    if (!entry || typeof entry.enabled !== 'boolean') {
      throw new Error('Solicitação inválida.');
    }
    return startupService.setEnabled(entry, !!entry.enabled);
  });

  // ---- Processos ----
  ipcMain.handle('process:list', () => processService.listProcesses());
  ipcMain.handle('process:kill', async (_e, { pid, name }) => {
    requireActiveLicense();
    return processService.killProcess(pid, name);
  });
  ipcMain.handle('process:setPriority', async (_e, { pid, name, level }) => {
    requireActiveLicense();
    return processService.setPriority(pid, name, level);
  });

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

  // ---- Atualizações ----
  ipcMain.handle('update:check', () => updaterService.checkForUpdate());

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

  // ---- Links externos (somente URLs http/https) ----
  ipcMain.handle('shell:openExternal', (_e, url) => {
    let u;
    try { u = new URL(String(url)); } catch (_) { throw new Error('URL inválida.'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new Error('Somente links http/https podem ser abertos.');
    }
    return shell.openExternal(u.toString());
  });
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
