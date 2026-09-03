'use strict';

// Aplica a Migration 005: cria a tabela de cupons de desconto e as colunas
// coupon_id/discount_percent em orders.
// Uso: node scripts/migrate-005-coupons.js  (na pasta backend/)

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
    // 1) Tabela de cupons.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code           VARCHAR(60)  NOT NULL UNIQUE,
        discount_type  VARCHAR(10)  NOT NULL DEFAULT 'percent',
        discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        description    VARCHAR(255) NULL,
        active         TINYINT(1)   NOT NULL DEFAULT 1,
        max_uses       INT UNSIGNED NULL,
        used_count     INT UNSIGNED NOT NULL DEFAULT 0,
        expires_at     DATETIME NULL,
        created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_coupons_active (active),
        INDEX idx_coupons_code (code)
      ) ENGINE=InnoDB
    `);
    console.log('[ok] tabela coupons garantida.');

    // 2) Colunas em orders.
    for (const [col, ddl] of [
      ['coupon_id', 'ALTER TABLE orders ADD COLUMN coupon_id INT UNSIGNED NULL AFTER plan_name'],
      ['discount_percent', 'ALTER TABLE orders ADD COLUMN discount_percent DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_id']
    ]) {
      const [cols] = await conn.execute(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = ?`,
        [col]
      );
      if (Number(cols[0].n) === 0) {
        await conn.execute(ddl);
        console.log(`[ok] coluna orders.${col} adicionada.`);
      } else {
        console.log(`[skip] coluna orders.${col} já existe.`);
      }
    }

    const [coupons] = await conn.execute('SELECT COUNT(*) AS n FROM coupons');
    console.log(`\nCupons cadastrados: ${coupons[0].n || 0}`);
    console.log('\nMigration 005 aplicada com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha na migration:', err.message);
  process.exit(1);
});
