'use strict';

// EngineService — camada de alto nível sobre catálogo + runner + proteção.
//   - A interface NUNCA envia comandos: envia apenas IDs de itens do catálogo.
//   - Toda aplicação passa por: backup das chaves -> (opcional) ponto de
//     restauração -> orquestrador com UAC único -> registro da operação.
//   - Desfazer usa a ação de undo do próprio item (script, PowerShell inline
//     ou restauração do backup .reg capturado antes da aplicação).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const catalog = require('./catalog');
const runner = require('./runner');
const protection = require('./restorePoint');

const PROFILES = {
  safe: { name: 'Seguro', icon: 'security', description: 'Só ajustes de baixo risco, totalmente reversíveis.' },
  balanced: { name: 'Equilibrado', icon: 'scale', description: 'Melhor custo-benefício para uso diário.' },
  performance: { name: 'Desempenho', icon: 'boost', description: 'Máxima responsividade do sistema.' },
  gaming: { name: 'Gamer', icon: 'gaming', description: 'Foco em FPS e latência em jogos.' },
  work: { name: 'Trabalho', icon: 'briefcase', description: 'Estabilidade para produtividade; sem mudanças agressivas.' },
  laptop: { name: 'Notebook', icon: 'power', description: 'Equilíbrio entre desempenho e bateria.' }
};

let stateDir = null;
let operationsFile = null;

// PowerShell 5.1 lê arquivos .ps1 SEM BOM como ANSI (acentos quebram).
const PS1_BOM = '\ufeff';

function setStateDir(dir) {
  stateDir = dir;
  fs.mkdirSync(dir, { recursive: true });
  operationsFile = path.join(dir, 'operations.json');
}

function _loadOperations() {
  try {
    return JSON.parse(fs.readFileSync(operationsFile, 'utf8'));
  } catch (_) {
    return [];
  }
}

function _saveOperations(ops) {
  // Mantém no máximo 100 operações no histórico local.
  fs.writeFileSync(operationsFile, JSON.stringify(ops.slice(-100), null, 2), 'utf8');
}

function _appliedFile() {
  return path.join(stateDir, 'applied.json');
}

function _loadApplied() {
  if (!stateDir) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(_appliedFile(), 'utf8'))); } catch (_) { return new Set(); }
}

function _saveApplied(set) {
  if (!stateDir) return;
  fs.writeFileSync(_appliedFile(), JSON.stringify([...set]), 'utf8');
}

function markItemsApplied(ids) {
  const set = _loadApplied();
  (ids || []).forEach((id) => set.add(id));
  _saveApplied(set);
}

function markItemsUndone(ids) {
  const set = _loadApplied();
  (ids || []).forEach((id) => set.delete(id));
  _saveApplied(set);
}

function applyHint(it) {
  if (Array.isArray(it.registryKeys) && it.registryKeys.length) {
    return it.registryKeys.join('\n');
  }
  if (it.apply && it.apply.type === 'script' && it.apply.file) {
    return it.apply.file;
  }
  return '';
}

/** Lista itens sanitizados para a interface. */
function listItems() {
  const applied = _loadApplied();
  return catalog.ITEMS.map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    description: it.description,
    benefit: it.benefit,
    risk: it.risk,
    riskLabel: catalog.RISK_LABELS[it.risk] || it.risk,
    requiresAdmin: !!it.requiresAdmin,
    confirm: !!it.confirm,
    profiles: it.profiles || [],
    proOnly: it.proOnly !== false,
    vendor: it.vendor || null,
    rebootRequired: !!it.rebootRequired,
    icon: it.icon || catalog.CATEGORY_ICONS[it.category] || 'system',
    registryKeys: it.registryKeys || [],
    applyHint: applyHint(it),
    applied: applied.has(it.id)
  }));
}

function getProfiles() {
  return Object.entries(PROFILES).map(([id, p]) => ({
    id,
    ...p,
    count: catalog.ITEMS.filter((i) => (i.profiles || []).includes(id)).length
  }));
}

function getDrivers() {
  return catalog.DRIVER_DOWNLOAD_ITEMS.map((d) => {
    const item = { id: d.id, vendor: d.vendor };
    return item;
  });
}

