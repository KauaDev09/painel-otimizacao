'use strict';

// MonitorService — monitoramento em tempo real com dados REAIS do Windows.
// Snapshot PowerShell (CIM/WMI) em paralelo com nvidia-smi.
// Temperatura ACPI costuma exigir elevação; sem isso usamos GPU (NVIDIA) ou
// LibreHardwareMonitor se estiver instalado. Null só quando o hardware não expõe.

const fs = require('fs');
const runner = require('../engine/runner');
const { spawn } = require('child_process');
const { findNvidiaSmi } = require('../hardware/gpuService');

const SNAPSHOT_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$out = [ordered]@{}

$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$out.cpu = if ($null -ne $cpu) { [math]::Round([double]$cpu, 0) } else { $null }

$os = Get-CimInstance Win32_OperatingSystem
if ($os) {
  $totalKB = [double]$os.TotalVisibleMemorySize
  $freeKB = [double]$os.FreePhysicalMemory
  $out.ramTotalMB = [math]::Round($totalKB / 1024, 0)
  $out.ramUsedMB = [math]::Round(($totalKB - $freeKB) / 1024, 0)
  $out.ramPercent = if ($totalKB -gt 0) { [math]::Round((($totalKB - $freeKB) / $totalKB) * 100, 0) } else { $null }
} else { $out.ramTotalMB = $null; $out.ramUsedMB = $null; $out.ramPercent = $null }

$disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object { $_.Name -eq '_Total' }
if ($disk) {
  $idle = [double]$disk.PercentIdleTime
  $out.diskPercent = [math]::Max(0, [math]::Min(100, [math]::Round(100 - $idle, 0)))
} else { $out.diskPercent = $null }

$net = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface |
  Where-Object { $_.Name -notmatch 'isatap|Loopback|Teredo|Tunneling' }
$rx = ($net | Measure-Object -Property BytesReceivedPersec -Sum).Sum
$tx = ($net | Measure-Object -Property BytesSentPersec -Sum).Sum
$out.netRxKbps = if ($null -ne $rx) { [math]::Round($rx / 1024, 1) } else { $null }
$out.netTxKbps = if ($null -ne $tx) { [math]::Round($tx / 1024, 1) } else { $null }

$procCount = (Get-Process | Measure-Object).Count
$out.processCount = if ($null -ne $procCount) { $procCount } else { $null }

# Temperatura: ACPI (pode falhar sem admin) → LibreHardwareMonitor → null
$temp = $null
$tempSource = $null
$thermal = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature
if ($thermal) {
  $vals = @($thermal | ForEach-Object { ([double]$_.CurrentTemperature - 2732) / 10 } | Where-Object { $_ -gt 0 -and $_ -lt 120 })
  if ($vals.Count) {
    $temp = [math]::Round(($vals | Measure-Object -Maximum).Maximum, 0)
    $tempSource = 'acpi'
  }
}
if ($null -eq $temp) {
  $lhm = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor |
    Where-Object { $_.SensorType -eq 'Temperature' -and $_.Name -match 'CPU Package|CPU Core #0|CPU' }
  if ($lhm) {
    $lhmVals = @($lhm | ForEach-Object { [double]$_.Value } | Where-Object { $_ -gt 0 -and $_ -lt 120 })
    if ($lhmVals.Count) {
      $temp = [math]::Round(($lhmVals | Measure-Object -Maximum).Maximum, 0)
      $tempSource = 'lhm'
    }
  }
}
$out.tempC = $temp
$out.tempSource = $tempSource

# GPU: identidade (WMI). Uso vem do nvidia-smi ou do fallback Get-Counter no Node.
$vc = @(Get-CimInstance Win32_VideoController | Where-Object {
  $_.Name -and $_.Name -notmatch 'Basic Render|Remote Desktop|Microsoft Basic Display'
})
if (-not $vc.Count) { $vc = @(Get-CimInstance Win32_VideoController) }
$g0 = $vc | Select-Object -First 1
$out.gpuName = if ($g0) { [string]$g0.Name } else { $null }
$out.gpuVendor = if ($g0) { [string]$g0.AdapterCompatibility } else { $null }
$out.gpuVramMB = if ($g0 -and $g0.AdapterRAM -gt 0) { [math]::Round([double]$g0.AdapterRAM / 1MB, 0) } else { $null }
$out | ConvertTo-Json -Compress
`;

/** Fallback leve: só engines 3D (AMD/Intel/NVIDIA sem nvidia-smi). */
const GPU_COUNTER_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$sum = $null
try {
  $samples = (Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -ErrorAction Stop).CounterSamples
  $sum = ($samples | Measure-Object -Property CookedValue -Sum).Sum
} catch { }
if ($null -ne $sum) { [math]::Min(100, [math]::Round([double]$sum, 0)) } else { 'null' }
`;

let gpuCliPath = undefined; // cache da detecção do nvidia-smi

