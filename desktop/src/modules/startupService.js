'use strict';

// StartupService — programas que iniciam com o Windows.
// Fontes REAIS: chaves Run/RunOnce (HKLM/HKCU), pastas Inicializar e
// StartupApproved (estado ativado/desativado). Impacto é ESTIMATIVA
// declarada, baseada em heurística de apps conhecidos — nunca medida.

const runner = require('../engine/runner');
const path = require('path');

const LIST_PS = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  '$rows = New-Object System.Collections.Generic.List[object]',
  "$keys = @(",
  "  @{ Root='HKCU'; Sub='Software\\Microsoft\\Windows\\CurrentVersion\\Run' },",
  "  @{ Root='HKCU'; Sub='Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' },",
  "  @{ Root='HKLM'; Sub='Software\\Microsoft\\Windows\\CurrentVersion\\Run' },",
  "  @{ Root='HKLM'; Sub='Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' },",
  "  @{ Root='HKLM'; Sub='Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' }",
  ')',
  'foreach ($kd in $keys) {',
  "  $p = $kd.Root + ':\\' + $kd.Sub",
  '  if (-not (Test-Path $p)) { continue }',
  '  $item = Get-Item $p',
  '  foreach ($name in $item.GetValueNames()) {',
  '    if (-not $name) { continue }',
  '    $rows.Add([pscustomobject]@{',
  '      name = $name',
  '      command = [string]$item.GetValue($name)',
  '      regKey = $p',
  '      kind = if ($kd.Sub -like "*RunOnce") { "runonce" } else { "run" }',
  '    })',
  '  }',
  '}',
  '# Estado ativado/desativado registrado no StartupApproved (base64 do binário)',
  "$approvedRoots = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',",
  "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\RunOnce',",
  "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run',",
  "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\RunOnce')",
  '$approved = New-Object System.Collections.Generic.List[object]',
  'foreach ($ar in $approvedRoots) {',
  '  if (-not (Test-Path $ar)) { continue }',
  '  $ai = Get-Item $ar',
  '  foreach ($n in $ai.GetValueNames()) {',
  '    $b = [byte[]]$ai.GetValue($n)',
  '    $approved.Add([pscustomobject]@{ name = $n; hex = ([BitConverter]::ToString($b)); key = $ar })',
  '  }',
  '}',
  '$dirs = @([Environment]::GetFolderPath("Startup"), [Environment]::GetFolderPath("CommonStartup")) | Where-Object { $_ }',
  'foreach ($d in $dirs) {',
  '  foreach ($f in (Get-ChildItem -LiteralPath $d -File)) {',
  '    $rows.Add([pscustomobject]@{',
  '      name = [IO.Path]::GetFileNameWithoutExtension($f.Name)',
  '      command = $f.FullName',
  "      regKey = ''",
  "      kind = 'folder'",
  '    })',
  '  }',
  '}',
  '[pscustomobject]@{ entries = $rows; approved = $approved } | ConvertTo-Json -Compress -Depth 4'
].join('\n');

// Heurística declarada de impacto (estimativa para priorização do usuário).
const KNOWN_IMPACT = {
  discord: 'Médio', steam: 'Alto', epicgames: 'Alto', 'epic games': 'Alto',
  spotify: 'Baixo', onedrive: 'Médio', teams: 'Alto', slack: 'Médio',
  chrome: 'Alto', edge: 'Alto', firefox: 'Alto', brave: 'Médio',
  adobe: 'Alto', creative: 'Alto', nvidia: 'Baixo', amd: 'Médio', radeon: 'Médio',
  realtek: 'Baixo', cortana: 'Baixo', skype: 'Médio', zoom: 'Médio',
  whatsapp: 'Baixo', telegram: 'Baixo', vlc: 'Baixo', java: 'Baixo',
  securityhealth: 'Protegido', defender: 'Protegido'
};

const PROTECTED_RE = [/security\s*health/i, /windows\s*defender/i];

function estimateImpact(name) {
  const n = String(name).toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_IMPACT)) {
    if (n.includes(k)) return v;
  }
  return 'Desconhecido';
}

function isProtected(name) {
  return PROTECTED_RE.some((re) => re.test(String(name)));
}

