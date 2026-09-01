'use strict';

function gigabyteA520Profile(overrides) {
  const ramMhz = overrides.ramConfigMhz != null ? overrides.ramConfigMhz : 2133;
  const rated = overrides.ramRatedMhz != null ? overrides.ramRatedMhz : 3200;
  const profile = overrides.ramProfile || (rated > ramMhz * 1.05 ? 'likely_inactive' : 'active_or_no_profile');
  return {
    meta: { elevated: !!overrides.elevated, disclaimer: 'mock' },
    cpu: {
      detected: true,
      name: 'AMD Ryzen 5 5600GT',
      brand: 'AMD',
      isRyzen: true,
      architecture: 'x64',
      unlocked: true
    },
    motherboard: {
      detected: true,
      vendorKey: overrides.vendorKey || 'gigabyte',
      vendorDisplay: 'Gigabyte',
      boardProduct: overrides.boardProduct || 'A520M K V2',
      version: 'x.x',
      chipset: 'A520',
      isOem: false
    },
    bios: {
      detected: true,
      vendor: 'Award',
      version: 'F15',
      dateISO: '2024-03-01',
      smbiosVersion: '3.3'
    },
    ram: {
      detected: true,
      modules: [
        { sizeGB: 8, manufacturer: 'Kingston', partNumber: 'Mock', configMHz: ramMhz, ratedMHz: rated, type: 'DDR4' },
        { sizeGB: 8, manufacturer: 'Kingston', partNumber: 'Mock', configMHz: ramMhz, ratedMHz: rated, type: 'DDR4' }
      ],
      count: 2,
      totalGB: 16,
      ddrType: 'DDR4',
      minConfigMHz: ramMhz,
      maxRatedMHz: rated,
      maxConfigMHz: ramMhz,
      profile
    },
    gpu: [{
      name: 'NVIDIA GeForce RTX 3050',
      vendor: 'NVIDIA',
      vramMB: 8192,
      driver: '32.0.15.0000',
      isIntegrated: false,
      gen: 'modern_rebar_capable',
      pcieGenMax: 'PCIe 4.0',
      linkWidthMax: 'x8'
    }],
    gpuSummary: { hasDiscrete: true, hasModernRebarCapable: true, primaryName: 'NVIDIA GeForce RTX 3050' },
    boot: { mode: overrides.bootMode || 'UEFI' },
    secureBoot: overrides.secureBoot || 'disabled',
    virtStatus: overrides.virtStatus || 'enabled_firmware',
    virtStatusLabel: 'Ativada (firmware)',
    tpm: { state: 'present_enabled' }
  };
}

function extraFor(overrides) {
  return {
    power: {
      guid: overrides.powerGuid || '381b4222-f694-41f0-9685-ff5bb260df2e',
      name: overrides.powerName || 'Equilibrado',
      detected: true,
      isHighPerformance: !!overrides.powerHigh
    },
    rebar: { state: overrides.rebar || 'disabled', raw: overrides.rebar || 'No' },
    elevated: !!overrides.elevated,
    vendorTools: { gigabyteGcc: false, gigabyteEasyTune: false, asusArmoury: false, asusAiSuite: false, msiCenter: false, asrockTuning: false }
  };
}

const SCENARIOS = {
  xmp_off: () => ({
    profile: gigabyteA520Profile({ ramConfigMhz: 2133, ramRatedMhz: 3200 }),
    extra: extraFor({ rebar: 'disabled' })
  }),
  xmp_on: () => ({
    profile: gigabyteA520Profile({ ramConfigMhz: 3200, ramRatedMhz: 3200, ramProfile: 'active_or_no_profile' }),
    extra: extraFor({ rebar: 'disabled' })
  }),
  rebar_off: () => ({
    profile: gigabyteA520Profile({ ramConfigMhz: 3200, ramRatedMhz: 3200 }),
    extra: extraFor({ rebar: 'disabled' })
  }),
  rebar_on: () => ({
    profile: gigabyteA520Profile({ ramConfigMhz: 3200, ramRatedMhz: 3200 }),
    extra: extraFor({ rebar: 'enabled' })
  }),
  apply_fail: () => ({
    profile: gigabyteA520Profile({}),
    extra: extraFor({ elevated: true, powerHigh: false }),
    flags: { applyFail: true }
  }),
  verify_fail: () => ({
    profile: gigabyteA520Profile({ ramConfigMhz: 2133, ramRatedMhz: 3200 }),
    extra: extraFor({ rebar: 'disabled' }),
    flags: { verifyFail: true }
  }),
  unsupported: () => ({
    profile: gigabyteA520Profile({ vendorKey: 'unknown', boardProduct: 'Generic OEM' }),
    extra: extraFor({})
  }),
  no_privileges: () => ({
    profile: gigabyteA520Profile({ elevated: false }),
    extra: extraFor({ elevated: false })
  }),
  wrong_provider: () => ({
    profile: gigabyteA520Profile({ vendorKey: 'asus', boardProduct: 'PRIME B550M-A' }),
    extra: extraFor({})
  })
};

function loadScenario(name) {
  const fn = SCENARIOS[name] || SCENARIOS.xmp_off;
  return fn();
}

module.exports = { gigabyteA520Profile, extraFor, SCENARIOS, loadScenario };
