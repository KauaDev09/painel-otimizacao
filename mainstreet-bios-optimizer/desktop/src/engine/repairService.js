'use strict';

// RepairService — reparos do sistema (SFC/DISM) com execução em lote e UAC
// único. Substitui o antigo "Arrumar Windows.bat" por opções granulares.

const path = require('path');
const runner = require('./runner');
const catalog = require('./catalog');

const OPTIONS = [
  {
    id: 'repair.sfc',
    name: 'Verificar arquivos do sistema (SFC)',
    description: 'Analisa e repara arquivos corrompidos do Windows (SFC /scannow).',
    requiresAdmin: true,
    timeoutMin: 30,
    steps: ['sfc /scannow']
  },
  {
    id: 'repair.dism.health',
    name: 'Verificar saúde da imagem (DISM)',
    description: 'Checa a integridade da imagem do componente do Windows (CheckHealth + ScanHealth).',
    requiresAdmin: true,
    timeoutMin: 30,
    steps: ['DISM /Online /Cleanup-Image /CheckHealth', 'DISM /Online /Cleanup-Image /ScanHealth']
  },
  {
    id: 'repair.dism.restore',
    name: 'Restaurar imagem do sistema (DISM)',
    description: 'Repara a imagem do Windows usando o Windows Update como fonte (RestoreHealth). Execute primeiro "Verificar saúde".',
    requiresAdmin: true,
    timeoutMin: 45,
    steps: ['DISM /Online /Cleanup-Image /RestoreHealth']
  },
  {
    id: 'repair.complete',
    name: 'Reparo completo',
    description: 'Executa DISM RestoreHealth seguido de SFC — o combo recomendado quando algo está instável.',
    requiresAdmin: true,
    timeoutMin: 60,
    steps: ['DISM /Online /Cleanup-Image /RestoreHealth', 'sfc /scannow']
  }
];

function listOptions() {
  return OPTIONS.map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    requiresAdmin: !!o.requiresAdmin,
    estimatedMinutes: Math.round(o.timeoutMin * 0.6)
  }));
}

/**
 * Executa um reparo. Cada comando vira um passo .cmd no orquestrador único.
 * opts.onStep(name, ok, message)
 */
async function runRepair(optionId, opts = {}) {
  const opt = OPTIONS.find((o) => o.id === String(optionId));
  if (!opt) return { ok: false, error: 'Opção de reparo inválida.', results: [] };

  const fs = require('fs');
  const tmpDir = path.join(process.env.TEMP || process.env.TMP || __dirname, `msorepair-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpFiles = [];
  const steps = opt.steps.map((cmd, i) => {
    const f = path.join(tmpDir, `repair-${i}.cmd`);
    fs.writeFileSync(f, `@echo off\r\n${cmd}\r\nexit /b %errorlevel%\r\n`, 'utf8');
    tmpFiles.push(f);
    return { name: `${opt.name} — etapa ${i + 1}/${opt.steps.length}`, path: f };
  });

  const { results, launchError } = await runner.runSteps(steps, {
    onStepEnd: (name, ok, message) => { if (opts.onStep) opts.onStep(name, ok, message); }
  });

  for (const f of tmpFiles) { try { fs.rmSync(f, { force: true }); } catch (_) { /* ignora */ } }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignora */ }

  return { ok: results.length > 0 && results.every((r) => r.ok), results, launchError };
}

/** Abre o script legado "Arrumar Windows.bat" via catálogo (fallback rápido). */
async function runQuickFix(opts = {}) {
  const item = catalog.getItem('repair.quickfix') || null;
  // O script legado é exposto como item implícito; resolve direto pelo arquivo.
  const file = catalog.resolveScript('maintenance/Arrumar Windows.bat');
  const { result } = await runner.runSingle('Correção rápida do Windows', file, {
    onStepEnd: (name, ok, message) => { if (opts.onStep) opts.onStep(name, ok, message); }
  });
  return { ok: !!result.ok, result, legacyItem: !!item };
}

module.exports = { listOptions, runRepair, runQuickFix };
