'use strict';

const { normalizeBiosVendor } = require('../bios/vendorDetect');
const { asArray } = require('../utils/asArray');

function biosAgeYears(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return diffMs < 0 ? 0 : +(diffMs / (365.25 * 24 * 3600 * 1000)).toFixed(1);
}

function detectBios(raw) {
  const b = asArray(raw && raw.bios)[0];
  if (!b) {
    return { detected: false, vendor: null, version: null, dateISO: null, ageYears: null, smbiosVersion: null, name: null };
  }
  const dateISO = b.ReleaseDateStr || null;
  const version = (b.SMBIOSBIOSVersion && String(b.SMBIOSBIOSVersion).replace(/\u0000/g, '').trim()) || null;
  return {
    detected: Boolean(version || b.Manufacturer),
    vendor: normalizeBiosVendor(b.Manufacturer),
    version,
    dateISO,
    ageYears: biosAgeYears(dateISO),
    smbiosVersion: (Number.isFinite(b.SMBIOSMajorVersion) && b.SMBIOSMajorVersion > 0)
      ? `${b.SMBIOSMajorVersion}.${b.SMBIOSMinorVersion}`
      : null,
    name: b.Name && !/default|to be filled/i.test(b.Name) ? String(b.Name).trim() : null
  };
}

module.exports = { detectBios, biosAgeYears };
