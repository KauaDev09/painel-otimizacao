'use strict';

// Normaliza o fabricante da GPU para o vocabulário do catálogo de otimizações
// ('nvidia' | 'amd' | 'intel').
//
// A detecção (hardware/gpuService.js) devolve rótulos capitalizados
// ('NVIDIA' | 'AMD' | 'Intel') ou o texto cru de AdapterCompatibility; o
// catálogo (engine/catalog.js) marca cada item de GPU com 'nvidia'|'amd'|'intel'.
// Este helper faz a ponte entre os dois mundos.

function normalizeGpuVendor(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (/nvidia|geforce|quadro|tesla/i.test(s)) return 'nvidia';
  if (/\bati\b|amd|radeon|firepro|advanced micro devices/i.test(s)) return 'amd';
  if (/intel/i.test(s)) return 'intel';
  return null;
}

// Recebe uma lista de nomes/compatibilidades e devolve os vendors únicos.
function normalizeGpuVendors(list) {
  const set = new Set();
  const arr = Array.isArray(list) ? list : [list];
  for (const v of arr) {
    const n = normalizeGpuVendor(v);
    if (n) set.add(n);
  }
  return [...set];
}

module.exports = { normalizeGpuVendor, normalizeGpuVendors };
