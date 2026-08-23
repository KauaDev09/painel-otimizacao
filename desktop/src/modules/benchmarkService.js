'use strict';

// BenchmarkService — medições REAIS de desempenho (CPU, RAM, Disco).
//   - CPU: worker threads executando carga determinística (1 thread e todas)
//   - RAM: banda de cópia de memória medida no worker
//   - Disco: gravação/leitura sequencial de arquivo temporário real
// Os resultados são índices internos comparáveis entre execuções neste app
// — nunca prometemos FPS ou ganhos que não foram medidos.
// Cada execução fica salva localmente para comparação antes/depois.

const { Worker } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKER_FILE = path.join(__dirname, 'benchmark.worker.js');

function runWorker(workerData, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER_FILE, { workerData });
    const timer = setTimeout(() => {
      try { w.terminate(); } catch (_) { /* ignora */ }
      reject(new Error('Benchmark excedeu o tempo limite.'));
    }, timeoutMs);
    w.on('message', (msg) => { clearTimeout(timer); resolve(msg); });
    w.on('error', (err) => { clearTimeout(timer); reject(err); });
    w.on('exit', (code) => {
      if (code !== 0) { clearTimeout(timer); reject(new Error(`Worker finalizado (código ${code}).`)); }
    });
  });
}

/** Benchmark de CPU: single-thread e multi-thread reais. */
async function benchmarkCpu() {
  const single = await runWorker({ type: 'cpu-single' });
  if (!single.ok) throw new Error(single.error || 'Falha no teste de CPU.');

  const threads = Math.max(1, os.cpus().length);
  const t0 = process.hrtime.bigint();
  const results = await Promise.all(
    Array.from({ length: threads }, () => runWorker({ type: 'cpu-multi' }))
  );
  const t1 = process.hrtime.bigint();
  const wallMs = Number(t1 - t0) / 1e6;
  const allOk = results.every((r) => r.ok);

  // Índice interno: unidades de trabalho por segundo (comparável só neste app).
  const singleScore = Math.round((single.loops / single.ms) * 1000 * 10); // loops/s ×10 p/ legibilidade
  const multiScore = allOk
    ? Math.round(((results.reduce((a, r) => a + r.loops, 0)) / wallMs) * 1000 * 10)
    : null;

  return {
    threads,
    singleScore,
    multiScore,
    speedup: singleScore && multiScore ? Math.round((multiScore / singleScore) * 10) / 10 : null,
    note: 'Índice interno de CPU (unidades/s). Compare apenas execuções deste aplicativo.'
  };
}

/** Benchmark de RAM: banda de memória em GB/s. */
async function benchmarkRam() {
  const res = await runWorker({ type: 'ram', passes: 12 });
  if (!res.ok) throw new Error(res.error || 'Falha no teste de RAM.');
  return {
    gbPerSec: Math.round(res.gbPerSec * 100) / 100,
    note: 'Banda de cópia de memória medida (GB/s).'
  };
}

/** Benchmark de disco: grava e lê um arquivo temporário sequencial real. */
async function benchmarkDisk() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mso-bench-'));
  const file = path.join(dir, 'bench.bin');
  const SIZE_BYTES = 512 * 1024 * 1024; // 512 MB
  const CHUNK = 8 * 1024 * 1024;
  const chunk = crypto.randomBytes(CHUNK);

  try {
    // ---- Gravação ----
    const fd = fs.openSync(file, 'w');
    const tW0 = process.hrtime.bigint();
    for (let written = 0; written < SIZE_BYTES; written += CHUNK) {
      fs.writeSync(fd, chunk);
    }
    fs.fsyncSync(fd);
    const tW1 = process.hrtime.bigint();
    fs.closeSync(fd);
    const writeSec = Number(tW1 - tW0) / 1e9;
    const writeMBps = SIZE_BYTES / 1e6 / writeSec;

    // ---- Leitura ----
    const buf = Buffer.allocUnsafe(CHUNK);
    const fd2 = fs.openSync(file, 'r');
    const tR0 = process.hrtime.bigint();
    for (let read = 0; read < SIZE_BYTES; read += CHUNK) {
      fs.readSync(fd2, buf, 0, CHUNK, read);
    }
    const tR1 = process.hrtime.bigint();
    fs.closeSync(fd2);
    const readSec = Number(tR1 - tR0) / 1e9;
    const readMBps = SIZE_BYTES / 1e6 / readSec;

    return {
      writeMBps: Math.round(writeMBps),
      readMBps: Math.round(readMBps),
      sizeMB: SIZE_BYTES / (1024 * 1024),
      note: 'Taxa sequencial medida no disco temporário do usuário.'
    };
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignora */ }
  }
}

/**
 * Executa a bateria completa (ou apenas os testes pedidos) e registra o resultado.
 * opts.kinds = ['cpu','ram','disk']
 */
async function runBenchmark(opts = {}) {
  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds.filter((k) => ['cpu', 'ram', 'disk'].includes(k))
    : ['cpu', 'ram', 'disk'];

  const entry = {
    id: `bm-${Date.now()}`,
    date: new Date().toISOString(),
    label: opts.label || 'Benchmark manual',
    cpu: kinds.includes('cpu') ? await benchmarkCpu() : null,
    ram: kinds.includes('ram') ? await benchmarkRam() : null,
    disk: kinds.includes('disk') ? await benchmarkDisk() : null
  };

  saveEntry(entry);
  return entry;
}

// ---------------- Persistência local ----------------
let storeDir = null;
function setStoreDir(dir) {
  storeDir = dir;
  fs.mkdirSync(dir, { recursive: true });
}
function storeFile() {
  return path.join(storeDir || path.join(os.tmpdir()), 'benchmarks.json');
}
function loadAll() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch (_) {
    return [];
  }
}
function saveEntry(entry) {
  const all = loadAll();
  all.push(entry);
  fs.writeFileSync(storeFile(), JSON.stringify(all.slice(-50), null, 2), 'utf8');
}

module.exports = { runBenchmark, listBenchmarks: loadAll, setStoreDir };
