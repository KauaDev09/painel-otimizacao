'use strict';

// ScriptsSync — espelha os scripts do motor para uma pasta gravável do
// usuário (%APPDATA%/<app>/engine/scripts) na inicialização.
//
// Por quê: cmd.exe/reg.exe não leem dentro do app.asar, e vários .bat do
// pacote original criam arquivos ao lado de si mesmos (%~dp0) — o que falha
// em Program Files sem elevação. Com o espelho em AppData, %~dp0 aponta para
// uma pasta sempre gravável e arquivos extras (ex.: EmptyStandbyList.exe)
// que venham junto do pacote continuam acessíveis aos scripts.

const fs = require('fs');
const path = require('path');

let cachedBase = null;

// Origem dos scripts: fora do asar no app empacotado (extraResources),
// junto do código em desenvolvimento.
function sourceDir() {
  return __dirname.includes('app.asar')
    ? path.join(process.resourcesPath, 'engine', 'scripts')
    : path.join(__dirname, 'scripts');
}

/**
 * Copia (espelha) os scripts para o perfil do usuário.
 * Segura para chamar várias vezes; retorna a base válida em uso.
 *
 * IMPORTANTE: Se o app não estiver pronto (app.whenReady()), a cópia para
 * AppData é adiada e usa-se a origem direta. Na primeira chamada após
 * app.whenReady(), o cache é invalidado e a cópia é feita corretamente.
 */
function ensure() {
  if (cachedBase) return cachedBase;
  const src = sourceDir();
  if (!fs.existsSync(src)) return src;

  let dest = src;
  try {
    const { app } = require('electron');
    // app.getPath('userData') exige que o app esteja pronto.
    // Se não estiver, usamos a origem e limpamos o cache para tentar de novo depois.
    if (!app.isReady()) {
      cachedBase = src;
      return cachedBase;
    }
    dest = path.join(app.getPath('userData'), 'engine', 'scripts');
    fs.cpSync(src, dest, { recursive: true, force: true, verbatimSymlinks: false });
    cachedBase = dest;
  } catch (_) {
    // Sem Electron/perfil indisponível: usa a origem direta.
    cachedBase = fs.existsSync(src) ? src : dest;
  }
  return cachedBase;
}

/**
 * Força a re-inicialização (útil após app.whenReady()).
 */
function reinit() {
  cachedBase = null;
  return ensure();
}

/** Pasta base onde os scripts estão materializados no disco. */
function getScriptsBase() {
  return ensure();
}

module.exports = { ensure, reinit, getScriptsBase };
