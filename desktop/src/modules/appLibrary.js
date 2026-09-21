'use strict';

// AppLibrary — descobre jogos e apps instalados (Steam, Epic, caminhos comuns)
// sem varrer o disco inteiro. Leve o suficiente para rodar em segundo plano.

const fs = require('fs');
const path = require('path');

const SKIP_NAME = /redistributable|proton|steamworks|dotnet|vc.?redist|soundtrack|directx|prereq/i;
let cache = { ts: 0, items: null };
const CACHE_MS = 60 * 1000;

function exists(p) {
  try { return !!(p && fs.existsSync(p)); } catch (_) { return false; }
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; }
}

function steamRoot() {
  const candidates = [
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Steam'),
    'D:\\Steam',
    'E:\\Steam',
    path.join(process.env.LOCALAPPDATA || '', 'Steam')
  ];
  return candidates.find((p) => exists(path.join(p, 'steam.exe')) || exists(path.join(p, 'steamapps'))) || null;
}

function parseLibraryFolders(text) {
  const paths = [];
  const re = /"path"\s+"([^"]+)"/gi;
  let m;
  while ((m = re.exec(text))) {
    paths.push(m[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

function parseAppManifest(text) {
  const appid = /"appid"\s+"(\d+)"/i.exec(text);
  const name = /"name"\s+"([^"]+)"/i.exec(text);
  const installdir = /"installdir"\s+"([^"]+)"/i.exec(text);
  return {
    appId: appid ? appid[1] : null,
    name: name ? name[1] : null,
    installDir: installdir ? installdir[1] : null
  };
}

function findArtwork(steamDir, appId) {
  if (!steamDir || !appId) return null;
  const cacheDir = path.join(steamDir, 'appcache', 'librarycache');
  const candidates = [
    path.join(cacheDir, appId + '_header.jpg'),
    path.join(cacheDir, appId + '_library_hero.jpg'),
    path.join(cacheDir, appId + '_library_600x900.jpg'),
    path.join(cacheDir, appId, 'header.jpg'),
    path.join(cacheDir, appId, 'library_hero.jpg')
  ];
  return candidates.find(exists) || null;
}

function pickExe(dir, preferredName, depth) {
  if (!exists(dir) || (depth || 0) > 2) return null;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_) { return null; }
  const preferred = preferredName ? preferredName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const exes = entries.filter((n) => /\.exe$/i.test(n) && !/uninstall|crash|setup|redist|helper|update/i.test(n));
  if (!exes.length) {
    for (const n of entries) {
      const full = path.join(dir, n);
      try {
        if (fs.statSync(full).isDirectory() && !/^(engine|binaries|redist|__|commonredist)$/i.test(n)) {
          const nested = pickExe(full, preferredName, (depth || 0) + 1);
          if (nested) return nested;
        }
      } catch (_) { /* ok */ }
    }
    return null;
  }
  if (preferred) {
    const hit = exes.find((n) => n.toLowerCase().replace(/[^a-z0-9.]/g, '').includes(preferred));
    if (hit) return path.join(dir, hit);
  }
  return path.join(dir, exes[0]);
}

function scanSteam() {
  const root = steamRoot();
  if (!root) return [];
  const libs = [root];
  const vdf = readText(path.join(root, 'steamapps', 'libraryfolders.vdf'));
  parseLibraryFolders(vdf).forEach((p) => { if (exists(p) && !libs.includes(p)) libs.push(p); });

  const items = [];
  for (const lib of libs) {
    const appsDir = path.join(lib, 'steamapps');
    let files = [];
    try { files = fs.readdirSync(appsDir); } catch (_) { continue; }
    for (const file of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(file)) continue;
      const meta = parseAppManifest(readText(path.join(appsDir, file)));
      if (!meta.appId || !meta.name || SKIP_NAME.test(meta.name)) continue;
      const install = path.join(appsDir, 'common', meta.installDir || '');
      const exe = pickExe(install, meta.name);
      items.push({
        id: 'steam-' + meta.appId,
        name: meta.name,
        path: exe || ('steam://rungameid/' + meta.appId),
        launch: 'steam://rungameid/' + meta.appId,
        platform: 'steam',
        appId: meta.appId,
        artworkPath: findArtwork(root, meta.appId),
        source: 'steam'
      });
      if (items.length >= 40) return items;
    }
  }
  return items;
}

