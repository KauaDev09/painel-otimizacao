'use strict';

// Carrega o banco de regras (/rules/*.json):
//  - arquivos de REGRAS: generic.json, amd.json, intel.json (arrays de regras)
//  - arquivos de FABRICANTE: asus.json, gigabyte.json, msi.json, asrock.json
//    (bancos de caminhos/menus que sobrescrevem/aumentam os caminhos das regras)
// As regras vivem fora do código para permitir atualização sem recompilar.

const fs = require('fs');
const path = require('path');

const RULES_DIR = __dirname;
const RULE_FILES = ['generic.json', 'amd.json', 'intel.json'];
const VENDOR_FILES = ['asus.json', 'gigabyte.json', 'msi.json', 'asrock.json'];

function readJson(file) {
  const full = path.join(RULES_DIR, file);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function loadRules() {
  const rules = [];
  for (const f of RULE_FILES) {
    const arr = readJson(f);
    if (!Array.isArray(arr)) throw new Error(`Arquivo de regras inválido: ${f}`);
    rules.push(...arr);
  }
  const vendors = {};
  for (const f of VENDOR_FILES) {
    const v = readJson(f);
    if (!v.vendor) throw new Error(`Arquivo de fabricante inválido: ${f}`);
    vendors[v.vendor] = v;
  }

  // Aplica overrides por fabricante nas regras.
  for (const rule of rules) {
    rule.paths = rule.paths || {};
    for (const [vk, vf] of Object.entries(vendors)) {
      const ov = vf.pathOverrides && vf.pathOverrides[rule.id];
      if (ov) rule.paths[vk] = ov.slice();
    }
  }

  // Validação básica de schema para falhar cedo em caso de erro de edição.
  for (const r of rules) {
    for (const field of ['id', 'name', 'category', 'level', 'risk', 'when']) {
      if (!(field in r)) throw new Error(`Regra sem campo obrigatório "${field}": ${JSON.stringify(r).slice(0, 120)}`);
    }
  }

  return { rules, vendors };
}

module.exports = { loadRules };