function detectNvidiaSmi() {
  if (gpuCliPath !== undefined) return Promise.resolve(gpuCliPath);
  const cli = findNvidiaSmi();
  // Caminho absoluto existente: confia sem --help (evita race/timeout).
  if (cli && cli !== 'nvidia-smi' && fs.existsSync(cli)) {
    gpuCliPath = cli;
    return Promise.resolve(gpuCliPath);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (found) => {
      if (settled) return;
      settled = true;
      gpuCliPath = found ? cli : null;
      resolve(gpuCliPath);
    };
    const child = spawn(cli, ['--query-gpu=name', '--format=csv,noheader'], { windowsHide: true });
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) { /* ignore */ }
      done(false);
    }, 4000);
    child.on('error', () => { clearTimeout(timer); done(false); });
    child.on('close', (code) => {
      clearTimeout(timer);
      done(code === 0);
    });
  });
}

function parseNvidiaLine(out) {
  const line = String(out || '').trim().split(/\r?\n/).find(Boolean);
  if (!line) return null;
  const parts = line.split(',').map((v) => parseFloat(String(v).trim()));
  const [util, memUsed, memTotal, temp, clock] = parts;
  return {
    percent: Number.isFinite(util) ? Math.round(util) : null,
    vramUsedMB: Number.isFinite(memUsed) ? Math.round(memUsed) : null,
    vramTotalMB: Number.isFinite(memTotal) ? Math.round(memTotal) : null,
    tempC: Number.isFinite(temp) ? Math.round(temp) : null,
    clockMhz: Number.isFinite(clock) ? Math.round(clock) : null
  };
}

async function queryNvidiaGpu() {
  try {
    const cli = await detectNvidiaSmi();
    if (!cli) return null;
    return await new Promise((resolve) => {
      let out = '';
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      };
      const child = spawn(cli, [
        '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,clocks.gr',
        '--format=csv,noheader,nounits'
      ], { windowsHide: true });
      const timer = setTimeout(() => {
        try { child.kill(); } catch (_) { /* ignore */ }
        finish(null);
      }, 5000);
      child.stdout.on('data', (d) => { out += d.toString('utf8'); });
      child.on('error', () => finish(null));
      child.on('close', () => finish(parseNvidiaLine(out)));
    });
  } catch (_) {
    return null;
  }
}

async function queryWindowsGpuPercent() {
  try {
    const { stdout, code } = await runner.runPowerShellInline(GPU_COUNTER_PS, 8000);
    if (code !== 0 && !stdout) return null;
    const raw = String(stdout || '').trim();
    if (!raw || raw === 'null') return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.min(100, Math.round(n)) : null;
  } catch (_) {
    return null;
  }
}

let snapshotInflight = null;

/** Snapshot completo e real do uso atual do sistema. */
async function getSnapshot() {
  if (snapshotInflight) return snapshotInflight;
  snapshotInflight = collectSnapshot().finally(() => { snapshotInflight = null; });
  return snapshotInflight;
}

async function collectSnapshot() {
  // PowerShell + nvidia-smi em paralelo (antes era sequencial e parecia “travado”).
  const [psResult, nvidia] = await Promise.all([
    runner.runPowerShellInline(SNAPSHOT_PS, 14000).catch(() => ({ stdout: '', code: 1 })),
    queryNvidiaGpu()
  ]);

  let base = {};
  try {
    const text = String(psResult.stdout || '').trim();
    // Pode haver lixo antes/depois do JSON se o host emitir avisos.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    base = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : {};
  } catch (_) {
    base = {};
  }

  let gpu = null;
  if (nvidia) {
    gpu = {
      ...nvidia,
      label: base.gpuName || 'NVIDIA',
      vendor: base.gpuVendor || 'NVIDIA',
      usagePercent: nvidia.percent
    };
  } else {
    const winGpu = await queryWindowsGpuPercent();
    if (base.gpuName || winGpu != null) {
      gpu = {
        percent: winGpu,
        usagePercent: winGpu,
        label: base.gpuName || null,
        vendor: base.gpuVendor || null,
        vramTotalMB: base.gpuVramMB ?? null,
        vramUsedMB: null,
        tempC: null
      };
    }
  }

  // Temperatura do dashboard: ACPI/LHM → temperatura da GPU (real) → null
  let tempC = base.tempC ?? null;
  let tempSource = base.tempSource || (tempC != null ? 'acpi' : null);
  if (tempC == null && gpu && gpu.tempC != null) {
    tempC = gpu.tempC;
    tempSource = 'gpu';
  }

  return {
    ts: new Date().toISOString(),
    cpu: base.cpu ?? null,
    ramPercent: base.ramPercent ?? null,
    ramUsedMB: base.ramUsedMB ?? null,
    ramTotalMB: base.ramTotalMB ?? null,
    diskPercent: base.diskPercent ?? null,
    netRxKbps: base.netRxKbps ?? null,
    netTxKbps: base.netTxKbps ?? null,
    processCount: base.processCount ?? null,
    tempC,
    tempSource,
    gpu
  };
}

module.exports = { getSnapshot };
