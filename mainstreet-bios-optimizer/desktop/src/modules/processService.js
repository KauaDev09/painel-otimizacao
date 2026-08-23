'use strict';

// ProcessService — gerenciador simplificado de processos com dados REAIS.
// Lista: nome, PID, fabricante, CPU (tempo), RAM, prioridade, caminho.
// Ações: encerrar e alterar prioridade — sempre protegendo processos
// críticos do sistema (nunca podem ser mortos nem repriorizados).

const runner = require('../engine/runner');

const LIST_PS = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  '$out = Get-Process | Where-Object { $_.Id -ne 0 } | ForEach-Object {',
  '  $company = $null; $path = $null',
  '  try { $path = $_.Path } catch {}',
  "  if (-not $path -and $_.MainModule) { try { $path = $_.MainModule.FileName } catch {} }",
  '  if ($path) { try { $company = ([System.Diagnostics.FileVersionInfo]::GetVersionInfo($path)).CompanyName } catch {} }',
  '  [pscustomobject]@{',
  '    id = $_.Id',
  '    name = $_.ProcessName',
  '    cpuSec = if ($_.CPU) { [math]::Round([double]$_.CPU, 1) } else { 0 }',
  '    memMB = [math]::Round($_.WorkingSet64 / 1MB, 0)',
  "    priority = [string]$_.PriorityClass",
  '    path = $path',
  '    company = $company',
  '    windowed = ($_.MainWindowHandle -ne 0)',
  '  }',
  '}',
  '$out | Sort-Object memMB -Descending | Select-Object -First 400 | ConvertTo-Json -Compress'
].join('\n');

const PRIORITY_MAP = {
  Idle: 'Baixa (idle)',
  BelowNormal: 'Abaixo do normal',
  Normal: 'Normal',
  AboveNormal: 'Acima do normal',
  High: 'Alta',
  RealTime: 'Tempo real'
};

// Processos essenciais: nunca permitir encerrar ou alterar prioridade.
const CRITICAL_RE = [
  /^system$/i, /^idle$/i, /^secure system$/i, /^registry$/i,
  /^csrss(\.\d+)?$/i, /^smss(\.\d+)?$/i, /^wininit(\.\d+)?$/i, /^winlogon(\.\d+)?$/i,
  /^services(\.\d+)?$/i, /^lsass(\.\d+)?$/i, /^svchost(\.\d+)?$/i,
  /^fontdrvhost(\.\d+)?$/i, /^dwm(\.\d+)?$/i, /^explorer$/i, /^msmpeng/i,
  /^nissrv/i, /^securityhealthservice/i
];

function isCritical(name, pid) {
  if (pid <= 4) return true;
  return CRITICAL_RE.some((re) => re.test(String(name)));
}

async function listProcesses() {
  let raw;
  try {
    const { stdout } = await runner.runPowerShellInline(LIST_PS, 30000);
    raw = JSON.parse(stdout.trim());
    if (!Array.isArray(raw)) raw = [raw];
  } catch (_) {
    return [];
  }
  return raw.map((p) => ({
    id: p.id,
    name: p.name,
    cpuSec: p.cpuSec ?? 0,
    memMB: p.memMB ?? 0,
    priority: p.priority || 'Normal',
    priorityLabel: PRIORITY_MAP[p.priority] || (p.priority || '—'),
    path: p.path || '',
    company: p.company || '',
    windowed: !!p.windowed,
    critical: isCritical(p.name, Number(p.id))
  }));
}

/** Encerra um processo com confirmação prévia na interface. */
async function killProcess(pid, name) {
  if (isCritical(name, Number(pid))) {
    throw new Error('Este é um processo crítico do Windows e não pode ser encerrado.');
  }
  const res = await runner.runPowerShellInline(
    `Stop-Process -Id ${Number(pid)} -Force -ErrorAction Stop`,
    15000
  );
  if (res.code !== 0 && res.error) throw new Error(res.error);
  return { ok: true };
}

/** Altera a prioridade de um processo (níveis seguros apenas). */
async function setPriority(pid, name, level) {
  const allowed = ['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High'];
  if (!allowed.includes(level)) {
    throw new Error('Nível de prioridade inválido.');
  }
  if (isCritical(name, Number(pid))) {
    throw new Error('Este é um processo crítico do Windows — a prioridade não pode ser alterada.');
  }
  const safeName = String(name).replace(/'/g, "''");
  const script =
    `$p = Get-Process -Id ${Number(pid)} -ErrorAction Stop; ` +
    `if ($p.ProcessName -ne '${safeName}') { throw 'Processo mudou de identidade.' }; ` +
    `$p.PriorityClass = '${level}'`;
  const res = await runner.runPowerShellInline(script, 15000);
  if (res.code !== 0 && res.error) {
    // Acesso negado em processos elevados — mensagem amigável.
    if (/acesso|access|denied/i.test(String(res.stderr || res.error))) {
      throw new Error('Acesso negado — este processo pertence ao sistema ou a outro usuário.');
    }
    throw new Error(res.error);
  }
  return { ok: true, level };
}

module.exports = { listProcesses, killProcess, setPriority };