/**
 * Aplica um conjunto de itens por ID.
 * opts: { label, createRestorePoint:boolean, onStep(name, ok, message) }
 * Retorna { ok, results, opId, launchError, restorePoint }.
 */
async function applyItems(ids, opts = {}) {
  if (!stateDir) throw new Error('Engine não inicializado.');
  const items = [];
  const seen = new Set();
  for (const id of ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    let it = catalog.getItem(String(id));
    if (!it) {
      // Itens de download de driver vivem fora do ITEMS principal.
      const drv = catalog.DRIVER_DOWNLOAD_ITEMS.find((d) => d.id === String(id));
      if (drv) {
        const vendorName = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel' }[drv.vendor] || drv.vendor;
        it = {
          id: drv.id,
          name: `${vendorName}: abrir página oficial de drivers`,
          apply: { type: 'script', file: drv.file }
        };
      }
    }
    if (!it || !it.apply) continue;
    items.push(it);
  }
  if (!items.length) {
    return { ok: false, error: 'Nenhuma otimização válida selecionada.', results: [], opId: null };
  }

  const opId = `op-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const opDir = path.join(stateDir, opId);
  fs.mkdirSync(opDir, { recursive: true });

  // 1) Backup das chaves de registro que cada item declara tocar.
  const records = [];
  for (const it of items) {
    let backupReg = null;
    if (Array.isArray(it.registryKeys) && it.registryKeys.length) {
      try { backupReg = await protection.backupRegistryKeys(it.registryKeys, opId); } catch (_) { backupReg = null; }
    }
    records.push({ id: it.id, name: it.name, backupReg });
  }

  // 2) Ponto de restauração do Windows (opcional). Checkpoint-Computer exige
  //    administrador: entra como PRIMEIRO passo do orquestrador elevado,
  //    dentro do mesmo UAC único — nunca antes dele.
  const tmpFiles = [];
  let restorePointIdx = -1;
  if (opts.createRestorePoint) {
    const rpFile = path.join(opDir, 'restore-point.ps1');
    fs.writeFileSync(rpFile, PS1_BOM + protection.buildRestorePointScript('Orion Optimizer - ' + (opts.label || 'otimizações')), 'utf8');
    tmpFiles.push(rpFile);
    restorePointIdx = 0;
  }

  // 3) Monta os passos: scripts do catálogo + PS inline viram arquivos .ps1
  //    temporários para entrarem no MESMO orquestrador (UAC único).
  const steps = [];
  items.forEach((it, idx) => {
    const act = it.apply;
    if (act.type === 'script') {
      steps.push({ name: it.name, path: catalog.resolveScript(act.file) });
    } else if (act.type === 'ps') {
      const psFile = path.join(opDir, `apply-${idx}.ps1`);
      fs.writeFileSync(psFile, PS1_BOM + act.script, 'utf8');
      tmpFiles.push(psFile);
      steps.push({ name: it.name, path: psFile });
    }
  });
  if (restorePointIdx === 0) {
    steps.unshift({ name: 'Ponto de restauração do Windows', path: tmpFiles[0] });
  }

  const { results, logText, launchError } = await runner.runSteps(steps, {
    onStepEnd: (name, ok, message) => { if (opts.onStep) opts.onStep(name, ok, message); }
  });

  // Limpa .ps1 temporários (o conteúdo já está no catálogo).
  for (const f of tmpFiles) { try { fs.rmSync(f, { force: true }); } catch (_) { /* ignora */ } }

  // Resultado do ponto de restauração (fora da contagem das otimizações).
  let restorePoint = null;
  let itemResults = results;
  if (restorePointIdx >= 0 && results.length > restorePointIdx && steps[0].name.startsWith('Ponto de restauração')) {
    const rpRes = results[restorePointIdx];
    restorePoint = {
      ok: !!rpRes.ok,
      message: rpRes.ok
        ? 'Ponto de restauração criado.'
        : 'Não foi possível criar o ponto de restauração (Proteção do Sistema pode estar desativada ou há um ponto recente nas últimas 24 h). As otimizações seguiram normalmente.'
    };
    itemResults = results.filter((_, i) => i !== restorePointIdx);
  }

  // 4) Registra a operação para a Central de Restauração.
  const ops = _loadOperations();
  ops.push({
    id: opId,
    ts: Date.now(),
    label: opts.label || `${items.length} otimização(ões)`,
    profile: opts.profile || null,
    items: records,
    results: itemResults
  });
  _saveOperations(ops);

  const okIds = items.filter((_, i) => itemResults[i] && itemResults[i].ok).map((it) => it.id);
  markItemsApplied(okIds);

  const allOk = itemResults.length > 0 && itemResults.every((r) => r.ok);
  return { ok: allOk, results: itemResults, opId, launchError, restorePoint };
}

/**
 * Desfaz um item específico pelo ID (procura o backup mais recente).
 */
async function undoItem(id) {
  const it = catalog.getItem(String(id));
  if (!it || !it.undo) {
    return { ok: false, message: 'Este item não possui ação de desfazer automática.' };
  }
  const act = it.undo;
  const done = (res) => {
    if (res && res.ok) markItemsUndone([it.id]);
    return res;
  };

  if (act.type === 'backup') {
    // Restaura o .reg mais recente que contém este item.
    const ops = _loadOperations();
    for (let i = ops.length - 1; i >= 0; i--) {
      const rec = (ops[i].items || []).find((x) => x.id === it.id);
      if (rec && rec.backupReg && fs.existsSync(rec.backupReg)) {
        const r = await protection.restoreRegistryBackup(rec.backupReg);
        return done(r);
      }
    }
    return { ok: false, message: 'Nenhum backup encontrado para este item.' };
  }

  if (act.type === 'ps') {
    const tmp = path.join(stateDir, `undo-${Date.now()}.ps1`);
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(tmp, PS1_BOM + act.script, 'utf8');
    try {
      const { result } = await runner.runSingle(`Desfazer: ${it.name}`, tmp);
      return done({ ok: !!result.ok, message: result.message });
    } finally {
      try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignora */ }
    }
  }

  if (act.type === 'script') {
    const { result } = await runner.runSingle(`Desfazer: ${it.name}`, catalog.resolveScript(act.file));
    return done({ ok: !!result.ok, message: result.message });
  }

  return { ok: false, message: 'Ação de desfazer desconhecida.' };
}

/** Histórico local de operações (mais recente primeiro). */
function listOperations() {
  return _loadOperations().slice().reverse().map((op) => ({
    id: op.id,
    ts: op.ts,
    label: op.label,
    profile: op.profile,
    itemCount: (op.items || []).length,
    successCount: (op.results || []).filter((r) => r.ok).length
  }));
}

/** Detalhe de uma operação (itens, backups disponíveis, resultados). */
function getOperation(opId) {
  const op = _loadOperations().find((o) => o.id === String(opId));
  if (!op) return null;
  return {
    ...op,
    items: (op.items || []).map((r) => ({
      id: r.id,
      name: r.name,
      hasBackup: !!(r.backupReg && fs.existsSync(r.backupReg))
    }))
  };
}

/** Desfaz todos os itens reversíveis de uma operação (ordem inversa). */
async function undoOperation(opId, opts = {}) {
  const op = _loadOperations().find((o) => o.id === String(opId));
  if (!op) return { ok: false, error: 'Operação não encontrada.', results: [] };

  const ids = (op.items || []).slice().reverse()
    .filter((r) => r.backupReg || (catalog.getItem(r.id) || {}).undo)
    .map((r) => r.id);

  // Executa undos um a um (cada um pode ter mecanismo distinto).
  const results = [];
  for (const id of ids) {
    const r = await undoItem(id);
    results.push({ id, ...r });
    if (opts.onStep) opts.onStep(id, r.ok, r.message);
  }
  return { ok: results.every((r) => r.ok), results };
}

module.exports = {
  setStateDir,
  listItems,
  getProfiles,
  getDrivers,
  applyItems,
  undoItem,
  undoOperation,
  listOperations,
  getOperation,
  PROFILES
};