function scanEpic() {
  const dir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  if (!exists(dir)) return [];
  let files = [];
  try { files = fs.readdirSync(dir); } catch (_) { return []; }
  const items = [];
  for (const file of files) {
    if (!/\.item$/i.test(file)) continue;
    let json;
    try { json = JSON.parse(readText(path.join(dir, file))); } catch (_) { continue; }
    const name = json.DisplayName || json.AppName;
    if (!name || SKIP_NAME.test(name)) continue;
    const exe = json.LaunchExecutable && json.InstallLocation
      ? path.join(json.InstallLocation, json.LaunchExecutable)
      : null;
    if (exe && !exists(exe)) continue;
    items.push({
      id: 'epic-' + (json.CatalogItemId || json.AppName || file),
      name,
      path: exe || json.InstallLocation || '',
      platform: 'epic',
      artworkPath: null,
      source: 'epic'
    });
    if (items.length >= 20) break;
  }
  return items;
}

function newestIn(dir, nameRe) {
  if (!exists(dir)) return null;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_) { return null; }
  const dirs = entries
    .map((n) => path.join(dir, n))
    .filter((p) => {
      try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
    })
    .sort((a, b) => {
      try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch (_) { return 0; }
    });
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(d); } catch (_) { continue; }
    const hit = files.find((n) => nameRe.test(n));
    if (hit) return path.join(d, hit);
  }
  return null;
}

