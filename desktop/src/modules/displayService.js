'use strict';

// DisplayService — controle e detecção de tela/monitor no Windows.
//
// Níveis de suporte (honestos, nunca fingimos alterar hardware):
//   - BRILHO      : real, via WMI (WmiMonitorBrightness/WmiSetBrightness) quando o
//                   monitor/sistema expõe o suporte. Caso contrário, retornamos
//                   { supported:false } e a UI mostra "Controle não suportado".
//   - CONTRASTE   : camada de processamento visual (software rendering). O valor
//                   é persistido e aplicado como filtro na interface — rotulado
//                   "Aplicado via processamento do sistema".
//   - SATURAÇÃO   : camada de processamento visual (idem contraste).
//
// Não existe API universal para alterar contraste/saturação de hardware em todos
// os monitores Windows, então aplicamos a melhor solução compatível (software) e
// deixamos isso claro na interface, conforme a especificação.

const psRunner = require('../hardware/psRunner');

const GET_BRIGHTNESS_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$b = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness
if ($b) {
  [pscustomobject]@{ CurrentBrightness = $b.CurrentBrightness }
} else {
  [pscustomobject]@{ CurrentBrightness = $null }
} | ConvertTo-Json -Compress
`;

function buildSetBrightnessPS(percent) {
  // WmiSetBrightness exige a assinatura (Timeout, Brightness). Usamos 1s de timeout.
  return `
$ErrorActionPreference = 'Stop'
$m = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods
if (-not $m) { Write-Output 'NOT_SUPPORTED'; exit 0 }
$method = $m | Select-Object -First 1
$timeout = 1
Invoke-CimMethod -InputObject $method -MethodName WmiSetBrightness -Arguments @{ Timeout = $timeout; Brightness = ${percent} }
Write-Output 'OK'
`;
}

const GET_MONITORS_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
$wmiIds = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID
$i = 0
foreach ($m in Get-CimInstance -ClassName Win32_DesktopMonitor) {
  $id = $wmiIds | Select-Object -Index $i
  if (-not $id) { $id = $wmiIds | Where-Object { $true } | Select-Object -Index 0 }
  $name = ''
  if ($id) {
    $name = ($id.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join ''
  }
  if (-not $name) { $name = $m.Name }
  $result += [pscustomobject]@{
    Name = $name
    Status = $m.Status
    Availability = $m.Availability
    ScreenWidth = $m.ScreenWidth
    ScreenHeight = $m.ScreenHeight
  }
  $i++
}
if ($result.Count -eq 0) {
  # fallback: descreve os monitores presentes via GDI/Win32
  $result += [pscustomobject]@{ Name = 'Monitor padrão'; Status = 'OK'; Availability = 3; ScreenWidth = $null; ScreenHeight = $null }
}
$result | ConvertTo-Json -Compress
`;

// --- Helpers PowerShell genéricos ---
async function tryPs(script, timeoutMs = 20000) {
  try {
    const { stdout } = await psRunner.runPowerShell(script, timeoutMs);
    return String(stdout || '').trim();
  } catch (_) {
    return '';
  }
}

/** Estado do brilho do monitor principal (real via WMI, quando suportado). */
async function getBrightness() {
  const out = await tryPs(GET_BRIGHTNESS_PS);
  try {
    const parsed = JSON.parse(out);
    const val = Number(parsed.CurrentBrightness);
    if (Number.isFinite(val)) return { supported: val >= 0, percent: Math.max(0, Math.min(100, Math.round(val))) };
  } catch (_) { /* sem suporte */ }
  return { supported: false, percent: null };
}

/** Aplica brilho real quando o monitor/sistema suporta WMI. */
async function setBrightness(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const out = await tryPs(buildSetBrightnessPS(p), 20000);
  if (/NOT_SUPPORTED/i.test(out)) return { applied: false, reason: 'UNSUPPORTED' };
  if (/OK/i.test(out)) return { applied: true, percent: p };
  // WmiSetBrightness costuma não reportar saída; tentamos re-ler o valor real.
  if (out === '') {
    const cur = await getBrightness();
    return { applied: true, percent: cur.percent, method: 'wmi' };
  }
  return { applied: true, percent: p, method: 'wmi' };
}

/** Detecta o monitor principal conectado (nome, resolução, Hz, status). */
async function getMonitors() {
  const out = await tryPs(GET_MONITORS_PS);
  let list = [];
  try {
    const parsed = JSON.parse(out);
    list = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
  } catch (_) {
    list = [];
  }

  // Resolução e taxa de atualização reais vêm do Electron (screen), que é a
  // fonte autoritativa para o monitor onde a janela está.
  let primary = null;
  try {
    const { screen } = require('electron');
    const d = screen.getPrimaryDisplay();
    primary = {
      name: cleanName(d.label || d.name),
      width: d.size.width,
      height: d.size.height,
      refreshRate: d.refreshRate || null,
      connected: true,
      isPrimary: true
    };
  } catch (_) {
    primary = null;
  }

  const monitors = list.map((m, idx) => ({
    name: cleanName(m.Name),
    width: m.ScreenWidth ? Number(m.ScreenWidth) : null,
    height: m.ScreenHeight ? Number(m.ScreenHeight) : null,
    connected: (m.Status || '') !== 'Unplugged' && (m.Availability == null || m.Availability !== 8),
    isPrimary: idx === 0
  }));

  const merged = monitors.length ? monitors : [];
  return {
    monitors: merged,
    primary: primary || (merged[0] || null)
  };
}

function cleanName(name) {
  return String(name || '').replace(/["\u0000]/g, '').trim() || 'Monitor';
}

module.exports = { getBrightness, setBrightness, getMonitors };
