'use strict';

// Migração idempotente: licença vitalícia (expira_em NULL), versão autorizada
// e atualizações pagas. Não apaga dados.
// Uso: node scripts/migrate-store-integration.js  (na pasta backend/)

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].n > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].n > 0;
}

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
    await conn.execute('ALTER TABLE licencas MODIFY COLUMN expira_em DATETIME NULL');
    console.log('[ok] licencas.expira_em agora aceita NULL (vitalício)');

    if (!(await columnExists(conn, 'licencas', 'versao_autorizada'))) {
      await conn.execute(
        'ALTER TABLE licencas ADD COLUMN versao_autorizada VARCHAR(20) NULL AFTER observacao'
      );
      console.log('[ok] coluna licencas.versao_autorizada criada');
    } else {
      console.log('[skip] licencas.versao_autorizada já existe');
    }

    if (!(await columnExists(conn, 'licencas', 'pedido_loja'))) {
      await conn.execute(
        'ALTER TABLE licencas ADD COLUMN pedido_loja VARCHAR(64) NULL AFTER versao_autorizada'
      );
      console.log('[ok] coluna licencas.pedido_loja criada');
    } else {
      console.log('[skip] licencas.pedido_loja já existe');
    }

    if (!(await columnExists(conn, 'atualizacoes', 'exige_pagamento'))) {
      await conn.execute(
        'ALTER TABLE atualizacoes ADD COLUMN exige_pagamento TINYINT(1) NOT NULL DEFAULT 0 AFTER obrigatoria'
      );
      console.log('[ok] coluna atualizacoes.exige_pagamento criada');
    } else {
      console.log('[skip] atualizacoes.exige_pagamento já existe');
    }

    if (!(await columnExists(conn, 'atualizacoes', 'preco'))) {
      await conn.execute(
        'ALTER TABLE atualizacoes ADD COLUMN preco DECIMAL(10,2) NOT NULL DEFAULT 15.00 AFTER exige_pagamento'
      );
      console.log('[ok] coluna atualizacoes.preco criada');
    } else {
      console.log('[skip] atualizacoes.preco já existe');
    }

    if (!(await indexExists(conn, 'pagamentos', 'uq_pag_ref_externa'))) {
      await conn.execute(
        'ALTER TABLE pagamentos ADD UNIQUE INDEX uq_pag_ref_externa (ref_externa)'
      );
      console.log('[ok] índice único pagamentos.ref_externa criado');
    } else {
      console.log('[skip] índice uq_pag_ref_externa já existe');
    }

    console.log('[ok] migração de integração com a loja concluída');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[erro]', err.message || err);
  process.exit(1);
});
