'use strict';

// Cria um administrador do painel: node scripts/create-admin.js <usuario> <senha>
// A senha é armazenada como scrypt:salt:hash — nunca em texto puro.

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');
const { hashPassword } = require('../src/util');

async function main() {
  loadEnv();
  const [usuario, senha] = process.argv.slice(2);
  if (!usuario || !senha) {
    console.error('Uso: node scripts/create-admin.js <usuario> <senha>');
    process.exit(1);
  }

  // Configuração direta por env (mesmas variáveis do servidor).
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer'
  });

  try {
    await conn.execute(
      `INSERT INTO administradores (usuario, senha_hash) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash), ativo = 1`,
      [usuario, hashPassword(senha)]
    );
    console.log(`[ok] Administrador "${usuario}" criado/atualizado.`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[erro]', err.message);
  process.exit(1);
});
