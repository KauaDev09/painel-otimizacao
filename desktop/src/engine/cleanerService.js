'use strict';

// CleanerService — limpeza 100% nativa (PowerShell/cmd), sem executáveis de
// terceiros. Substitui com segurança o antigo "Limpeza Completa PC.bat".

const fs = require('fs');
const path = require('path');
const runner = require('./runner');

const PS1_BOM = '\ufeff';

function wrapClean(body) {
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    'try {',
    body,
    '} catch {}',
    'exit 0'
  ].join('\r\n');
}

function wrapProbe(body) {
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    'try {',
    body,
    '  if ($null -eq $__n) { $__n = 0 }',
    '  Write-Output ([math]::Round([double]$__n, 1))',
    '} catch { Write-Output 0 }'
  ].join('\r\n');
}

function dirSizeProbe(pathExpr) {
  return wrapProbe([
    `$p = ${pathExpr}`,
    '$__n = 0',
    'if ($p -and (Test-Path -LiteralPath $p)) {',
    '  $sum = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum',
    '  if ($sum) { $__n = $sum / 1MB }',
    '}'
  ].join('\r\n'));
}

function dirClean(pathExpr) {
  return wrapClean([
    `$p = ${pathExpr}`,
    'if ($p -and (Test-Path -LiteralPath $p)) {',
    '  Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue',
    '}'
  ].join('\r\n'));
}

const TARGETS = [
  {
    id: 'temp.user',
    name: 'Arquivos temporários do usuário',
    description: '%TEMP% do perfil atual.',
    requiresAdmin: false,
    probe: dirSizeProbe('$env:TEMP'),
    // Placeholder — o script real é montado em clean() (filho adiado fora do TEMP).
    clean: wrapClean('exit 0')
  },
  {
    id: 'temp.system',
    name: 'Temporários do Windows',
    description: 'C:\\Windows\\Temp.',
    requiresAdmin: true,
    probe: dirSizeProbe("Join-Path $env:SystemRoot 'Temp'"),
    clean: dirClean("Join-Path $env:SystemRoot 'Temp'")
  },
  {
    id: 'recycle.bin',
    name: 'Lixeira',
    description: 'Esvazia a Lixeira de todas as unidades.',
    requiresAdmin: false,
    probe: wrapProbe([
      '$__n = 0',
      '$sh = New-Object -ComObject Shell.Application',
      '$rb = $sh.Namespace(10)',
      'if ($rb) {',
      '  $sum = ($rb.Items() | ForEach-Object { $_.ExtendedProperty("System.Size") } | Measure-Object -Sum).Sum',
      '  if ($sum) { $__n = $sum / 1MB }',
      '}'
    ].join('\r\n')),
    clean: wrapClean([
      'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
      'Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | ForEach-Object {',
      '  Clear-RecycleBin -DriveLetter $_.Name -Force -ErrorAction SilentlyContinue',
      '}'
    ].join('\r\n'))
  },
  {
    id: 'windowsupdate.cache',
    name: 'Cache do Windows Update',
    description: 'Downloads antigos de atualizações.',
    requiresAdmin: true,
    probe: dirSizeProbe("Join-Path $env:SystemRoot 'SoftwareDistribution\\Download'"),
    clean: wrapClean([
      'Stop-Service wuauserv -Force -ErrorAction SilentlyContinue',
      '$p = Join-Path $env:SystemRoot "SoftwareDistribution\\Download"',
      'if (Test-Path -LiteralPath $p) {',
      '  Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue',
      '}',
      'Start-Service wuauserv -ErrorAction SilentlyContinue'
    ].join('\r\n'))
  },
  {
    id: 'delivery.optimization',
    name: 'Cache de Otimização de Entrega',
    description: 'Fragmentos de atualização compartilhados.',
    requiresAdmin: true,
    probe: dirSizeProbe('"$env:SystemRoot\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache"'),
    clean: wrapClean([
      'if (Get-Command Delete-DeliveryOptimizationCache -ErrorAction SilentlyContinue) {',
      '  Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue',
      '}',
      '$p = "$env:SystemRoot\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache"',
      'if (Test-Path -LiteralPath $p) {',
      '  Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue',
      '}'
    ].join('\r\n'))
  },
  {
    id: 'dns.cache',
    name: 'Cache DNS',
    description: 'Resoluções DNS armazenadas.',
    requiresAdmin: false,
    probe: wrapProbe('$__n = 0'),
    clean: wrapClean([
      'if (Get-Command Clear-DnsClientCache -ErrorAction SilentlyContinue) {',
      '  Clear-DnsClientCache -ErrorAction SilentlyContinue',
      '}',
      'ipconfig /flushdns | Out-Null'
    ].join('\r\n'))
  },
  {
    id: 'prefetch',
    name: 'Prefetch do Windows',
    description: 'Arquivos .pf de pré-carregamento.',
    requiresAdmin: true,
    probe: wrapProbe([
      "$p = Join-Path $env:SystemRoot 'Prefetch'",
      '$__n = 0',
      'if (Test-Path -LiteralPath $p) {',
      "  $sum = (Get-ChildItem -LiteralPath $p -Filter '*.pf' -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum",
      '  if ($sum) { $__n = $sum / 1MB }',
      '}'
    ].join('\r\n')),
    clean: wrapClean([
      "$p = Join-Path $env:SystemRoot 'Prefetch'",
      "if (Test-Path -LiteralPath $p) { Remove-Item (Join-Path $p '*.pf') -Force -ErrorAction SilentlyContinue }"
    ].join('\r\n'))
  },
  {
    id: 'error.reports',
    name: 'Relatórios de erro do Windows',
    description: 'Filas do WER (LiveKernelReports/Minidump leve).',
    requiresAdmin: true,
    probe: dirSizeProbe('"$env:LOCALAPPDATA\\Microsoft\\Windows\\WER"'),
    clean: dirClean('"$env:LOCALAPPDATA\\Microsoft\\Windows\\WER"')
  }
];

