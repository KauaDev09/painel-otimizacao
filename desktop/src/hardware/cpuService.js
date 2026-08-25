'use strict';

const { asArray } = require('../utils/asArray');

function detectCpu(raw) {
  const list = asArray(raw && raw.cpu);
  const c = list[0];
  if (!c) return { detected: false };

  const name = (c.Name && String(c.Name).replace(/\u0000/g, '').trim()) || null;
  const brand = /ryzen|amd|athlon|fx\b/i.test(name || '') ? 'AMD' : (/intel|celeron|pentium|core/i.test(name || '') ? 'Intel' : null);
  const unlocked = brand === 'AMD' && /ryzen/i.test(name || '')
    ? true
    : Boolean(brand === 'Intel' && /\b(i[3579]|pentium gold|celeron|ultra\s*[579])\b.*\dK[FS]?\b/i.test(name || ''));

  // Arquitetura WMI: 9=x64, 5=ARM, 6=IA64, 0=x86
  const archMap = { 9: 'x64', 5: 'ARM', 6: 'IA-64', 0: 'x86' };
  const genMatch = brand === 'Intel' ? (name || '').match(/(?:(\d{1,2})th Gen)|Core\(TM\) (i[3579])-(\d{4,5})/) : null;

  return {
    detected: Boolean(name),
    name,
    brand,
    manufacturer: c.Manufacturer || null,
    cores: Number.isFinite(c.NumberOfCores) ? c.NumberOfCores : null,
    threads: Number.isFinite(c.NumberOfLogicalProcessors) ? c.NumberOfLogicalProcessors : null,
    baseClockMhz: Number.isFinite(c.MaxClockSpeed) ? c.MaxClockSpeed : null,
    currentClockMhz: Number.isFinite(c.CurrentClockSpeed) ? c.CurrentClockSpeed : null,
    boostClockMhz: extractBoostFromName(name),
    socket: c.SocketDesignation && !/to be filled/i.test(c.SocketDesignation) ? String(c.SocketDesignation).trim() : null,
    architecture: archMap[c.Architecture] || null,
    virtualizationFirmwareEnabled: typeof c.VirtualizationFirmwareEnabled === 'boolean' ? c.VirtualizationFirmwareEnabled : null,
    description: c.Description || null,
    unlocked,
    intelGenHint: genMatch ? (genMatch[1] || (genMatch[3] ? String(genMatch[3]).slice(0, -2) : null)) : null
  };
}

// Alguns processadores antigos informam "@ 3.40GHz" no nome; novos Intel informam "up to X GHz".
function extractBoostFromName(name) {
  if (!name) return null;
  let m = name.match(/up to\s+([0-9.,]+)\s*ghz/i);
  if (!m) m = name.match(/@\s*([0-9.,]+)\s*ghz/i);
  if (!m) return null;
  const v = parseFloat(String(m[1]).replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 1000) : null;
}

module.exports = { detectCpu };
