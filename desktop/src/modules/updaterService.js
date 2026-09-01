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
async function checkForUpdate(licenseKey) {
  const base = getApiBaseUrl();
  const q = licenseKey ? `?key=${encodeURIComponent(licenseKey)}` : '';
  const res = await getJson(base, '/api/v1/app/updates/latest' + q, { timeoutMs: 12000 });
  const upd = res.update;
  if (!upd || !upd.version) return { available: false };
  if (!isNewer(upd.version)) return { available: false };
  return {
    available: true,
    requiresPurchase: !!upd.requiresPurchase,
    update: {
      version: String(upd.version),
      url: String(upd.downloadUrl || ''),
      changelog: String(upd.changelog || ''),
      mandatory: !!upd.mandatory && !upd.requiresPurchase,
      releasedAt: upd.releasedAt || null,
      price: upd.price || null,
      storeUrl: upd.storeUrl || null
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
        if (currentDownload === req) currentDownload = null;
        _downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        if (currentDownload === req) currentDownload = null;
        reject(new Error(`Servidor respondeu HTTP ${res.statusCode} ao baixar atualização.`));
        return;
      }

      // Garante que a URL aponta para um arquivo binário, nunca para uma página.
      const contentType = String(res.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        if (currentDownload === req) currentDownload = null;
        reject(new Error('A URL de download não apontou para um instalador válido (página web). Verifique a URL publicada.'));
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
        if (currentDownload === req) currentDownload = null;
        if (!isWindowsExecutable(destPath)) {
          try { fs.unlinkSync(destPath); } catch (_) { /* ignora */ }
          reject(new Error('O arquivo baixado não é um instalador executável válido (.exe).'));
          return;
        }
        resolve();
      });

      fileStream.on('error', (err) => {
        if (currentDownload === req) currentDownload = null;
        try { fs.unlinkSync(destPath); } catch (_) { /* ignora */ }
        reject(err);
      });

      res.on('aborted', () => {
        if (currentDownload === req) currentDownload = null;
        try { fs.unlinkSync(destPath); } catch (_) { /* ignora */ }
        reject(new Error('Download cancelado.'));
      });
    });

    currentDownload = req;

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tempo esgotado ao baixar a atualização.'));
    });

    req.on('error', (err) => {
      if (currentDownload === req) currentDownload = null;
      reject(new Error(`Falha ao baixar: ${err.message}`));
    });
  });
}

// Executáveis Windows (PE) iniciam com os bytes "MZ".
function isWindowsExecutable(file) {
  try {
    const buf = Buffer.alloc(2);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf.toString('latin1').toUpperCase() === 'MZ';
  } catch (_) {
    return false;
  }
}

/**
 * Instala a atualização silenciosamente e reinicia o app.
 *
 * O instalador NSIS é perMachine (instala em Program Files) e pede UAC,
 * então ele NÃO pode usar "/D" (que apontaria para o diretório errado) nem
 * pode ser executado enquanto o app está aberto com arquivos em uso.
 *
 * Fluxo:
 *  1) Inicia um helper PowerShell ELEVADO que:
 *       - aguarda o app atual fechar (liberando os .exe em uso);
 *       - roda o instalador em modo silencioso (/S, com UAC já aceito);
 *       - relança o aplicativo atualizado via explorer.exe (fora de elevação).
 *  2) O processo do app se encerra após ~2,5s para liberar os arquivos.
 */
async function installUpdate(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Arquivo de atualização não encontrado.');
  }

  sendToRenderer('update:installing', { message: 'Preparando instalação...' });

  const installerPath = path.resolve(filePath);
  const exePath = process.execPath;
  const appPid = process.pid;
  const psExe = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );

  const helperDir = path.join(app.getPath('temp'), APP_NAME.replace(/\s+/g, '_'));
  fs.mkdirSync(helperDir, { recursive: true });
  const helperPath = path.join(helperDir, `apply-update-${Date.now()}.ps1`);

  const helper = [
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    `$installer = '${String(installerPath).replace(/'/g, "''")}'`,
    `$exe = '${String(exePath).replace(/'/g, "''")}'`,
    `$appPid = ${Number(appPid)}`,
    // 1) Aguarda o app atual sair (os .exe em Program Files são liberados)
    'while (Get-Process -Id $appPid -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 350 }',
    'Start-Sleep -Milliseconds 900',
    // 2) Instala silenciosamente (já elevado → sem novo prompt de UAC)
    '$inst = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru',
    'Start-Sleep -Milliseconds 600',
    // 3) Relança o app fora de elevação para não herdar privilégios elevados
    'if (Test-Path -LiteralPath $exe) { Start-Process -FilePath "explorer.exe" -ArgumentList ("\"\"" + $exe + "\"\"") } else { Start-Process -FilePath $exe }',
    'exit 0'
  ].join('\n');

  fs.writeFileSync(helperPath, '\ufeff' + helper, 'utf8');

  const elevatedCmd =
    'Start-Process -FilePath ' + JSON.stringify(psExe) +
    " -ArgumentList '-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File'," +
    JSON.stringify(helperPath) + ' -Verb RunAs -WindowStyle Hidden';

  sendToRenderer('update:installing', { message: 'Solicitando permissão de administrador...' });

  execFile(psExe, ['-NoProfile', '-NonInteractive', '-Command', elevatedCmd], { windowsHide: true }, (err) => {
    // Mesmo se o UAC for cancelado, o helper só não roda; o fluxo não quebra.
    if (err) console.error('[updater] Falha ao iniciar helper (UAC cancelado?):', err.message);
  });

  sendToRenderer('update:installing', { message: 'Instalando... O aplicativo será fechado e reaberto automaticamente.' });

  return new Promise((resolve) => {
    // Dá tempo para o usuário aceitar o UAC e o helper iniciar; depois fecha o app
    // para liberar os arquivos em uso e deixar o helper finalizar a instalação
    // e relançar o aplicativo ATUALIZADO. NÃO usar app.relaunch() aqui:
    // ele relançaria o executável antigo antes da instalação terminar.
    setTimeout(() => {
      resolve({ ok: true, message: 'Atualização aplicada. O aplicativo será reaberto automaticamente.' });
      app.exit(0);
    }, 2500);
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
