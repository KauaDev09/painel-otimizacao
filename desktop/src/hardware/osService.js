'use strict';

const { clean } = require('../bios/vendorDetect');
const { asArray } = require('../utils/asArray');

function detectOs(raw) {
  const osArr = asArray(raw && raw.os);
  const regArr = asArray(raw && raw.osreg);
  const sysArr = asArray(raw && raw.system);
  const o = osArr[0] || {};
  const r = regArr[0] || {};
  const s = sysArr[0] || {};

  const build = r.CurrentBuildNumber || o.BuildNumber || null;
  const ubr = Number.isFinite(r.UBR) ? r.UBR : null;
  return {
    caption: o.Caption || r.ProductName || null,
    displayVersion: r.DisplayVersion || null,
    build: build ? (ubr ? `${build}.${ubr}` : String(build)) : null,
    arch: o.OSArchitecture || null,
    edition: r.EditionID || null,
    installType: r.InstallationType || null,
    pcType: Number.isFinite(s.PCSystemType) && Number(s.PCSystemType) === 2 ? 'Notebook' : 'Desktop',
    totalRamGB: Number.isFinite(s.TotalPhysicalMemory) ? Math.round(s.TotalPhysicalMemory / (1024 * 1024 * 1024)) : null
  };
}

function detectDisks(raw) {
  const arr = asArray(raw && raw.disks);
  if (!arr.length) return { partitionStyle: 'unknown', disks: [] };
  return {
    partitionStyle: arr[0].PartitionStyle === 'GPT' ? 'GPT' : arr[0].PartitionStyle === 'MBR' ? 'MBR' : 'unknown',
    disks: arr.map((d) => ({
      number: d.Number, friendlyName: clean(d.FriendlyName), partitionStyle: d.PartitionStyle || null,
      busType: d.BusType || null, sizeGB: Number.isFinite(d.SizeGB) ? d.SizeGB : null
    }))
  };
}

module.exports = { detectOs, detectDisks };
