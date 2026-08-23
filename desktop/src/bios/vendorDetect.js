'use strict';

const JUNK_RE = /^(default string|to be filled|system manufacturer|none|null|not specified|o\.e\.m\.|by o\.e\.m\.)/i;

function clean(s) {
  if (s === null || s === undefined) return null;
  const v = String(s).replace(/\u0000/g, '').trim();
  if (!v || JUNK_RE.test(v)) return null;
  return v;
}

const VENDOR_MAP = [
  ['asus', /asustek|asus/i],
  ['gigabyte', /gigabyte|aorus/i],
  ['msi', /\bmsi\b|micro-star/i],
  ['asrock', /asrock/i],
  ['biostar', /biostar/i],
  ['acer', /\bacer\b|gateway\b|emachines\b|\beMachines\b/i],
  ['dell', /\bdell\b/i],
  ['hp', /^hp\b|hewlett-packard|\bHP Inc\b/i],
  ['lenovo', /lenovo|\bIBM\b/i]
];

// Retorna { key, raw }: key = identificador normalizado ou 'unknown'.
// Aceita fabricante da placa-mae primeiro; fallback para fabricante do sistema (OEM).
function normalizeVendor(boardManufacturer, systemManufacturer) {
  const candidates = [clean(boardManufacturer), clean(systemManufacturer)].filter(Boolean);
  for (const c of candidates) {
    for (const [key, re] of VENDOR_MAP) {
      if (re.test(c)) return { key, raw: c };
    }
  }
  return { key: 'unknown', raw: candidates[0] || null };
}

function normalizeBiosVendor(manufacturer) {
  const m = clean(manufacturer);
  if (!m) return null;
  if (/american megatrends|\bami\b/i.test(m)) return 'AMI';
  if (/award/i.test(m)) return 'Award';
  if (/phoenix/i.test(m)) return 'Phoenix';
  if (/insyde/i.test(m)) return 'Insyde';
  if (/dell/i.test(m)) return 'Dell';
  if (/^hp|hewlett/i.test(m)) return 'HP';
  if (/lenovo/i.test(m)) return 'Lenovo';
  if (/asus|asustek/i.test(m)) return 'ASUS';
  if (/gigabyte|aorus/i.test(m)) return 'Gigabyte';
  if (/\bmsi\b|micro-star/i.test(m)) return 'MSI';
  if (/asrock/i.test(m)) return 'ASRock';
  if (/biostar/i.test(m)) return 'Biostar';
  if (/\bacer\b/i.test(m)) return 'Acer';
  return m;
}

const CHIPSET_RE = [
  // Intel desktop/server
  /(?<![A-Z0-9])(Z|H|B|Q|W|X)([1-9][0-9]{2,3})[A-Z]?(?![0-9])/i,
  // AMD
  /(?<![A-Z0-9])(X|B|A)([3-8][0-9]{2})(E)?(?![0-9])/i,
  /(TRX[3-9]0)/i
];

// Extrai chipset provavel a partir do nome do produto. Tratado como "provavel", nunca garantido.
function extractChipset(product, systemModel) {
  const source = `${product || ''} ${systemModel || ''}`.toUpperCase();
  const hits = [];
  for (const re of CHIPSET_RE) {
    const m = source.match(re);
    if (m) hits.push(m[0]);
  }
  if (!hits.length) return null;
  // Prefere tokens tipicos de chipset conhecidos (evita capturar partes de nomes de GPU etc.)
  const known = hits.find((h) => /^(Z[1-9]|H[467]?|B[4567]|X299|W790|TRX40|X670|B650|B550|X570|X470|B450|A520|X870|B850|A620|Z890|Z790|Z690|Z590|Z490|Z390|Z370|B760|B660|B560|B460|B365|H810|H770|H670|H610|H570|H510|H470|H410|H310|B360|B250|A320|X470|X399)/i.test(h));
  return known || hits[0];
}

module.exports = { normalizeVendor, normalizeBiosVendor, extractChipset, clean };
