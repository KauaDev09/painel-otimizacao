'use strict';

// MonitorService — monitoramento em tempo real com dados REAIS do Windows.
// Um único snapshot PowerShell por chamada (CIM/WMI, classes de desempenho
// são independentes de idioma) + nvidia-smi quando disponível.
// O que o sistema não expõe (ex.: temperatura em muitas placas) volta null.

const runner = require('../engine/runner');
const { spawn } = require('child_process');

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

# Temperatura: exposta apenas por alguns fabricantes — null quando indisponível.
$temp = $null
$thermal = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature
if ($thermal) {
  $vals = @($thermal | ForEach-Object { ([double]$_.CurrentTemperature - 2732) / 10 } | Where-Object { $_ -gt 0 -and $_ -lt 120 })
  if ($vals.Count) { $temp = [math]::Round(($vals | Measure-Object -Maximum).Maximum, 0) }
}
$out.tempC = $temp

$out | ConvertTo-Json -Compress
`;

let gpuCliPath = undefined; // cache da detecção do nvidia-smi

function detectNvidiaSmi() {
  if (gpuCliPath !== undefined) return Promise.resolve(gpuCliPath);
  return new Promise((resolve) => {
    const child = spawn('nvidia-smi', ['--help'], { windowsHide: true });
    const done = (found) => { gpuCliPath = found ? 'nvidia-smi' : null; resolve(gpuCliPath); };
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0 || code == null ? true : false));
    setTimeout(() => { try { child.kill(); } catch (_) {} done(false); }, 4000);
  });
}

async function queryNvidiaGpu() {
  try {
    const cli = await detectNvidiaSmi();
    if (!cli) return null;
    return await new Promise((resolve) => {
      let out = '';
      const child = spawn(cli, [
        '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,clocks.gr',
        '--format=csv,noheader,nounits'
      ], { windowsHide: true });
      const timer = setTimeout(() => { try { child.kill(); } catch (_) {} resolve(null); }, 5000);
      child.stdout.on('data', (d) => { out += d.toString('utf8'); });
      child.on('error', () => { clearTimeout(timer); resolve(null); });
      child.on('close', () => {
        clearTimeout(timer);
        const line = String(out).trim().split('\r\n')[0];
        if (!line) return resolve(null);
        const [util, memUsed, memTotal, temp, clock] = line.split(',').map((v) => parseFloat(String(v).trim()));
        resolve({
          percent: Number.isFinite(util) ? util : null,
          vramUsedMB: Number.isFinite(memUsed) ? memUsed : null,
          vramTotalMB: Number.isFinite(memTotal) ? memTotal : null,
          tempC: Number.isFinite(temp) ? temp : null,
          clockMhz: Number.isFinite(clock) ? clock : null
        });
      });
    });
  } catch (_) {
    return null;
  }
}

/** Snapshot completo e real do uso atual do sistema. */
async function getSnapshot() {
  let base = {};
  try {
    const { stdout } = await runner.runPowerShellInline(SNAPSHOT_PS, 20000);
    base = JSON.parse(stdout.trim());
  } catch (_) {
    base = { cpu: null, ramPercent: null, diskPercent: null, netRxKbps: null, netTxKbps: null };
  }
  const gpu = await queryNvidiaGpu();
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
    tempC: base.tempC ?? null,
    gpu // null quando não há NVIDIA/nvidia-smi disponível
  };
}

module.exports = { getSnapshot };
