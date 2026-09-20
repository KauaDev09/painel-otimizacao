'use strict';

// Aplica a Migration 008: produto SevenIA Pro (coluna plans.product_type,
// coluna plano_ia.order_id e o plano 'sevenia_pro' seedado).
// Uso: node scripts/migrate-008-sevenia-pro.js  (na pasta backend/)

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
    // 1) plans.product_type ('license' | 'sevenia').
    let [cols] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'product_type'`
    );
    if (Number(cols[0].n) === 0) {
      await conn.execute("ALTER TABLE plans ADD COLUMN product_type ENUM('license','sevenia') NOT NULL DEFAULT 'license' AFTER billing_type");
      console.log('[ok] coluna plans.product_type adicionada.');
    } else {
      console.log('[skip] coluna plans.product_type já existe.');
    }

    // 2) plano_ia.order_id (auditoria do pedido que ativou/renovou o Pro).
    [cols] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plano_ia' AND COLUMN_NAME = 'order_id'`
    );
    if (Number(cols[0].n) === 0) {
      await conn.execute('ALTER TABLE plano_ia ADD COLUMN order_id INT UNSIGNED NULL AFTER data_ativacao');
      console.log('[ok] coluna plano_ia.order_id adicionada.');
    } else {
      console.log('[skip] coluna plano_ia.order_id já existe.');
    }

    // 3) Seed do produto SevenIA Pro (uma única vez).
    const [existing] = await conn.execute("SELECT COUNT(*) AS n FROM plans WHERE slug = 'sevenia_pro'");
    if (Number(existing[0].n) === 0) {
      await conn.execute(`
        INSERT INTO plans (name, slug, description, price, currency, billing_type, product_type, features, active, sort_order)
        VALUES ('SEVENIA PRO', 'sevenia_pro',
                'Assistente de IA com resposta por IA generativa, análise do laudo do sistema e sugestões de otimização. Pagamento único.',
                19.90, 'BRL', 'one_time', 'sevenia',
                JSON_ARRAY('sevenia_pro_ai_chat'), 1, 10)
      `);
      console.log('[ok] plano sevenia_pro criado.');
    } else {
      console.log('[skip] plano sevenia_pro já existe.');
    }

    const [plans] = await conn.execute("SELECT id, slug, product_type FROM plans WHERE product_type = 'sevenia'");
    console.log(`\nProdutos sevenia cadastrados: ${plans.length || 0}`);
    console.log('\nMigration 008 aplicada com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha na migration:', err.message);
  process.exit(1);
});