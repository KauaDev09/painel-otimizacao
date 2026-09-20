'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveMediaUrl,
  pathToMediaUrl,
  parseLibraryFolders,
  parseAppManifest,
  dedupe
} = require('../src/modules/appLibrary');

test('parseLibraryFolders: extrai paths do libraryfolders.vdf', () => {
  const vdf = '"path" "D:\\\\Games"\r\n"path" "E:\\Biblioteca"';
  assert.deepStrictEqual(parseLibraryFolders(vdf), ['D:\\Games', 'E:\\Biblioteca']);
  assert.deepStrictEqual(parseLibraryFolders(''), []);
});

test('parseAppManifest: extrai campos do .acf', () => {
  const acf = '"appid" "123456"\r\n"name" "Game X"\r\n"installdir" "gamex"';
  assert.deepStrictEqual(parseAppManifest(acf), {
    appId: '123456',
    name: 'Game X',
    installDir: 'gamex'
  });
  assert.strictEqual(parseAppManifest('"appid" "7"').appId, '7');
  assert.strictEqual(parseAppManifest('').name, null);
});

test('dedupe: remove duplicatas por caminho/nome', () => {
  const items = [
    { path: 'C:\\a\\b.exe', name: 'B' },
    { path: 'C:\\a\\b.exe', name: 'B duplicado' },
    { name: 'só nome' }
  ];
  assert.strictEqual(dedupe(items).length, 2);
});

test('resolveMediaUrl: serve apenas dentro das raízes permitidas', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 's7-media-'));
  const local = path.join(base, 'local');
  const temp = path.join(base, 'temp');
  fs.mkdirSync(path.join(local, 'sevenoptimizer'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'sevenoptimizer'), { recursive: true });
  const previous = { lap: process.env.LOCALAPPDATA, tmp: process.env.TEMP };
  process.env.LOCALAPPDATA = local;
  process.env.TEMP = temp;

  try {
    const inside = path.join(local, 'sevenoptimizer', 'ok.jpg');
    fs.writeFileSync(inside, 'x');
    const url = pathToMediaUrl(inside);
    assert.strictEqual(typeof url, 'string');
    assert.match(url, /^s4-media:\/\/local\//);
    assert.strictEqual(resolveMediaUrl(url), inside);

    // Fora das raízes → null (não serve arquivo arbitrário).
    const outside = path.join(base, 'outside', 'secret.txt');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'segredo');
    assert.strictEqual(resolveMediaUrl(pathToMediaUrl(outside)), null);
  } finally {
    if (previous.lap) process.env.LOCALAPPDATA = previous.lap; else delete process.env.LOCALAPPDATA;
    if (previous.tmp) process.env.TEMP = previous.tmp; else delete process.env.TEMP;
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('resolveMediaUrl: formato inválido retorna null', () => {
  assert.strictEqual(resolveMediaUrl(''), null);
  assert.strictEqual(resolveMediaUrl('s4-media://local/!!invalid!!'), null);
  assert.strictEqual(resolveMediaUrl('https://example.com/x'), null);
});