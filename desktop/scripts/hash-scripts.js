'use strict';

// Gera src/security/script-manifest.json com o SHA-256 de todos os scripts
// estáticos executados pelo app: coletores PowerShell e scripts do motor
// (.bat/.reg/.cmd/.ps1) de src/engine/scripts.
//
// O manifest é regenerado ANTES de cada build (build:app) e vai dentro do
// pacote. Em runtime, src/security/scriptIntegrity.js confere o hash antes de
// executar cada script — divergência (ex.: edição do espelho em %APPDATA%)
// faz a execução ser recusada.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const OUT = path.join(SRC_DIR, 'security', 'script-manifest.json');

const STATIC_PS1 = [
  path.join('hardware', 'collector.ps1'),
  path.join('security', 'securityCollector.ps1')
];
const ENGINE_DIR = path.join(SRC_DIR, 'engine', 'scripts');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, base, out);
    } else {
      const rel = path.relative(base, abs).split(path.sep).join('/');
      out[rel] = sha256File(abs);
    }
  }
  return out;
}

function main() {
  const files = {};
  for (const rel of STATIC_PS1) {
    const abs = path.join(SRC_DIR, rel);
    if (!fs.existsSync(abs)) {
      console.error(`Aviso: ${rel} não encontrado — omitido do manifest.`);
      continue;
    }
    files[rel.split(path.sep).join('/')] = sha256File(abs);
  }
  if (fs.existsSync(ENGINE_DIR)) walk(ENGINE_DIR, SRC_DIR, files);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    files
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`script-manifest.json atualizado: ${Object.keys(files).length} scripts hashados.`);
}

main();