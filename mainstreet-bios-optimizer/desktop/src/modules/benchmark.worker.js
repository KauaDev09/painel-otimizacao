'use strict';

// Worker de benchmark (CPU/RAM) — roda fora do processo principal para não
// travar a interface. Recebe { type } e devolve medições reais.

const { parentPort, workerData } = require('worker_threads');

/** Carga de CPU determinística: crivo de Eratóstenes repetido N vezes. */
function cpuWork(loops) {
  const LIMIT = 500000;
  let acc = 0;
  for (let l = 0; l < loops; l++) {
    const sieve = new Uint8Array(LIMIT + 1);
    for (let i = 2; i * i <= LIMIT; i++) {
      if (!sieve[i]) {
        for (let j = i * i; j <= LIMIT; j += i) sieve[j] = 1;
      }
    }
    // consome o resultado para impedir otimização agressiva
    for (let i = 2; i <= LIMIT; i += 7919) if (!sieve[i]) acc++;
  }
  return acc;
}

/** Banda de memória: copia um bloco grande várias vezes e mede GB/s. */
function ramWork(passes) {
  const SIZE = 32 * 1024 * 1024; // 32M floats = 256 MB
  const src = new Float64Array(SIZE);
  const dst = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i += 1024) src[i] = i;
  const t0 = process.hrtime.bigint();
  for (let p = 0; p < passes; p++) dst.set(src);
  const t1 = process.hrtime.bigint();
  const seconds = Number(t1 - t0) / 1e9;
  const bytesCopied = SIZE * 8 * passes * 2; // lê + escreve
  return { seconds, gbPerSec: bytesCopied / 1e9 / seconds };
}

const type = workerData && workerData.type;

if (type === 'cpu-single') {
  const LOOPS = 30;
  const t0 = process.hrtime.bigint();
  const acc = cpuWork(LOOPS);
  const t1 = process.hrtime.bigint();
  parentPort.postMessage({
    ok: true,
    loops: LOOPS,
    ms: Number(t1 - t0) / 1e6,
    checksum: acc % 100000
  });
} else if (type === 'cpu-multi') {
  const LOOPS = 30;
  const t0 = process.hrtime.bigint();
  const acc = cpuWork(LOOPS);
  const t1 = process.hrtime.bigint();
  parentPort.postMessage({
    ok: true,
    loops: LOOPS,
    ms: Number(t1 - t0) / 1e6,
    checksum: acc % 100000
  });
} else if (type === 'ram') {
  try {
    const r = ramWork(workerData.passes || 12);
    parentPort.postMessage({ ok: true, ...r });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String(err.message || err) });
  }
} else {
  parentPort.postMessage({ ok: false, error: 'Tipo de trabalho desconhecido.' });
}
