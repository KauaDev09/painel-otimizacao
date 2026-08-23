'use strict';

const { clean } = require('../bios/vendorDetect');
const { asArray } = require('../utils/asArray');

const GB = 1024 * 1024 * 1024;

// SMBIOSMemoryType: valores comuns — 20 DDR, 21 DDR2, 24 DDR3, 26 DDR4, 34 DDR5, 35 LPDDR5.
// FormFactor: 8 DIMM, 12 SODIMM, 23 FB-DIMM.
const TYPE_MAP = {
  20: 'SDRAM', 21: 'DDR', 22: 'DDR2', 24: 'DDR3', 26: 'DDR4',
  34: 'DDR5', 35: 'LPDDR5', 38: 'LPDDR3', 39: 'LPDDR4'
};

function detectMemory(raw) {
  const modsRaw = asArray(raw && raw.ram);
  const slotsArr = asArray(raw && raw.slots);

  const modules = modsRaw.map((m) => {
    const capacity = Number(m.Capacity);
    const ratedMHz = Number(m.Speed);
    const configMHz = Number(m.ConfiguredClockSpeed);
    return {
      slot: clean(m.DeviceLocator) || clean(m.BankLabel) || null,
      sizeGB: Number.isFinite(capacity) ? +(capacity / GB).toFixed(1) : null,
      manufacturer: clean(m.Manufacturer),
      partNumber: clean(m.PartNumber),
      type: TYPE_MAP[Number(m.SMBIOSMemoryType)] ||
        (Number(m.SMBIOSMemoryType) === 0 && Number(m.TypeDetail) & 4096 ? 'Synchronous/Desconhecido' : null),
      smbiosTypeCode: Number.isFinite(Number(m.SMBIOSMemoryType)) ? Number(m.SMBIOSMemoryType) : null,
      formFactor: Number(m.FormFactor) === 12 ? 'SODIMM' : Number(m.FormFactor) === 8 ? 'DIMM' : null,
      ratedMHz: Number.isFinite(ratedMHz) && ratedMHz > 100 ? Math.round(ratedMHz) : null,
      configMHz: Number.isFinite(configMHz) && configMHz > 100 ? Math.round(configMHz) : null,
      configuredVoltageMV: Number.isFinite(Number(m.ConfiguredVoltage)) && Number(m.ConfiguredVoltage) > 0 ? Number(m.ConfiguredVoltage) : null
    };
  });

  const totalGB = modules.reduce((a, m) => a + (m.sizeGB || 0), 0) || null;
  const configSpeeds = [...new Set(modules.map((m) => m.configMHz).filter(Boolean))];
  const ratedSpeeds = [...new Set(modules.map((m) => m.ratedMHz).filter(Boolean))];
  const ddrTypes = [...new Set(modules.map((m) => m.type).filter(Boolean))];
  const minConfigMHz = configSpeeds.length ? Math.min(...configSpeeds) : null;
  const maxConfigMHz = configSpeeds.length ? Math.max(...configSpeeds) : null;
  const maxRatedMHz = ratedSpeeds.length ? Math.max(...ratedSpeeds) : null;

  // Evidencia de perfil XMP/EXPO possivelmente inativo:
  // SMBIOS informa velocidade anunciada (Speed) acima da configurada (ConfiguredClockSpeed).
  let profile;
  if (maxRatedMHz && minConfigMHz && maxRatedMHz > minConfigMHz * 1.05) profile = 'likely_inactive';
  else if (minConfigMHz) profile = 'active_or_no_profile';
  else profile = 'unknown';

  // Topologia (inferida com cautela — o Windows nao expoe canais fisicos).
  let layout = 'unknown';
  if (modules.length === 1) layout = 'single';
  else if (modules.length >= 2) {
    const sameSize = modules.every((m) => m.sizeGB === modules[0].sizeGB);
    const samePart = modules.every((m) => !m.partNumber || m.partNumber === modules[0].partNumber);
    const sameSpeed = configSpeeds.length <= 1;
    layout = sameSize && sameSpeed ? (samePart ? 'matched_multi' : 'mixed_part_matched_size') : 'mixed';
  }

  const slotsTotal = slotsArr.reduce((acc, s) => acc + (Number.isFinite(s.MemoryDevices) ? s.MemoryDevices : 0), 0) || null;

  return {
    detected: modules.length > 0,
    modules,
    count: modules.length,
    slotsTotal,
    totalGB,
    perModuleGB: modules.length ? modules.map((m) => m.sizeGB) : [],
    manufacturers: [...new Set(modules.map((m) => m.manufacturer).filter(Boolean))],
    partNumbers: [...new Set(modules.map((m) => m.partNumber).filter(Boolean))],
    ddrType: ddrTypes.length === 1 ? ddrTypes[0] : (ddrTypes.join(' + ') || null),
    configSpeeds,
    ratedSpeeds,
    minConfigMHz,
    maxRatedMHz,
    maxConfigMHz,
    profile,
    layout,
    dualChannelLikely: modules.length >= 2 && (layout === 'matched_multi' || layout === 'mixed_part_matched_size') ? true : (layout === 'single' ? false : null)
  };
}

module.exports = { detectMemory };
