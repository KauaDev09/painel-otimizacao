'use strict';

// Rate limiter em memória (sliding window) para proteção contra abuso de API.
// Em execução serverless (Vercel) o estado é por-instância — ainda assim reduz
// brutal-force e abuso local. Para garantir em escala distribua o estado
// (ex.: Redis), mantendo esta mesma interface.

// buckets: { key: { times: number[], lastPurge: number } }
const buckets = new Map();

function now() {
  return Date.now();
}

function purgeExpired() {
  // Evita crescimento infinito do Map.
  if (buckets.size > 10000) {
    const cutoff = now() - 3600000; // janelas mais antigas que 1h limpamos
    for (const [k, b] of buckets) {
      if (b.lastPurge < cutoff) buckets.delete(k);
    }
  }
}

// Retorna o limite restante após registrar a requisição.
// Se retornar { allowed:false }, o cliente excedeu o limite.
function hit(key, limit, windowMs) {
  const t = now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { times: [], lastPurge: t };
    buckets.set(key, bucket);
  }
  // Remove entradas fora da janela.
  bucket.times = bucket.times.filter((x) => t - x < windowMs);
  bucket.lastPurge = t;
  if (bucket.times.length >= limit) {
    purgeExpired();
    const retryAfter = Math.ceil((bucket.times[0] + windowMs - t) / 1000);
    return { allowed: false, retryAfter };
  }
  bucket.times.push(t);
  purgeExpired();
  return { allowed: true, remaining: limit - bucket.times.length };
}

module.exports = { hit };