function scanKnown() {
  const local = process.env.LOCALAPPDATA || '';
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const known = [
    { id: 'fivem', name: 'FiveM', paths: [
      path.join(local, 'FiveM', 'FiveM.exe'),
      path.join(local, 'FiveM', 'FiveM.app', 'FiveM.exe')
    ] },
    { id: 'roblox', name: 'Roblox', paths: [
      newestIn(path.join(local, 'Roblox', 'Versions'), /RobloxPlayerBeta\.exe$/i),
      path.join(local, 'Roblox', 'Versions', 'RobloxPlayerBeta.exe')
    ] },
    { id: 'valorant', name: 'Valorant', paths: [
      path.join(pf86, 'Riot Games', 'VALORANT', 'live', 'VALORANT.exe'),
      'C:\\Riot Games\\VALORANT\\live\\VALORANT.exe',
      path.join(pf86, 'Riot Games', 'Riot Client', 'RiotClientServices.exe')
    ] },
    { id: 'league', name: 'League of Legends', paths: [
      'C:\\Riot Games\\League of Legends\\LeagueClient.exe',
      path.join(pf86, 'Riot Games', 'League of Legends', 'LeagueClient.exe')
    ] },
    { id: 'obs', name: 'OBS Studio', paths: [
      path.join(pf, 'obs-studio', 'bin', '64bit', 'obs64.exe'),
      path.join(pf86, 'obs-studio', 'bin', '64bit', 'obs64.exe')
    ] },
    { id: 'discord', name: 'Discord', paths: [
      newestIn(path.join(local, 'Discord'), /Discord\.exe$/i),
      path.join(local, 'Discord', 'Update.exe')
    ] },
    { id: 'steam', name: 'Steam', paths: [
      path.join(pf86, 'Steam', 'steam.exe'),
      path.join(pf, 'Steam', 'steam.exe')
    ] },
    { id: 'epic', name: 'Epic Games Launcher', paths: [
      path.join(pf86, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe'),
      path.join(pf, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe')
    ] },
    { id: 'spotify', name: 'Spotify', paths: [
      path.join(local, 'Microsoft', 'WindowsApps', 'Spotify.exe'),
      path.join(appDataRoaming(), 'Spotify', 'Spotify.exe')
    ] }
  ];
  const items = [];
  for (const app of known) {
    const p = (app.paths || []).find(exists);
    if (!p) continue;
    items.push({
      id: 'app-' + app.id,
      name: app.name,
      path: p,
      platform: 'app',
      artworkPath: null,
      source: 'known'
    });
  }
  return items;
}

function appDataRoaming() {
  return process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
}

function scanStartMenuLimited() {
  const roots = [
    path.join(appDataRoaming(), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ];
  const items = [];
  const seen = new Set();
  const walk = (dir, depth) => {
    if (depth > 2 || items.length >= 24) return;
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (_) { return; }
    for (const name of entries) {
      if (items.length >= 24) return;
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (st.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!/\.lnk$/i.test(name)) continue;
      if (/uninstall|ajuda|help|readme|website/i.test(name)) continue;
      const label = name.replace(/\.lnk$/i, '');
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: 'lnk-' + key.replace(/[^a-z0-9]+/g, '-').slice(0, 40),
        name: label,
        path: full,
        platform: 'app',
        artworkPath: null,
        source: 'startmenu'
      });
    }
  };
  roots.forEach((r) => walk(r, 0));
  return items;
}

function dedupe(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = (item.path || item.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function listLibrary(opts = {}) {
  const now = Date.now();
  if (!opts.force && cache.items && now - cache.ts < CACHE_MS) return cache.items;
  const items = dedupe([
    ...scanSteam(),
    ...scanEpic(),
    ...scanKnown(),
    ...scanStartMenuLimited()
  ]);
  cache = { ts: now, items };
  return items;
}

function resolveShortcut(exePath) {
  const p = String(exePath || '');
  if (!/\.lnk$/i.test(p) || !exists(p)) return p;
  try {
    const { shell } = require('electron');
    if (shell && typeof shell.readShortcutLink === 'function') {
      const info = shell.readShortcutLink(p);
      if (info && info.target && exists(info.target)) return info.target;
    }
  } catch (_) { /* ok */ }
  return p;
}

function iconCacheDir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) return path.join(app.getPath('userData'), 'gameboost', 'icons');
  } catch (_) { /* preview */ }
  return path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'sevenoptimizer', 'gameboost', 'icons');
}

function artworkCacheDir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) return path.join(app.getPath('userData'), 'gameboost', 'artwork');
  } catch (_) { /* preview */ }
  return path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'sevenoptimizer', 'gameboost', 'artwork');
}

function fileHash(p, mtime) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(String(p) + ':' + String(mtime)).digest('hex');
}

function pathToMediaUrl(p) {
  const abs = path.resolve(String(p));
  return 's4-media://local/' + Buffer.from(abs, 'utf8').toString('base64url');
}

// Diretórios que o protocolo s4-media tem permissão de servir (allow-list).
// Impede que um renderer comprometido (ex.: falha de sanitização de URL) use
// o protocolo para ler arquivos arbitrários do disco (bypassCSP amplifica o risco).
function allowedMediaRoots() {
  const roots = [];
  const { app } = require('electron');
  try {
    if (app && app.isReady()) roots.push(path.resolve(app.getPath('userData')));
  } catch (_) { /* pré-ready */ }
  if (process.env.LOCALAPPDATA) roots.push(path.resolve(process.env.LOCALAPPDATA, 'sevenoptimizer'));
  if (process.env.TEMP) roots.push(path.resolve(process.env.TEMP, 'sevenoptimizer'));
  if (process.resourcesPath) roots.push(path.resolve(process.resourcesPath));
  roots.push(path.resolve(__dirname, '..', '..')); // pasta do projeto (dev) / conteúdo do pacote
  return roots;
}

