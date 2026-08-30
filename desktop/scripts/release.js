'use strict';

/**
 * Script de release automatizado para o Orion Optimizer.
 *
 * Uso:
 *   node scripts/release.js patch    → 2.0.0 → 2.0.1
 *   node scripts/release.js minor    → 2.0.0 → 2.1.0
 *   node scripts/release.js major    → 2.0.0 → 3.0.0
 *   node scripts/release.js 2.3.1    → define versão específica
 *
 * O que faz:
 *   1. Bump da versão em package.json + appConfig.js
 *   2. Build do instalador NSIS
 *   3. Imprime instruções para upload e publicação no painel admin
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const CONFIG_PATH = path.join(ROOT, 'src', 'config', 'appConfig.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`[release] Versão inválida: "${current}"`);
    process.exit(1);
  }
  let [major, minor, patch] = parts;
  switch (type) {
    case 'major': major++; minor = 0; patch = 0; break;
    case 'minor': minor++; patch = 0; break;
    case 'patch': patch++; break;
    default:
      if (/^\d+\.\d+\.\d+$/.test(type)) return type;
      console.error(`[release] Tipo inválido: "${type}". Use: patch | minor | major | X.Y.Z`);
      process.exit(1);
  }
  return `${major}.${minor}.${patch}`;
}

function run(cmd) {
  console.log(`[release] $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ── Main ─────────────────────────────────────────────────────────────────────

const arg = process.argv[2] || 'patch';
const pkg = readJson(PKG_PATH);
const currentVersion = pkg.version;

const newVersion = bumpVersion(currentVersion, arg);
if (newVersion === currentVersion) {
  console.log(`[release] Versão já é ${currentVersion}. Nada a fazer.`);
  process.exit(0);
}

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║          ORION OPTIMIZER — NOVO RELEASE             ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  Versão atual:   ${currentVersion.padEnd(32)}║`);
console.log(`║  Nova versão:    ${newVersion.padEnd(32)}║`);
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');

// Step 1: Bump version in package.json
console.log('[release] 1/3 Atualizando package.json...');
pkg.version = newVersion;
writeJson(PKG_PATH, pkg);

// Step 2: Bump version in appConfig.js
console.log('[release] 2/3 Atualizando appConfig.js...');
let configSrc = fs.readFileSync(CONFIG_PATH, 'utf8');
configSrc = configSrc.replace(
  /APP_VERSION\s*=\s*['"][\d.]+['"]/,
  `APP_VERSION = '${newVersion}'`
);
fs.writeFileSync(CONFIG_PATH, configSrc, 'utf8');

// Step 3: Build
console.log('[release] 3/3 Gerando instalador NSIS...');
console.log('');
run('npx electron-builder --win nsis');
console.log('');

// Done — print next steps
const installerName = `ORION OPTIMIZER Setup-${newVersion}.exe`;
const installerPath = path.join(ROOT, 'release', installerName);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                    RELEASE CONCLUÍDO!                          ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║  Instalador gerado: release/${installerName}`);
console.log('║');
console.log('║  Próximos passos:');
console.log('║');
console.log('║  1. Faça upload do .exe em um hosting acessível:');
console.log('║     → GitHub Releases (recomendado)');
console.log('║     → Google Drive (link direto)');
console.log('║     → Cloudflare R2 / S3');
console.log('║');
console.log('║  2. Acesse o painel admin:');
console.log('║     → https://orion-optimizer-ten.vercel.app/admin');
console.log('║     → Aba "Atualizações"');
console.log('║     → Preencha: versão, URL de download, changelog');
console.log('║     → Clique "PUBLICAR"');
console.log('║');
console.log('║  3. Teste no app:');
console.log('║     → Abra o app → Configurações → Atualizações');
console.log('║     → Clique "VERIFICAR ATUALIZAÇÕES AGORA"');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
