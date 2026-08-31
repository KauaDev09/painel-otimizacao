'use strict';

/**
 * Script de release automatizado para o Orion Optimizer.
 *
 * Uso:
 *   node scripts/release.js patch    -> 2.0.0 -> 2.0.1
 *   node scripts/release.js minor    -> 2.0.0 -> 2.1.0
 *   node scripts/release.js major    -> 2.0.0 -> 3.0.0
 *   node scripts/release.js 2.3.1    -> define versão específica
 *
 * O que faz:
 *   1. Bump da versão em package.json + appConfig.js
 *   2. Build do instalador NSIS
 *   3. Commit + push da nova versão
 *   4. Criação de tag e Release no GitHub com upload do .exe
 *
 * Obs: requer o GitHub CLI (gh) instalado e autenticado (gh auth login).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const CONFIG_PATH = path.join(ROOT, 'src', 'config', 'appConfig.js');
const OWNER = 'KauaDev09';
const REPO = 'painel-otimizacao';

// ================= Helpers =================

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

function run(cmd, opts = {}) {
  console.log(`[release] $ ${cmd}`);
  execSync(cmd, { cwd: opts.cwd || ROOT, stdio: opts.stdio || 'inherit', env: { ...process.env } });
}

function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function checkGitAuth() {
  try {
    const out = execSync('gh auth status', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return /Logged in to github\.com/.test(out);
  } catch (_) {
    return false;
  }
}

// ================= Main =================

const arg = process.argv[2] || 'patch';
const pkg = readJson(PKG_PATH);
const currentVersion = pkg.version;

const newVersion = bumpVersion(currentVersion, arg);
if (newVersion === currentVersion) {
  console.log(`[release] Versão já é ${currentVersion}. Nada a fazer.`);
  process.exit(0);
}

const tag = `v${newVersion}`;
const installerName = `ORION OPTIMIZER Setup-${newVersion}.exe`;
const installerPath = path.join(ROOT, 'release', installerName);

console.log('');
console.log('-----------------------------------------------');
console.log('       ORION OPTIMIZER - NOVO RELEASE');
console.log('-----------------------------------------------');
console.log(`  Versão atual:   ${currentVersion}`);
console.log(`  Nova versão:    ${newVersion}`);
console.log(`  Tag:            ${tag}`);
console.log('-----------------------------------------------');
console.log('');

// Step 1: Bump version in package.json
console.log('[release] 1/5 Atualizando package.json...');
pkg.version = newVersion;
writeJson(PKG_PATH, pkg);

// Step 2: Bump version in appConfig.js
console.log('[release] 2/5 Atualizando appConfig.js...');
let configSrc = fs.readFileSync(CONFIG_PATH, 'utf8');
configSrc = configSrc.replace(
  /APP_VERSION\s*=\s*['"][\d.]+['"]/,
  `APP_VERSION = '${newVersion}'`
);
fs.writeFileSync(CONFIG_PATH, configSrc, 'utf8');

// Step 3: Build
console.log('[release] 3/5 Gerando instalador NSIS...');
console.log('');
run('npx electron-builder --win nsis');
console.log('');

if (!fs.existsSync(installerPath)) {
  console.error(`[release] Instalador não encontrado: ${installerPath}`);
  console.error('[release] Verifique o build acima. Nada foi publicado no GitHub.');
  process.exit(1);
}

// Step 4: Commit + push
console.log('[release] 4/5 Commit e push da nova versão...');
run('git add package.json src/config/appConfig.js');
run(`git commit -m "chore: bump versão para ${newVersion}"`);
run('git push origin main');

// Step 5: Publicar no GitHub
console.log('[release] 5/5 Publicando no GitHub...');

if (!checkGitHubCLI()) {
  console.error('[release] GitHub CLI (gh) não encontrado.');
  console.error('[release] Instale em: https://cli.github.com e rode: gh auth login');
  console.error(`[release] O instalador existe porém (${installerName}); publique manualmente em:`);
  console.error(`[release]   https://github.com/${OWNER}/${REPO}/releases`);
  process.exit(1);
}

if (!checkGitAuth()) {
  console.error('[release] gh não está autenticado. Rode: gh auth login');
  process.exit(1);
}

try { run(`git tag ${tag} -m "Release ${newVersion}"`); } catch (_) { console.log(`[release] Tag ${tag} já existe, reutilizando.`); }
run(`git push origin ${tag}`);

const changelogPath = path.join(ROOT, 'release', 'NOTES.md');
let notes = `# Orion Optimizer v${newVersion}\n\nInstalador do Windows (NSIS). Publicado automaticamente pelo script de release.\n\nDownload: \`${installerName}\``;
if (fs.existsSync(changelogPath)) {
  notes = fs.readFileSync(changelogPath, 'utf8');
}

console.log(`[release] Criando release ${tag} e enviando ${installerPath}...`);
const notesTemp = path.join(ROOT, 'release', '.notes.tmp.md');
fs.writeFileSync(notesTemp, notes, 'utf8');

const ghCmd =
  `gh release create ${tag} "${installerPath}" ` +
  `--repo ${OWNER}/${REPO} ` +
  `--title "Orion Optimizer v${newVersion}" ` +
  `--notes-file "${notesTemp}"`;

try {
  run(ghCmd, { stdio: 'inherit' });
} catch (err) {
  console.error('[release] Falha ao criar a release.');
  console.error(`[release] Se a tag já existe, use: gh release delete ${tag} --yes`);
  console.error('[release] Ou force o upload: gh release upload ' + tag + ' "' + installerPath + '" --repo ' + OWNER + '/' + REPO);
  fs.unlinkSync(notesTemp);
  process.exit(1);
}

fs.unlinkSync(notesTemp);

console.log('');
console.log('-----------------------------------------------');
console.log('          RELEASE CONCLUÍDO COM SUCESSO!');
console.log('-----------------------------------------------');
console.log(`  Instalador: release/${installerName}`);
console.log(`  Release:    https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`);
console.log('');
console.log('  Próximos passos:');
console.log('  1. Acesse o painel admin:');
console.log('     https://orion-optimizer-ten.vercel.app/admin');
console.log('     Aba "Atualizações"');
console.log('  2. Preencha: versão, changelog e a URL de download:');
console.log(`     https://github.com/${OWNER}/${REPO}/releases/download/${tag}/${encodeURIComponent(installerName)}`);
console.log('  3. Clique "PUBLICAR"');
console.log('');
console.log('  4. Teste no app:');
console.log('     Abra o app > Configurações > Atualizações');
console.log('     Clique "VERIFICAR ATUALIZAÇÕES AGORA"');
console.log('-----------------------------------------------');
console.log('');
