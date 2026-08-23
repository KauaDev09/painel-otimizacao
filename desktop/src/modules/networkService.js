'use strict';

// NetworkService — diagnóstico de rede com medições REAIS.
//   - Adaptadores ativos, IP, DNS atual (somente leitura)
//   - Ping test: latência média/mín/máx, jitter e perda de pacotes medidos
//   - DNS test: tempo de resolução contra o servidor atual e contra públicos
// As otimizações de rede em si pertencem ao catálogo do motor (categoria
// "rede") — esta página apenas diagnostica e sugere os IDs adequados.

const runner = require('../engine/runner');

const INFO_PS = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  '$adapters = Get-NetAdapter | Where-Object Status -eq "Up" | ForEach-Object {',
  '  $ip = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress',
  '  [pscustomobject]@{',
  '    name = $_.Name',
  '    description = $_.InterfaceDescription',
  "    type = $_.MediaType",
  '    speedMbps = [math]::Round($_.Speed / 1mb, 0)',
  '    ip = $ip',
  '    mac = $_.MacAddress',
  '  }',
  '}',
  '$dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |',
  '  Where-Object { $_.ServerAddresses } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique -First 4',
  '[pscustomobject]@{ adapters = $adapters; dns = @($dns) } | ConvertTo-Json -Compress'
].join('\n');

/** Informações dos adaptadores ativos e DNS configurado. */
async function getAdapterInfo() {
  try {
    const { stdout } = await runner.runPowerShellInline(INFO_PS, 20000);
    const j = JSON.parse(stdout.trim());
    return {
      adapters: Array.isArray(j.adapters) ? j.adapters : (j.adapters ? [j.adapters] : []),
      dnsServers: Array.isArray(j.dns) ? j.dns : []
    };
  } catch (_) {
    return { adapters: [], dnsServers: [] };
  }
}

/**
 * Ping test real: N pacotes ICMP para um destino.
 * Mede min/avg/max, jitter (desvio médio entre amostras) e perda %.
 */
async function pingTest({ host = '1.1.1.1', count = 10 } = {}) {
  const safeHost = String(host).replace(/[^a-zA-Z0-9.\-]/g, '') || '1.1.1.1';
  const n = Math.min(30, Math.max(4, Number(count) || 10));
  const script =
    `$r = Test-Connection -ComputerName '${safeHost}' -Count ${n} -ErrorAction SilentlyContinue | ` +
    'Where-Object ResponseTime -ge 0 | ForEach-Object { [int]$_.ResponseTime }; ' +
    '$ok = @($r); ' +
    '[pscustomobject]@{ sent = ' + n + '; received = $ok.Count; ' +
    'min = $(if ($ok.Count) { ($ok | Measure-Object -Minimum).Minimum } else { $null }); ' +
    'avg = $(if ($ok.Count) { [math]::Round(($ok | Measure-Object -Average).Average, 1) } else { $null }); ' +
    'max = $(if ($ok.Count) { ($ok | Measure-Object -Maximum).Maximum } else { $null }) } | ConvertTo-Json -Compress';
  let base;
  try {
    const res = await runner.runPowerShellInline(script, 60000);
    base = JSON.parse(res.stdout.trim());
  } catch (err) {
    return { host: safeHost, error: String(err.message || err), ok: false };
  }
  // Jitter: calculado no servidor local a partir das amostras individuais.
  let jitter = null;
  if (base.received > 1) {
    jitter = await measureJitter(safeHost);
  }
  return {
    ok: true,
    host: safeHost,
    sent: base.sent,
    received: base.received,
    lossPercent: Math.round(((base.sent - base.received) / base.sent) * 100),
    minMs: base.min,
    avgMs: base.avg,
    maxMs: base.max,
    jitterMs: jitter
  };
}

/** Jitter via 6 pings rápidos em sequência (diferença média entre pares). */
async function measureJitter(host) {
  try {
    const script =
      `$t = Test-Connection -ComputerName '${host}' -Count 6 -ErrorAction SilentlyContinue | ` +
      'Where-Object ResponseTime -ge 0 | ForEach-Object { [int]$_.ResponseTime }; ' +
      '$a = @($t); $j = 0.0; for ($i=1; $i -lt $a.Count; $i++) { $j += [math]::Abs($a[$i]-$a[$i-1]) }; ' +
      '$pairs = [math]::Max(1, $a.Count-1); ' +
      '[math]::Round($j / $pairs, 1)';
    const res = await runner.runPowerShellInline(script, 30000);
    const v = parseFloat(String(res.stdout).trim());
    return Number.isFinite(v) ? v : null;
  } catch (_) {
    return null;
  }
}

/**
 * DNS test: mede o tempo de resolução contra o DNS atual e contra servidores
 * públicos conhecidos (consulta direta A do domínio informado).
 */
async function dnsTest(domain = 'google.com') {
  const safeDomain = String(domain).replace(/[^a-zA-Z0-9.\-]/g, '') || 'google.com';
  const servers = [
    { label: 'DNS atual', address: null },
    { label: 'Cloudflare (1.1.1.1)', address: '1.1.1.1' },
    { label: 'Google (8.8.8.8)', address: '8.8.8.8' }
  ];
  const results = [];
  for (const s of servers) {
    const script = s.address
      ? `(Measure-Command { Resolve-DnsName '${safeDomain}' -Server ${s.address} -Type A -DnsOnly -ErrorAction Stop }).TotalMilliseconds`
      : `(Measure-Command { Resolve-DnsName '${safeDomain}' -Type A -DnsOnly -ErrorAction Stop }).TotalMilliseconds`;
    try {
      const res = await runner.runPowerShellInline(script, 15000);
      const ms = parseFloat(String(res.stdout).trim());
      results.push({
        server: s.label,
        address: s.address,
        ms: Number.isFinite(ms) ? Math.round(ms * 10) / 10 : null,
        ok: true
      });
    } catch (_) {
      results.push({ server: s.label, address: s.address, ms: null, ok: false });
    }
  }
  return { domain: safeDomain, results };
}

module.exports = { getAdapterInfo, pingTest, dnsTest };
