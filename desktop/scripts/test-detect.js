'use strict';

// Harness de teste CLI: executa o pipeline completo SEM abrir o Electron.
// Uso: node scripts/test-detect.js [--json <arquivo>] [--recs]
// Imprime o perfil detectado e as recomendações geradas nesta máquina.

const path = require('path');
const fs = require('fs');

async function main() {
  const { runAnalysis } = require(path.join(__dirname, '..', 'src', 'core', 'analyzer'));

  console.log('> Executando detecção real (CIM/WMI via PowerShell)...\n');
  const result = await runAnalysis((step) => process.stdout.write(`  [${step.key}] ${step.label}\n`));

  const p = result.profile;
  console.log('\n================ PERFIL DETECTADO ================');
  console.log(JSON.stringify({ ...p, raw: undefined }, null, 2));

  console.log('\n================ PONTUAÇÃO =======================');
  console.log(`BIOS Optimization Score: ${result.scores.overall}/100`);
  for (const [cat, d] of Object.entries(result.scores.categories)) {
    console.log(`  ${cat.padEnd(5)} ${String(d.percent).padStart(3)}%`);
    for (const it of d.items) console.log(`     - ${it.name}: ${it.percent}% — ${it.note}`);
  }

  if (process.argv.includes('--recs')) {
    console.log('\n================ RECOMENDAÇÕES ===================');
    for (const [g, arr] of Object.entries(result.groups)) {
      console.log(`\n[${g.toUpperCase()}] (${arr.length})`);
      for (const r of arr) {
        console.log(` • [${r.id}] ${r.name} — risco:${r.risk} impacto:${r.impact}`);
        console.log(`   Status: ${r.statusText}`);
        console.log(`   Recomendação: ${r.recommendation}`);
        r.paths.forEach((x) => console.log(`   Caminho: ${x}`));
      }
    }
  }

  if (process.argv.includes('--json')) {
    const idx = process.argv.indexOf('--json');
    const file = process.argv[idx + 1];
    fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nResultado completo salvo em: ${file}`);
  }
}

main().catch((e) => {
  console.error('\nERRO FATAL:', e);
  process.exit(1);
});
