'use strict';

// AuditService — log centralizado de auditoria local.
// Registra com timestamp ISO completo as ações que alteram o sistema
// (otimizações, limpezas, reparos, BIOS, processos, atualizações), com
// módulo, ação, status e detalhe compacto. Arquivo: <userData>/audit.log.
// Auditoria nunca derruba o app: falhas de escrita são silenciosas.

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024; // 1 MB → rotaciona para audit.log.old

let filePath = null;

function ensureFile() {
  if (filePath) return;
  let dir = null;
  try {
    const { app } = require('electron');
    dir = app.getPath('userData');
  } catch (_) {
    dir = null;
  }
  if (!dir) dir = process.env.LOCALAPPDATA || process.env.APPDATA || __dirname;
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* best effort */ }
  filePath = path.join(dir, 'audit.log');
}

function compact(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v);
      return s && s.length <= 500 ? s : String(s).slice(0, 500);
    } catch (_) { return '[objeto]'; }
  }
  const s = String(v);
  return s.length <= 500 ? s : s.slice(0, 500);
}

function rotateIfNeeded() {
  try {
    const size = fs.statSync(filePath).size;
    if (size > MAX_BYTES) {
      try { fs.rmSync(filePath + '.old', { force: true }); } catch (_) { /* ignora */ }
      fs.renameSync(filePath, filePath + '.old');
    }
  } catch (_) { /* arquivo ainda não existe */ }
}

/** Registra um evento: record('engine', 'apply', 'ok', { ids, label }). */
function record(module, action, status, detail) {
  try {
    ensureFile();
    rotateIfNeeded();
    const line = [
      new Date().toISOString(),
      compact(module),
      compact(action),
      compact(status),
      compact(detail)
    ].join('\t');
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch (_) { /* silencioso */ }
}

/** Envolve um handler IPC: grava sucesso/erro sem alterar o fluxo. */
function wrap(channel, moduleName, actionName, fn, summarize) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      record(moduleName, actionName, 'ok', summarize ? summarize(result, ...args) : result);
      return result;
    } catch (err) {
      record(moduleName, actionName, 'error', { message: String(err && err.message || err || 'erro desconhecido').slice(0, 300) });
      throw err;
    }
  };
}

module.exports = { record, wrap };