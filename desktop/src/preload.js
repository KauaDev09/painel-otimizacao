'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('OrionAPI', {
  analyze: () => ipcRenderer.invoke('app:analyze'),
  getLast: () => ipcRenderer.invoke('app:getLast'),
  onStep: (cb) => {
    ipcRenderer.on('analysis:step', (_e, step) => cb(step));
  },
  generateReport: () => ipcRenderer.invoke('report:generate'),
  exportRaw: () => ipcRenderer.invoke('raw:export'),
  historyList: () => ipcRenderer.invoke('history:list'),
  historyCompare: (before, after) => ipcRenderer.invoke('history:compare', { before, after }),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // ---- Licença ----
  licenseGetState: () => ipcRenderer.invoke('license:getState'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseRefresh: () => ipcRenderer.invoke('license:refresh'),
  onLicenseChanged: (cb) => {
    ipcRenderer.on('license:changed', (_e, state) => cb(state));
  },

  // ---- Segurança / Game Boost (passos de progresso compartilham canal) ----
  securityAnalyze: () => ipcRenderer.invoke('security:analyze'),
  securityQuickScan: () => ipcRenderer.invoke('security:quickscan'),
  gameBoostAnalyze: () => ipcRenderer.invoke('gameboost:analyze'),
  onServiceStep: (cb) => {
    ipcRenderer.on('security:step', (_e, step) => cb(step));
  },

  // ---- Modo Jogo (Game Booster) ----
  gameBoostListGames: () => ipcRenderer.invoke('gameboost:listGames'),
  gameBoostAddGame: (payload) => ipcRenderer.invoke('gameboost:addGame', payload),
  gameBoostRemoveGame: (id) => ipcRenderer.invoke('gameboost:removeGame', id),
  gameBoostSessionStatus: () => ipcRenderer.invoke('gameboost:sessionStatus'),
  gameBoostStartSession: (id) => ipcRenderer.invoke('gameboost:startSession', id),
  gameBoostStopSession: () => ipcRenderer.invoke('gameboost:stopSession'),
  gameBoostPickExe: () => ipcRenderer.invoke('gameboost:pickExe'),
  onGameBoostSession: (cb) => {
    ipcRenderer.on('gameboost:session', (_e, payload) => cb(payload));
  },

  // ---- Motor de Otimização ----
  engineListItems: () => ipcRenderer.invoke('engine:listItems'),
  engineGetProfiles: () => ipcRenderer.invoke('engine:getProfiles'),
  engineGetDrivers: () => ipcRenderer.invoke('engine:getDrivers'),
  engineApply: (payload) => ipcRenderer.invoke('engine:apply', payload),
  engineUndoItem: (id) => ipcRenderer.invoke('engine:undoItem', id),
  engineListOperations: () => ipcRenderer.invoke('engine:listOperations'),
  engineGetOperation: (opId) => ipcRenderer.invoke('engine:getOperation', opId),
  engineUndoOperation: (opId) => ipcRenderer.invoke('engine:undoOperation', opId),
  cleanerTargets: () => ipcRenderer.invoke('cleaner:targets'),
  cleanerMeasure: (ids) => ipcRenderer.invoke('cleaner:measure', ids),
  cleanerClean: (ids) => ipcRenderer.invoke('cleaner:clean', ids),
  repairOptions: () => ipcRenderer.invoke('repair:options'),
  repairRun: (optionId) => ipcRenderer.invoke('repair:run', optionId),
  repairQuickFix: () => ipcRenderer.invoke('repair:quickfix'),

  // ---- Módulos adicionais ----
  monitorSnapshot: () => ipcRenderer.invoke('monitor:snapshot'),
  startupList: () => ipcRenderer.invoke('startup:list'),
  startupSetEnabled: (payload) => ipcRenderer.invoke('startup:setEnabled', payload),
  processList: () => ipcRenderer.invoke('process:list'),
  processKill: (payload) => ipcRenderer.invoke('process:kill', payload),
  processSetPriority: (payload) => ipcRenderer.invoke('process:setPriority', payload),
  networkInfo: () => ipcRenderer.invoke('network:info'),
  networkPingTest: (opts) => ipcRenderer.invoke('network:pingTest', opts),
  networkDnsTest: (domain) => ipcRenderer.invoke('network:dnsTest', domain),
  benchmarkList: () => ipcRenderer.invoke('benchmark:list'),
  benchmarkRun: (payload) => ipcRenderer.invoke('benchmark:run', payload),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings:set', patch),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: (url) => ipcRenderer.invoke('update:download', url),
  updateInstall: (filePath) => ipcRenderer.invoke('update:install', filePath),
  updateCancel: () => ipcRenderer.invoke('update:cancel'),
  onDownloadProgress: (cb) => {
    ipcRenderer.on('update:download-progress', (_e, progress) => cb(progress));
  },
  onInstalling: (cb) => {
    ipcRenderer.on('update:installing', (_e, info) => cb(info));
  },
  getAppMeta: () => ipcRenderer.invoke('app:meta'),
  appHealth: () => ipcRenderer.invoke('app:health'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update:available', (_e, res) => cb(res));
  },
  onEngineStep: (cb) => {
    ipcRenderer.on('engine:step', (_e, step) => cb(step));
  },

  biosScan: () => ipcRenderer.invoke('bios:scan'),
  biosList: () => ipcRenderer.invoke('bios:list'),
  biosDryRun: (id) => ipcRenderer.invoke('bios:dryRun', id),
  biosGuide: (id) => ipcRenderer.invoke('bios:guide', id),
  biosApply: (payload) => ipcRenderer.invoke('bios:apply', payload),
  biosScheduleVerify: (id) => ipcRenderer.invoke('bios:scheduleVerify', id),
  biosVerifyPending: () => ipcRenderer.invoke('bios:verifyPending'),
  biosRollback: (id) => ipcRenderer.invoke('bios:rollback', id),
  biosReboot: () => ipcRenderer.invoke('bios:reboot'),
  biosLogs: () => ipcRenderer.invoke('bios:logs'),
  onBiosBootVerify: (cb) => {
    ipcRenderer.on('bios:boot-verify', (_e, res) => cb(res));
  },

  // Window controls (frameless)
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
});
