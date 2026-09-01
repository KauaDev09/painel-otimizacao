'use strict';

// Script único de manutenção: corrige url_download do registro de atualização
// ATIVO apontando para o asset canônico do GitHub Releases.
// Uso: node backend/scripts/fix-update-url.js
// Requer as variáveis do .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME...).

const path = require('path');
const { loadEnv } = require(path.join(__dirname, '..', 'src', 'loadEnv'));
loadEnv();

const mysql = require('mysql2/promise');

const TARGET_VERSION = '2.0.2';
const CANONICAL_URL =
  'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.0.2/ORION-OPTIMIZER-Setup-2.0.2.exe';

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });

  const [rows] = await conn.query(
    'SELECT id, versao, url_download, ativa FROM atualizacoes WHERE ativa = 1 ORDER BY id DESC LIMIT 1'
  );

  if (!rows.length) {
    console.log('[fix] Nenhuma atualização ativa encontrada — nada a fazer.');
    await conn.end();
    return;
  }

  const row = rows[0];
  console.log(`[fix] Ativa encontrada: id=${row.id} versao=${row.versao}`);
  console.log(`[fix] URL atual: ${row.url_download}`);

  if (row.versao !== TARGET_VERSION) {
    console.log(`[fix] A versão ativa não é ${TARGET_VERSION} — apenas informe a URL correta no painel admin.`);
    await conn.end();
    return;
  }

  if (row.url_download === CANONICAL_URL) {
    console.log('[fix] URL já está correta — nada a fazer.');
    await conn.end();
    return;
  }

  await conn.query('UPDATE atualizacoes SET url_download = ? WHERE id = ?', [CANONICAL_URL, row.id]);
  console.log(`[fix] URL atualizada para: ${CANONICAL_URL}`);
  await conn.end();
  console.log('[fix] Concluído.');
})().catch((err) => {
  console.error('[fix] Erro:', err.message);
  process.exit(1);
});