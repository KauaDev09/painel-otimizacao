'use strict';

// Aplica a Migration 007: tabelas da SevenIA (plano_ia + uso_ia).
// Uso: node scripts/migrate-007-sevenia.js  (na pasta backend/)

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS plano_ia (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        plano ENUM('free','pro') NOT NULL DEFAULT 'free',
        data_ativacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('[ok] tabela plano_ia garantida.');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS uso_ia (
        user_id BIGINT UNSIGNED NOT NULL,
        data DATE NOT NULL,
        contador_mensagens INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, data)
      ) ENGINE=InnoDB
    `);
    console.log('[ok] tabela uso_ia garantida.');

    console.log('\nMigration 007 aplicada com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha na migration:', err.message);
  process.exit(1);
});