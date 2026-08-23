'use strict';

// Smoke test dos novos serviços: settings, monitor, startup, processos, rede.
const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbo-modules-'));
  console.log('Dir temporário:', tmp);

  // ---- Settings ----
  const settings = require('../src/modules/settingsService');
  await settings.init(tmp);
  await settings.set({ monitoring: { intervalSec: 3 } });
  const s = await settings.get();
  if (s.monitoring.intervalSec !== 3) throw new Error('settings.set falhou');
  if (s.general.startWithWindows !== false) throw new Error('defaults incorretos');
  console.log('settings OK:', JSON.stringify(s.monitoring));

  // ---- Monitor ----
  const monitor = require('../src/modules/monitorService');
  const snap = await monitor.getSnapshot();
  console.log(`monitor OK: cpu=${snap.cpu}% ram=${snap.ramPercent}% disk=${snap.diskPercent}% procs=${snap.processCount} temp=${snap.tempC}`);
  if (snap.cpu == null || snap.cpu < 0 || snap.cpu > 100) throw new Error('cpu fora de faixa');
  if (!snap.ramTotalMB || snap.ramTotalMB < 512) throw new Error('ram total suspeita');

  // ---- Startup ----
  const startup = require('../src/modules/startupService');
  const entries = await startup.listStartup();
  console.log(`startup OK: ${entries.length} entradas`);
  const sample = entries.slice(0, 3).map((e) => `${e.name} [${e.source}] ${e.enabled ? 'on' : 'off'} impacto=${e.impact}${e.protected ? ' PROTEGIDO' : ''}`);
  console.log('  ', sample.join(' | '));

  // ---- Processos ----
  const proc = require('../src/modules/processService');
  const procs = await proc.listProcesses();
  console.log(`processos OK: ${procs.length}, maior RAM: ${procs[0] ? procs[0].name + ' ' + procs[0].memMB + 'MB' : '-'}`);
  const crit = procs.find((p) => p.critical);
  console.log(`  protegido detectado: ${crit ? crit.name : '(nenhum na lista)'}`);

  // ---- Rede (info apenas; ping rápido com 2 pacotes) ----
  const net = require('../src/modules/networkService');
  const adapters = await net.getAdapterInfo();
  console.log(`rede OK: ${adapters.adapters.length} adaptadores ativos, dns=[${(adapters.dnsServers || []).slice(0, 2).join(', ')}]`);

  console.log('\nTODOS OS SMOKE TESTS PASSARAM');
}

main().catch((e) => { console.error('FALHA:', e); process.exit(1); });
