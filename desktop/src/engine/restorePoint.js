'use strict';

// RestorePointService — proteção antes de alterações importantes.
//   - Ponto de restauração do Windows via Checkpoint-Computer (requer admin).
//   - Backup do Registro POR OPERAÇÃO: cada item do catálogo declara as chaves
//     que toca; exportamos essas chaves antes de aplicar, permitindo desfazer
//     com precisão (reg import do .reg de backup).

const fs = require('fs');
const path = require('path');

let baseDir = null; // ex.: %APPDATA%/orion-optimizer/protection

function setBaseDir(dir) {
  baseDir = dir;
  fs.mkdirSync(dir, { recursive: true });
}

function getBaseDir() { return baseDir; }

/**
 * Script que cria o ponto de restauração. Exportado para poder entrar como
 * primeiro passo do orquestrador ELEVADO — Checkpoint-Computer exige admin,
 * então rodar antes do UAC único sempre falharia para usuário comum.
 * Sai 0 em sucesso e 1 em falha (o runner decide pelo código de saída).
 */
function buildRestorePointScript(description = 'Orion Optimizer') {
  const safeDesc = String(description).replace(/'/g, '').slice(0, 100);
  return `
$ErrorActionPreference = 'Stop'
try {
  Enable-ComputerRestore -Drive "$env:SystemDrive" -ErrorAction SilentlyContinue | Out-Null
  New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore' `
+ `-Name 'SystemRestorePointCreationFrequency' -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue | Out-Null
  Checkpoint-Computer -Description '${safeDesc}' -RestorePointType 'MODIFY_SETTINGS'
  Write-Output 'OK'
  exit 0
} catch {
  Write-Output ('FAIL:' + $_.Exception.Message)
  exit 1
}`;
}

/**
 * Cria um ponto de restauração do Windows (uso direto/elevado).
 * Retorna { ok, message } — nunca lança.
 */
async function createRestorePoint(description = 'Orion Optimizer') {
  const runner = require('./runner');
  const { stdout } = await runner.runPowerShellInline(buildRestorePointScript(description), 180000);
  const text = String(stdout || '').trim();
  if (text.includes('OK')) return { ok: true, message: 'Ponto de restauração criado.' };
  if (/FAIL:/i.test(text)) {
    // Falha comum: proteção do sistema desativada ou limite de 24h do Windows.
    const detail = text.replace(/^.*?FAIL:/i, '').slice(0, 200);
    if (/frequen|84480000|24/i.test(detail)) {
      return { ok: false, message: 'O Windows limita a criação de pontos a um por 24 horas. Um ponto recente já existe.' };
    }
    return { ok: false, message: `Não foi possível criar o ponto de restauração. ${detail}` };
  }
  return { ok: false, message: 'Não foi possível criar o ponto de restauração neste computador.' };
}

function _keyToRegPath(key) {
  // 'HKLM\\SOFTWARE\\X' -> 'HKLM\SOFTWARE\X'
  return key.replace(/\//g, '\\').trim();
}

/**
 * Exporta as chaves informadas para um arquivo .reg de backup.
 * keys: array no formato ['HKLM\\SOFTWARE\\...', 'HKCU\\Software\\...'].
 * Retorna o caminho do .reg gerado ou null se nada foi exportado.
 */
async function backupRegistryKeys(keys, opId) {
  if (!baseDir) throw new Error('Protection dir não configurado.');
  const list = (keys || []).map(_keyToRegPath).filter(Boolean);
  if (!list.length) return null;
  const dir = path.join(baseDir, opId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'backup.reg');
  let any = false;
  for (const k of list) {
    try {
      await new Promise((resolve) => {
        const { spawn } = require('child_process');
        const child = spawn('reg.exe', ['export', k, file, '/y'], { windowsHide: true });
        child.on('error', () => resolve());
        child.on('close', (code) => { if (code === 0) any = true; resolve(); });
      });
    } catch (_) { /* segue para a próxima chave */ }
  }
  return any ? file : null;
}

/** Restaura um backup .reg específico. */
async function restoreRegistryBackup(backupFile) {
  if (!backupFile || !fs.existsSync(backupFile)) {
    return { ok: false, message: 'Backup não encontrado para esta operação.' };
  }
  await new Promise((resolve) => {
    const { spawn } = require('child_process');
    const child = spawn('reg.exe', ['import', backupFile], { windowsHide: true });
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
  return { ok: true, message: 'Configurações anteriores restauradas.' };
}

module.exports = { setBaseDir, getBaseDir, createRestorePoint, buildRestorePointScript, backupRegistryKeys, restoreRegistryBackup };
