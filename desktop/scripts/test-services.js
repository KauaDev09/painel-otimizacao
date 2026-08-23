'use strict';

// Testa ReportService e HistoryService de ponta a ponta (sem Electron).

const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  const { runAnalysis } = require(path.join(__dirname, '..', 'src', 'core', 'analyzer'));
  const { ReportService } = require(path.join(__dirname, '..', 'src', 'reports', 'reportService'));
  const { HistoryService } = require(path.join(__dirname, '..', 'src', 'history', 'historyService'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbo-test-'));
  console.log('Dir temporário:', tmp);

  const result = await runAnalysis();

  const reports = new ReportService(path.join(tmp, 'relatorios'));
  const files = reports.generate(result);
  for (const k of ['htmlPath', 'txtPath']) {
    const v = files[k];
    const size = fs.statSync(v).size;
    console.log(`${k}: ${v} (${size} bytes)`);
    if (size < 1000) throw new Error(`Arquivo suspeito de vazio: ${v}`);
  }

  const history = new HistoryService(path.join(tmp, 'history'));
  const e1 = history.saveFromResult(result);
  // simula uma segunda análise "depois" com score alterado
  const result2 = JSON.parse(JSON.stringify(result));
  result2.scores.overall = Math.min(100, result2.scores.overall + 7);
  result2.counts.recommended = Math.max(0, result2.counts.recommended - 1);
  const e2 = history.saveFromResult(result2);
  console.log('Histórico:', history.list().map((x) => `${x.id} score=${x.score}`));

  const cmp = history.compare(e1.id, e2.id);
  if (!cmp || cmp.scoreDelta !== 7) throw new Error('Comparação antes/depois incorreta!');
  console.log(`Compare OK: delta=${cmp.scoreDelta}, mudanças de recomendação=${cmp.recommendationChanges.length}`);

  console.log('\nTODOS OS TESTES DE RELATÓRIO/HISTÓRICO PASSARAM');
}

main().catch((e) => { console.error('FALHA:', e); process.exit(1); });
