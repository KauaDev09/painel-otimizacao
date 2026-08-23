'use strict';

const { normalizeVendor, extractChipset } = require('../bios/vendorDetect');
const { asArray } = require('../utils/asArray');

const LAPTOP_CHASSIS = new Set([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32]);

function detectMotherboard(raw) {
  const b = asArray(raw && raw.board)[0] || {};
  const s = asArray(raw && raw.system)[0] || {};
  const chassisTypes = asArray(asArray(raw && raw.chassis)[0] && asArray(raw && raw.chassis)[0].ChassisTypes);
  const isLaptop = chassisTypes.some((t) => LAPTOP_CHASSIS.has(Number(t))) ||
    (Number.isFinite(s.PCSystemType) && Number(s.PCSystemType) === 2);

  const vendor = normalizeVendor(b.Manufacturer, s.Manufacturer);
  const product = (b.Product && !/to be filled|default string/i.test(b.Product)) ? String(b.Product).trim() : null;
  const model = (s.Model && !/to be filled|default string|system model/i.test(s.Model)) ? String(s.Model).trim() : null;

  return {
    detected: Boolean(vendor.raw || product),
    vendorKey: vendor.key,
    vendorDisplay: vendor.key === 'unknown' ? (vendor.raw || null) : capitalize(vendor.key),
    boardProduct: product,
    systemModel: model,
    systemVendor: (s.Manufacturer && !/to be filled|default string/i.test(s.Manufacturer)) ? String(s.Manufacturer).trim() : null,
    version: b.Version && !/to be filled/i.test(b.Version) ? String(b.Version).trim() : null,
    chipset: extractChipset(product, model),
    formFactor: isLaptop ? 'Notebook/All-in-One' : 'Desktop',
    isOem: ['acer', 'dell', 'hp', 'lenovo'].includes(vendor.key)
  };
}

function capitalize(s) {
  if (!s) return s;
  if (s.length <= 3) return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { detectMotherboard };
