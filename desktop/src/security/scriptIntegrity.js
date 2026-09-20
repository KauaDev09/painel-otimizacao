'use strict';

// Integridade de scripts (SHA-256) em runtime.
//
// O manifest (src/security/script-manifest.json) é gerado em build/ antes de
// cada release por scripts/hash-scripts.js e contém o SHA-256 de cada script
// estático que o app executa (coletores PowerShell + scripts do motor).
//
// Antes de executar um desses arquivos, confere-se o hash com o manifest.
// Divergência (ex.: scripts espelhados em %APPDATA% editados fora do app)
// recusa a execução — proteção contra adulteração da cadeia de comandos.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, 'script-manifest.json');
let manifest = null;
let warned = false;

function loadManifest() {
  if (manifest !== null) return manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).files || {};
  } catch (_) {
    manifest = {}; // sem manifest (dev antes do build): cache vazio
  }
  return manifest;
}

function normalizeKey(key) {
  return String(key || '').replace(/\\/g, '/');
}

function sha256Of(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function manifestPresent() {
  return Object.keys(loadManifest()).length > 0;
}

function warnOnceDev() {
  if (!warned) {
    warned = true;
    console.warn('[scriptIntegrity] Manifest de scripts não encontrado — verificação pulada neste build/dev.');
  }
}

/**
 * Verifica o hash de um arquivo. `key` é a chave do manifest
 * (caminho relativo a desktop/src, ex.: 'engine/scripts/windows/...bat').
 * Sem manifest (dev antes do build) → permite com um único aviso.
 */
function verifyFile(key, filePath) {
  if (!manifestPresent()) {
    warnOnceDev();
    return true;
  }
  const expected = loadManifest()[normalizeKey(key)];
  if (!expected) return true; // arquivo fora do manifesto (ex.: script temporário gerado) — não coberto
  let actual;
  try {
    actual = sha256Of(fs.readFileSync(filePath));
  } catch (_) {
    return false;
  }
  return actual === expected;
}

/** Verifica conteúdo em memória (útil quando o script é lido e executado via EncodedCommand). */
function verifyContent(key, content) {
  if (!manifestPresent()) {
    warnOnceDev();
    return true;
  }
  const expected = loadManifest()[normalizeKey(key)];
  if (!expected) return true;
  return sha256Of(content) === expected;
}

/** Como verifyFile, mas lança Error em caso de divergência. */
function assertFile(key, filePath) {
  if (!verifyFile(key, filePath)) {
    const e = new Error('Integridade do script verificada com falha (SHA-256). Execução recusada.');
    e.code = 'SCRIPT_INTEGRITY';
    throw e;
  }
}

/** Como verifyContent, mas lança Error em caso de divergência. */
function assertContent(key, content) {
  if (!verifyContent(key, content)) {
    const e = new Error('Integridade do script verificada com falha (SHA-256). Execução recusada.');
    e.code = 'SCRIPT_INTEGRITY';
    throw e;
  }
}

module.exports = { assertFile, assertContent, verifyFile, verifyContent, sha256Of };