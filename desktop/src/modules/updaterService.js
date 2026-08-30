'use strict';

// UpdaterService — verificação, download e instalação de atualizações.
// Fluxo: 1) Consulta API → 2) Download do NSIS com progresso → 3) Instalação silenciosa → 4) Reinício

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { app, BrowserWindow } = require('electron');
const { getJson } = require('../license/apiClient');
const { getApiBaseUrl } = require('../license/config');
const { APP_VERSION, APP_NAME } = require('../config/appConfig');

let mainWindow = null;
let downloading = false;
let currentDownload = null;

function setMainWindow(win) {
  mainWindow = win;
}

function parseVersion(v) {
  const parts = String(v || '').split('.').map((x) => parseInt(x, 10));
  return parts.map((n) => (Number.isFinite(n) ? n : 0));
}

function isNewer(candidate, current = APP_VERSION) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Consulta o servidor. Retorna:
 *   { available: false }                       — sem atualização
 *   { available: true, update: {...} }         — nova versão publicada
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

/**
 * Faz o download do instalador NSIS com progresso.
 * Retorna quando concluído ou lança erro.
 */
async function downloadUpdate(url) {
  if (downloading) throw new Error('Um download já está em andamento.');
  if (!url) throw new Error('URL de download não fornecida.');

  downloading = true;

  const tempDir = path.join(app.getPath('temp'), APP_NAME.replace(/\s+/g, '_'));
  fs.mkdirSync(tempDir, { recursive: true });

  const filename = `OrionOptimizer-Setup-${Date.now()}.exe`;
  const destPath = path.join(tempDir, filename);

  try {
    await _downloadFile(url, destPath);
    downloading = false;
    return { ok: true, filePath: destPath };
  } catch (err) {
    downloading = false;
    // Limpa arquivo parcial
    try { fs.unlinkSync(destPath); } catch (_) { /* ignora */ }
    throw err;
  }
}

function _downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (_) {
      reject(new Error('URL de download inválida.'));
      return;
    }

    const mod = u.protocol === 'http:' ? http : https;

    const req = mod.get(u, { timeout: 120000 }, (res) => {
      // Segue redirecionamentos (301, 302, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        _downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Servidor respondeu HTTP ${res.statusCode} ao baixar atualização.`));
        return;
      }

      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let receivedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        const progress = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : -1;
        sendToRenderer('update:download-progress', {
          percent: progress,
          received: receivedBytes,
          total: totalBytes
        });
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (_) { /* ignora */ }
        reject(err);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tempo esgotado ao baixar a atualização.'));
    });

    req.on('error', (err) => {
      reject(new Error(`Falha ao baixar: ${err.message}`));
    });
  });
}

/**
 * Instala a atualização silenciosamente e reinicia o app.
 * O NSIS installer com /S roda em background e substitui os arquivos.
 */
async function installUpdate(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Arquivo de atualização não encontrado.');
  }

  sendToRenderer('update:installing', { message: 'Preparando instalação...' });

  return new Promise((resolve, reject) => {
    // Executa o instalador NSIS em modo silencioso
    const args = [
      '/S',                    // Modo silencioso
      '/D=' + app.getPath('appData')  // Diretório de instalação (NSIS)
    ];

    const child = execFile(filePath, args, { windowsHide: true }, (err) => {
      if (err && err.code !== 0) {
        // NSIS retorna 0 para sucesso; outros códigos podem ser cancelamento
        if (err.killed) {
          reject(new Error('Instalação cancelada.'));
        } else {
          // NSIS pode retornar não-zero mesmo em sucesso (caso o app feche)
          resolve({ ok: true });
        }
      } else {
        resolve({ ok: true });
      }
    });

    // Espera 2 segundos para o instalador iniciar, depois fecha o app
    setTimeout(() => {
      sendToRenderer('update:installing', { message: 'Instalando... O aplicativo será reiniciado.' });
      // Dá tempo para o NSIS começar a copiar arquivos
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 3000);
    }, 2000);
  });
}

/**
 * Cancela download em andamento.
 */
function cancelDownload() {
  if (currentDownload && currentDownload.destroy) {
    currentDownload.destroy();
    currentDownload = null;
  }
  downloading = false;
}

module.exports = {
  setMainWindow,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  cancelDownload,
  isNewer,
  APP_VERSION
};
