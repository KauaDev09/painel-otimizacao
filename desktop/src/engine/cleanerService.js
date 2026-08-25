'use strict';

// CleanerService — limpeza 100% nativa (PowerShell/cmd), sem executáveis de
// terceiros. Substitui com segurança o antigo "Limpeza Completa PC.bat".

const runner = require('./runner');

const TARGETS = [
  {
    id: 'temp.user',
    name: 'Arquivos temporários do usuário',
    description: '%TEMP% do perfil atual.',
    requiresAdmin: false,
    probe: `$p = $env:TEMP; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Get-ChildItem $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue`
  },
  {
    id: 'temp.system',
    name: 'Temporários do Windows',
    description: 'C:\\Windows\\Temp.',
    requiresAdmin: true,
    probe: `$p = Join-Path $env:SystemRoot 'Temp'; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Get-ChildItem (Join-Path $env:SystemRoot 'Temp') -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue`
  },
  {
    id: 'recycle.bin',
    name: 'Lixeira',
    description: 'Esvazia a Lixeira de todas as unidades.',
    requiresAdmin: false,
    probe: `$sh = New-Object -ComObject Shell.Application; $rb = $sh.Namespace(10); if ($rb) { [math]::Round((($rb.Items() | ForEach-Object { $_.ExtendedProperty('System.Size') } | Measure-Object -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Clear-RecycleBin -Force -ErrorAction SilentlyContinue`
  },
  {
    id: 'windowsupdate.cache',
    name: 'Cache do Windows Update',
    description: 'Downloads antigos de atualizações.',
    requiresAdmin: true,
    probe: `$p = Join-Path $env:SystemRoot 'SoftwareDistribution\\Download'; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Stop-Service wuauserv -Force -ErrorAction SilentlyContinue; Get-ChildItem (Join-Path $env:SystemRoot 'SoftwareDistribution\\Download') -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; Start-Service wuauserv -ErrorAction SilentlyContinue`
  },
  {
    id: 'delivery.optimization',
    name: 'Cache de Otimização de Entrega',
    description: 'Fragmentos de atualização compartilhados.',
    requiresAdmin: true,
    probe: `$p = "$env:SystemRoot\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache"; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue`
  },
  {
    id: 'dns.cache',
    name: 'Cache DNS',
    description: 'Resoluções DNS armazenadas.',
    requiresAdmin: false,
    probe: `'0'`,
    clean: `Clear-DnsClientCache -ErrorAction SilentlyContinue`
  },
  {
    id: 'prefetch',
    name: 'Prefetch do Windows',
    description: 'Arquivos .pf de pré-carregamento.',
    requiresAdmin: true,
    probe: `$p = Join-Path $env:SystemRoot 'Prefetch'; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Filter '*.pf' -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Remove-Item (Join-Path $env:SystemRoot 'Prefetch\\*.pf') -Force -ErrorAction SilentlyContinue`
  },
  {
    id: 'error.reports',
    name: 'Relatórios de erro do Windows',
    description: 'Filas do WER (LiveKernelReports/Minidump leve).',
    requiresAdmin: true,
    probe: `$p = "$env:LOCALAPPDATA\\Microsoft\\Windows\\WER"; if (Test-Path $p) { [math]::Round(((Get-ChildItem $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum)/1MB,1) } else { '0' }`,
    clean: `Get-ChildItem "$env:LOCALAPPDATA\\Microsoft\\Windows\\WER" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue`
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
      const num = parseFloat(String(stdout).trim());
      out[t.id] = Number.isFinite(num) && num >= 0 ? num : null;
    } catch (_) {
      out[t.id] = null;
    }
  }));
  return out;
}

/**
 * Limpa os alvos informados em um único lote elevado (quando necessário).
 * opts.onStep(name, ok, message)
 */
async function clean(ids, opts = {}) {
  const wanted = TARGETS.filter((t) => (ids || []).includes(t.id));
  if (!wanted.length) return { ok: false, error: 'Nenhum alvo de limpeza selecionado.', results: [] };

  const fs = require('fs');
  const path = require('path');
  const tmpFiles = [];
  const stateDir = path.join(require('path').dirname(require.main ? require.main.filename : __dirname), '..', '..', 'state');
  const tmpDir = path.join(process.env.TEMP || process.env.TMP || stateDir, `msoclean-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const steps = wanted.map((t, i) => {
    const f = path.join(tmpDir, `clean-${i}.ps1`);
    fs.writeFileSync(f, '\ufeff' + t.clean, 'utf8');
    tmpFiles.push(f);
    return { name: t.name, path: f };
  });

  const { results, launchError } = await runner.runSteps(steps, {
    onStepEnd: (name, ok, message) => { if (opts.onStep) opts.onStep(name, ok, message); }
  });

  for (const f of tmpFiles) { try { fs.rmSync(f, { force: true }); } catch (_) { /* ignora */ } }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignora */ }

  return { ok: results.every((r) => r.ok), results, launchError };
}

module.exports = { listTargets, measureTargets, clean };