function extractExeDir(command) {
  const c = String(command || '').trim();
  if (!c) return '';
  const quoted = c.match(/^"([^"]+)"/);
  const exe = quoted ? quoted[1] : c.split(/\s+/)[0];
  try { return path.dirname(exe); } catch (_) { return ''; }
}

async function listStartup() {
  let data;
  try {
    const { stdout } = await runner.runPowerShellInline(LIST_PS, 30000);
    data = JSON.parse(stdout.trim());
  } catch (_) {
    return [];
  }
  // Mapa de estado: chave "regKey|nome" -> habilitado?
  const approvedMap = new Map();
  for (const a of data.approved || []) {
    const firstByte = parseInt(String(a.hex).split('-')[0], 16);
    if (Number.isNaN(firstByte)) continue;
    approvedMap.set(`${String(a.key)}|${a.name}`, firstByte % 2 === 0);
  }
  return (data.entries || []).map((r, i) => {
    let enabled = true;
    let source = 'Pasta Inicializar';
    let scope = 'Usuário';
    if (r.kind !== 'folder') {
      const isHklm = String(r.regKey).startsWith('HKLM');
      const isOnce = r.kind === 'runonce';
      const approvedKey =
        `${isHklm ? 'HKLM' : 'HKCU'}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\` +
        `${isOnce ? 'RunOnce' : 'Run'}`;
      const st = approvedMap.get(`${approvedKey}|${r.name}`);
      enabled = st !== undefined ? st : true;
      source = `Registro (${isHklm ? 'HKLM' : 'HKCU'}${isOnce ? ' · RunOnce' : ''})`;
      scope = isHklm ? 'Todos os usuários' : 'Usuário atual';
    }
    return {
      id: `su-${i}`,
      name: r.name,
      command: r.command,
      regKey: r.regKey,
      kind: r.kind,
      source,
      scope,
      enabled,
      impact: estimateImpact(r.name),
      protected: isProtected(r.name),
      location: extractExeDir(r.command)
    };
  });
}

/**
 * Ativa/desativa uma entrada via StartupApproved (reversível, sem apagar nada).
 * Entradas protegidas (segurança do Windows) e atalhos de pasta são recusados.
 */
async function setEnabled(entry, enable) {
  if (!entry || !entry.name) throw new Error('Entrada inválida.');
  if (isProtected(entry.name)) {
    throw new Error('Este item é essencial para a segurança do Windows e não pode ser desativado.');
  }
  if (entry.kind === 'folder') {
    throw new Error('Atalhos na pasta Inicializar não possuem estado "desativado". Remova o atalho manualmente se desejar.');
  }

  const isHklm = String(entry.regKey).startsWith('HKLM');
  const isOnce = entry.kind === 'runonce';
  const root = isHklm ? 'HKLM' : 'HKCU';
  const target =
    `${root}:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${isOnce ? 'RunOnce' : 'Run'}`;
  const safeName = String(entry.name).replace(/'/g, "''");

  // Desativado = primeiro byte ímpar (0x03); Ativado = remove a entrada (padrão do Windows).
  const script = enable
    ? `Remove-ItemProperty -LiteralPath '${target}' -Name '${safeName}' -ErrorAction Stop`
    : `$k='${target}'; if (-not (Test-Path $k)) { New-Item -Path $k -Force -ErrorAction Stop | Out-Null }; ` +
      `Set-ItemProperty -LiteralPath $k -Name '${safeName}' -Value ([byte[]](3,0,0,0,0,0,0,0,0,0,0,0)) -Type Binary -ErrorAction Stop`;

  const res = await runner.runPowerShellInline(script, 20000);
  // runner.close() zera res.error: o código de saída é a única fonte confiável.
  if (res.code !== 0) {
    const detail = String(res.stderr || '').trim();
    if (/acesso|access|denied/i.test(detail)) {
      throw new Error('Acesso negado — entradas de todos os usuários exigem executar como administrador.');
    }
    throw new Error('Não foi possível alterar a entrada. ' + detail);
  }
  return { ok: true, enabled: enable };
}

module.exports = { listStartup, setEnabled };
