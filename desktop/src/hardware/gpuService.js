'use strict';

const { asArray } = require('../utils/asArray');

const MB = 1024 * 1024;

// GPUs com suporte oficial a Resizable BAR (evidencia: geracoes anunciadas pelos fabricantes).
const REBAR_RE = /rtx\s*(20|30|40|50)\s*|gtx\s*16\s*|rx\s*[6-9]\d{3}|vega\s*(56|64)|radeon\s*(vii|rx)|arc\s*(a|b)\d|radeon\s*80[0-9][ms]?\b/i;
const INTEGRATED_RE = /radeon\(tm\)|uhd graphics|iris|hd graphics|vega.*(graphics|mobile)|610m|780m|890m|arc\s*graphics|intel\(r\).*graphics/i;

function gpuVendor(name, compat) {
  const s = `${name || ''} ${compat || ''}`;
  if (/nvidia|geforce|quadro|tesla/i.test(s)) return 'NVIDIA';
  if (/ati\b|amd|radeon|firepro/i.test(s)) return 'AMD';
  if (/intel/i.test(s)) return 'Intel';
  return compat || null;
}

function classifyGen(name) {
  if (!name) return 'unknown';
  if (INTEGRATED_RE.test(name)) return 'integrated';
  if (REBAR_RE.test(name)) return 'modern_rebar_capable';
  return 'older_or_unknown';
}

function detectGpus(raw, nvidiaSmiOut) {
  const list = asArray(raw && raw.gpu);
  const memClasses = asArray(raw && raw.gpumem);

  const gpus = list.map((g) => {
    const name = g.Name || null;
    const vendor = gpuVendor(name, g.AdapterCompatibility);

    // VRAM: Win32_VideoController.AdapterRAM satura em 4 GB; usar chave de classe
    // qwMemorySize quando disponivel (fonte mais confiavel).
    let vramMB = null;
    if (Number.isFinite(g.AdapterRAM) && g.AdapterRAM > 512 * MB) {
      vramMB = Math.round(g.AdapterRAM / MB);
    }
    const cls = memClasses.find((c) => (c.desc && name && c.desc.toLowerCase() === String(name).toLowerCase()) ||
      (c.matchId && g.PNPDeviceID && String(c.matchId).toLowerCase() === String(g.PNPDeviceID).toLowerCase()));
    if (cls && Number.isFinite(cls.memBytes) && cls.memBytes > 256 * MB) {
      vramMB = Math.round(cls.memBytes / MB);
    }

    return {
      name,
      vendor,
      vramMB,
      driver: g.DriverVersion || null,
      driverDate: g.DriverDateStr || null,
      status: g.Status || null,
      pnpId: g.PNPDeviceID || null,
      mode: g.VideoModeDescription || null,
      isIntegrated: INTEGRATED_RE.test(String(name)) || false,
      gen: classifyGen(name),
      pcieGenMax: null,
      linkWidthMax: null
    };
  });

  // Enriquecimento NVIDIA via nvidia-smi (quando o driver expoe o utilitario).
  if (nvidiaSmiOut) {
    const lines = String(nvidiaSmiOut).trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const cols = line.split(',').map((s) => s.trim());
      const smiName = cols[0];
      const target = gpus.find((g) => g.name && smiName && g.name.includes(smiName));
      if (target) {
        const genMax = parseInt(cols[2], 10);
        const wMax = parseInt(cols[4], 10);
        const memMib = parseFloat(String(cols[6] || '').replace(/[^\d.]/g, ''));
        if (Number.isFinite(genMax)) target.pcieGenMax = `PCIe ${genMax}.0`;
        if (Number.isFinite(wMax)) target.linkWidthMax = `x${wMax}`;
        // VRAM confiável via driver (AdapterRAM satura em ~4 GB)
        if (Number.isFinite(memMib) && memMib > 0) target.vramMB = Math.round(memMib);
      }
    }
  }

  return gpus;
}

module.exports = { detectGpus };
