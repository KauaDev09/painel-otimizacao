'use strict';

// Migration 006: novos preços dos planos + instalador público na loja.
// Uso: node scripts/migrate-006-plan-prices.js  (na pasta backend/)

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');

const PRICES = [
  ['starter', 19.99],
  ['pro', 39.99],
  ['ultra', 69.99]
];

const INSTALLER = {
  version: '2.0.3',
  filename: 'ORION.OPTIMIZER.Setup-2.0.3.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.0.3/ORION.OPTIMIZER.Setup-2.0.3.exe',
  notes: 'Instalador oficial para Windows 10/11. Use o aplicativo grátis, sem chave. Os planos desbloqueiam recursos avançados.'
};

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });

  try {
    for (const [slug, price] of PRICES) {
      const [res] = await conn.execute('UPDATE plans SET price = ? WHERE slug = ?', [price, slug]);
      console.log(`[ok] ${slug} -> R$ ${price.toFixed(2)} (${res.affectedRows || 0} linha)`);
    }

    const [plans] = await conn.execute('SELECT id, name, slug, price FROM plans ORDER BY sort_order ASC, id ASC');
    console.log('\nPlanos:');
    for (const p of plans) console.log(`  ${p.name} (${p.slug}) -> R$ ${Number(p.price).toFixed(2)}`);

    const [tables] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'downloads'`
    );
    if (Number(tables[0].n) > 0) {
      await conn.execute('UPDATE downloads SET is_latest = 0 WHERE is_latest = 1 AND version <> ?', [INSTALLER.version]);
      const [existing] = await conn.execute('SELECT id FROM downloads WHERE version = ? LIMIT 1', [INSTALLER.version]);
      if (existing.length) {
        await conn.execute(
          'UPDATE downloads SET filename = ?, url = ?, release_notes = ?, is_latest = 1, active = 1 WHERE id = ?',
          [INSTALLER.filename, INSTALLER.url, INSTALLER.notes, existing[0].id]
        );
        console.log(`\n[ok] download v${INSTALLER.version} atualizado`);
      } else {
        await conn.execute(
          'INSERT INTO downloads (version, filename, url, release_notes, is_latest, active) VALUES (?,?,?,?,1,1)',
          [INSTALLER.version, INSTALLER.filename, INSTALLER.url, INSTALLER.notes]
        );
        console.log(`\n[ok] download v${INSTALLER.version} inserido`);
      }
    } else {
      console.log('\n[warn] tabela downloads não existe — rode migrate-saas.js antes.');
    }

    console.log('\nMigration 006 aplicada com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha na migration:', err.message);
  process.exit(1);
});