function listTargets() {
  return TARGETS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    requiresAdmin: !!t.requiresAdmin
  }));
}

/**
 * Mede o tamanho (MB) de cada alvo informado. Retorna { [id]: number|null }.
 */
async function measureTargets(ids) {
  const wanted = TARGETS.filter((t) => !ids || ids.includes(t.id));
  const out = {};
  await Promise.all(wanted.map(async (t) => {
    try {
      const { stdout } = await runner.runPowerShellInline(t.probe, 60000);
      const num = parseFloat(String(stdout).trim().split(/\r?\n/).pop());
      out[t.id] = Number.isFinite(num) && num >= 0 ? num : null;
    } catch (_) {
      out[t.id] = null;
    }
  }));
  return out;
}

function cleanWorkRoot() {
  return path.join(runner.getWorkDir(), `msoclean-${Date.now()}-${process.pid}`);
}

/**
 * Limpa os alvos informados em um único lote elevado (quando necessário).
 * opts.onStep(name, ok, message)
 */
async function clean(ids, opts = {}) {
  const wanted = TARGETS.filter((t) => (ids || []).includes(t.id));
  if (!wanted.length) return { ok: false, error: 'Nenhum alvo de limpeza selecionado.', results: [] };

  // temp.user apaga %TEMP%; roda por último para não remover scripts de outros passos
  // caso o diretório de trabalho volte a cair no TEMP.
  const rank = (id) => (id === 'temp.user' ? 2 : id === 'temp.system' ? 1 : 0);
  wanted.sort((a, b) => rank(a.id) - rank(b.id));

  const tmpDir = cleanWorkRoot();
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFiles = [];

  const steps = wanted.map((t, i) => {
    const f = path.join(tmpDir, `clean-${i}.ps1`);
    let body = t.clean;
    if (t.id === 'temp.user') {
      // Filho adiado em disco estável (AppData), fora do %TEMP% e do tmpDir efêmero.
      const stableDir = path.join(runner.getWorkDir(), 'deferred');
      fs.mkdirSync(stableDir, { recursive: true });
      const deferred = path.join(stableDir, `temp-user-${Date.now()}-${process.pid}.ps1`);
      const deferredBody = [
        '$ErrorActionPreference = "SilentlyContinue"',
        'Start-Sleep -Seconds 5',
        '$root = $env:TEMP',
        'if ($root -and (Test-Path -LiteralPath $root)) {',
        '  Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue | ForEach-Object {',
        '    if ($_.Name -like "msoclean-*") { return }',
        '    if ($_.Name -like "msorepair-*") { return }',
        '    if ($_.Name -like "orion-*") { return }',
        '    try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop } catch {}',
        '  }',
        '}',
        'try { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue } catch {}',
        'exit 0'
      ].join('\r\n');
      fs.writeFileSync(deferred, PS1_BOM + deferredBody, 'utf8');
      const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      body = wrapClean([
        `$ps = '${psExe.replace(/'/g, "''")}'`,
        `$deferred = '${deferred.replace(/'/g, "''")}'`,
        'Start-Process -FilePath $ps -ArgumentList @("-NoProfile","-NonInteractive","-WindowStyle","Hidden","-ExecutionPolicy","Bypass","-File",$deferred) -WindowStyle Hidden | Out-Null'
      ].join('\r\n'));
    }
    fs.writeFileSync(f, PS1_BOM + body, 'utf8');
    tmpFiles.push(f);
    return { name: t.name, path: f };
  });

  const { results, launchError } = await runner.runSteps(steps, {
    requireAdmin: wanted.some((t) => !!t.requiresAdmin),
    onStepEnd: (name, ok, message) => { if (opts.onStep) opts.onStep(name, ok, message); }
  });

  for (const f of tmpFiles) { try { fs.rmSync(f, { force: true }); } catch (_) { /* ignora */ } }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignora */ }

  return { ok: results.every((r) => r.ok), results, launchError };
}

module.exports = { listTargets, measureTargets, clean };