function resolveMediaUrl(url) {
  const raw = String(url || '');
  const m = /^s4-media:\/\/local\/([A-Za-z0-9_-]+)$/.exec(raw);
  if (!m) return null;
  let abs;
  try {
    abs = Buffer.from(m[1], 'base64url').toString('utf8');
  } catch (_) {
    return null;
  }
  const resolved = path.resolve(abs);
  const roots = allowedMediaRoots();
  const inside = roots.some((r) => resolved === r || resolved.startsWith(r + path.sep));
  return inside ? resolved : null;
}

async function getIconDataUrl(exePath) {
  const raw = String(exePath || '');

  // Atalho Steam: o caminho é steam://rungameid/<appId>, não um .exe. Busca o
  // ícone/logo real no cache da Steam e copia para a pasta do app (allow-list).
  const steamMatch = /^steam:\/\/rungameid\/(\d+)/i.exec(raw);
  if (steamMatch) {
    const icon = steamIconPath(steamMatch[1]);
    if (!icon) return { ok: false, dataUrl: null };
    const cached = cacheMediaFile(icon, iconCacheDir());
    if (!cached) return { ok: false, dataUrl: null };
    return { ok: true, dataUrl: null, fileUrl: pathToMediaUrl(cached) };
  }

  const resolved = resolveShortcut(raw);
  if (!resolved || !exists(resolved)) {
    return { ok: false, dataUrl: null };
  }
  let st;
  try { st = fs.statSync(resolved); } catch (_) { return { ok: false, dataUrl: null }; }
  const dir = iconCacheDir();
  const cacheFile = path.join(dir, fileHash(resolved, st.mtimeMs) + '.png');
  if (exists(cacheFile)) {
    return { ok: true, dataUrl: null, fileUrl: pathToMediaUrl(cacheFile) };
  }
  try {
    const { app } = require('electron');
    const img = await app.getFileIcon(resolved, { size: 'normal' });
    const png = img.toPNG();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile, png);
    return { ok: true, dataUrl: null, fileUrl: pathToMediaUrl(cacheFile) };
  } catch (_) {
    return { ok: false, dataUrl: null };
  }
}

// Ícone/logo real de um app Steam a partir do cache local da própria Steam.
function steamIconPath(appId) {
  const root = steamRoot();
  if (!root || !appId) return null;
  const cacheDir = path.join(root, 'appcache', 'librarycache');
  const candidates = [
    path.join(cacheDir, appId + '_icon.jpg'),
    path.join(cacheDir, appId + '_icon.png'),
    path.join(cacheDir, appId, 'logo.png'),
    path.join(cacheDir, appId + '_header.jpg'),
    path.join(cacheDir, appId + '_library_600x900.jpg')
  ];
  return candidates.find(exists) || null;
}

// Copia um arquivo de mídia (ícone/capa) para uma pasta do app e devolve o
// caminho copiado. O protocolo s4-media só serve arquivos dentro das raízes
// permitidas (allowedMediaRoots); capas da Steam/Epic ficam fora delas.
function cacheMediaFile(srcPath, destDir) {
  if (!exists(srcPath)) return null;
  let st;
  try { st = fs.statSync(srcPath); } catch (_) { return null; }
  const ext = path.extname(srcPath) || '.img';
  const dest = path.join(destDir, fileHash(srcPath, st.mtimeMs) + ext);
  if (exists(dest)) return dest;
  try {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, dest);
    return dest;
  } catch (_) {
    return null;
  }
}

function getArtworkDataUrl(artworkPath) {
  const p = String(artworkPath || '');
  if (!exists(p)) return { ok: false, dataUrl: null };
  const cached = cacheMediaFile(p, artworkCacheDir());
  if (!cached) return { ok: false, dataUrl: null };
  return { ok: true, dataUrl: null, fileUrl: pathToMediaUrl(cached) };
}

function warmupLibrary() {
  try { listLibrary(); } catch (_) { /* ok */ }
}

module.exports = {
  listLibrary,
  getIconDataUrl,
  getArtworkDataUrl,
  resolveShortcut,
  resolveMediaUrl,
  warmupLibrary,
  parseLibraryFolders,
  parseAppManifest,
  pathToMediaUrl,
  dedupe
};
