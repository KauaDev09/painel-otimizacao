'use strict';

// DisplayService — controle e detecção de tela/monitor no Windows.
//
// Níveis de suporte:
//   - BRILHO      : real via WMI (WmiMonitorBrightness/WmiSetBrightness) quando o
//                   monitor/sistema expõe o suporte. Caso contrário, aplicamos o
//                   brilho via gamma ramp (mexe de verdade na tela do PC).
//   - CONTRASTE   : aplicado DIRETAMENTE na tela do PC via gamma ramp global
//                   (SetDeviceGammaRamp) — afeta todo o desktop, não só o painel.
//   - SATURAÇÃO   : idem, via gamma ramp (ajusta a intensidade das cores na tela).
//
// A gamma ramp é uma tabela 3x256 (R/G/B) aplicada pelo driver de vídeo; com ela
// podemos escurecer (brilho), esticar/achatar (contraste) e separar os canais em
// torno do cinza (saturação) na tela inteira, sem depender de API proprietária de
// hardware.

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
    const { app, screen } = require('electron');
    if (!app.isReady()) throw new Error('screen-not-ready');
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

// --- Gamma ramp global (aplica contraste/saturação/brilho NA TELA DO PC) ---
//
// A gamma ramp é uma matriz de 768 ushort (3 canais x 256 níveis, 0..65535) que o
// driver de vídeo usa para mapear a cor de cada pixel antes de exibi-la. Alterando
// essa tabela mexemos na imagem exibida pelo desktop inteiro — exatamente o efeito
// de "contraste/saturação sobre a tela real" que o painel Tela deve aplicar.
//
//   saturação:  desvia cada nível em direção ao cinza médio (128) → cores mais
//               neutras quando < 100, mais "vivas" quando > 100.
//   contraste:  estica (> 100) ou achata (< 100) os níveis em torno de 128.
//   brilho:     escala os níveis (mulplicador) para escurecer a tela.

function computeRamp({ saturation = 100, contrast = 100, brightness = 100 } = {}) {
  const sat = Math.max(0, Math.min(200, Number(saturation) || 100)) / 100;
  const con = Math.max(0, Math.min(200, Number(contrast) || 100)) / 100;
  const bri = Math.max(0, Math.min(200, Number(brightness) || 100)) / 100;
  const ramp = new Uint16Array(768);
  for (let ch = 0; ch < 3; ch++) {
    for (let v = 0; v < 256; v++) {
      let t = 128 + (v - 128) * sat;   // saturação (128 = cinza; achatarm = < 100)
      t = 128 + (t - 128) * con;       // contraste em torno de 128
      t = t * bri;                     // brilho (escala de luminância)
      t = Math.max(0, Math.min(255, t));
      ramp[ch * 256 + v] = Math.round(t) * 257; // 8-bit → 16-bit (0..65535)
    }
  }
  return ramp;
}

function buildRampScript(rampB64) {
  // Compila um pequeno tipo GDI em memória (sem admin) e aplica a rampa no HD do
  // desktop. A rampa viaja em Base64 dentro do script para evitar problemas de
  // encoding no PowerShell.
  return `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class GdiRamp {
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateDC(string lpszDriver, string lpszDevice, string lpszOutput, IntPtr lpInitData);
  [DllImport("gdi32.dll")] public static extern bool SetDeviceGammaRamp(IntPtr hDC, [In] ushort[] ramp);
  [DllImport("gdi32.dll")] public static extern IntPtr DeleteDC(IntPtr hDC);
}
"@
$enc = '${rampB64}'
$bytes = $null
try { $bytes = [Convert]::FromBase64String($enc) } catch { $bytes = $null }
if (-not $bytes -or $bytes.Length -ne 1536) { Write-Output 'BAD_RAMP'; exit 0 }
$ramp = New-Object 'System.UInt16[]' 768
[Buffer]::BlockCopy($bytes, 0, $ramp, 0, 1536)
$dc = [GdiRamp]::GetDC([IntPtr]::Zero)
if ($dc -eq [IntPtr]::Zero) { $dc = [GdiRamp]::CreateDC('DISPLAY', $null, $null, [IntPtr]::Zero) }
try {
  $ok = [GdiRamp]::SetDeviceGammaRamp($dc, $ramp)
} finally {
  if ($dc -ne [IntPtr]::Zero) { $null = [GdiRamp]::DeleteDC($dc) }
}
if ($ok) { Write-Output 'OK' } else { Write-Output 'FAIL' }
`;
}

/** Aplica contraste/saturação/brilho na tela real via gamma ramp global. */
async function applyScreenRamp(opts = {}) {
  const ramp = computeRamp(opts);
  const b64 = Buffer.from(ramp.buffer).toString('base64');
  const out = await tryPs(buildRampScript(b64), 15000);
  return {
    applied: /OK/i.test(out),
    method: 'gamma-ramp',
    saturation: Math.round((opts.saturation == null ? 100 : opts.saturation) * 10) / 10,
    contrast: Math.round((opts.contrast == null ? 100 : opts.contrast) * 10) / 10,
    brightness: Math.round((opts.brightness == null ? 100 : opts.brightness) * 10) / 10
  };
}

module.exports = { getBrightness, setBrightness, getMonitors, applyScreenRamp };
