'use strict';

// Verifica se o script-manifest.json está atualizado em relação aos scripts no
// repositório. Regenera o manifest e compara apenas o mapa `files` com o HEAD —
// o campo `generatedAt` (timestamp) é ignorado.
//
// Uso no CI: falha se os hashes mudaram sem o corrido commit.
//   node scripts/verify-manifest.js
//
// Local (sem CI): avisa, mas não falha (o dev roda hash:scripts e commita).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'src/security/script-manifest.json';
const MANIFEST_PATH = path.join(ROOT, MANIFEST_REL);

function filesOf(raw) {
  return (JSON.parse(raw).files || {});
}

try {
  execSync('node scripts/hash-scripts.js', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}

const current = filesOf(fs.readFileSync(MANIFEST_PATH, 'utf8'));
let head;
try {
  head = filesOf(execSync(`git show HEAD:desktop/${MANIFEST_REL}`, { cwd: ROOT, encoding: 'utf8' }));
} catch (_) {
  head = filesOf(fs.readFileSync(MANIFEST_PATH, 'utf8')); // sem HEAD (ramo novo) → assume ok
}

const a = JSON.stringify(current);
const b = JSON.stringify(head);
if (a !== b) {
  console.error('[verify-manifest] script-manifest.json DESATUALIZADO: rode `node scripts/hash-scripts.js` e inclua no commit.');
  if (process.env.CI === 'true' || process.argv.includes('--strict')) process.exit(1);
  return;
}
console.log('[verify-manifest] manifest sincronizado com os scripts do repositório.');
process.exit(0);