'use strict';

// Migração idempotente do SaaS (planos, pedidos, downloads, ativações e
// webhooks) para licenciamento por plano. Não apaga dados.
// Uso: node scripts/migrate-saas.js  (na pasta backend/)

const crypto = require('crypto');
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

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
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

function featuresArr(plano) {
  const all = [
    'system_monitoring', 'basic_cleanup', 'advanced_cleanup', 'fps_boost',
    'gaming_mode', 'process_optimizer', 'startup_optimizer', 'bios_optimizer',
    'xmp_optimizer', 'advanced_memory_optimizer', 'advanced_windows_optimizer',
    'realtime_telemetry', 'priority_features'
  ];
  const map = {
    starter: ['system_monitoring', 'basic_cleanup', 'basic_fps_boost'],
    pro: ['system_monitoring', 'basic_cleanup', 'advanced_cleanup', 'fps_boost', 'gaming_mode', 'process_optimizer', 'startup_optimizer'],
    ultra: all
  };
  return map[plano] || all;
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
    // ---- plans ----
    if (!(await tableExists(conn, 'plans'))) {
      await conn.execute(`
        CREATE TABLE plans (
          id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          name          VARCHAR(80)  NOT NULL,
          slug          VARCHAR(80)  NOT NULL UNIQUE,
          description   TEXT NULL,
          price         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          currency      CHAR(3)      NOT NULL DEFAULT 'BRL',
          billing_type  VARCHAR(20)  NOT NULL DEFAULT 'one_time',
          features      JSON NOT NULL,
          active        TINYINT(1)   NOT NULL DEFAULT 1,
          sort_order    INT UNSIGNED NOT NULL DEFAULT 0,
          created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_plans_active (active),
          INDEX idx_plans_sort (sort_order)
        ) ENGINE=InnoDB
      `);
      console.log('[ok] tabela plans criada');
    } else {
      console.log('[skip] plans já existe');
    }

    // Seeds de planos
    const [count] = await conn.execute('SELECT COUNT(*) AS n FROM plans');
    if (count[0].n === 0) {
      const defs = [
        ['STARTER', 'starter', 'Monitoramento e limpeza essencial para o dia a dia.', 19.99, '["system_monitoring","basic_cleanup","basic_fps_boost"]', 1],
        ['PRO', 'pro', 'Monitoramento completo, limpeza avançada e FPS Boost.', 39.99, '["system_monitoring","basic_cleanup","advanced_cleanup","fps_boost","gaming_mode","process_optimizer","startup_optimizer"]', 2],
        ['ULTRA', 'ultra', 'Tudo do PRO + otimizador de BIOS, XMP e telemetria em tempo real.', 69.99, '["system_monitoring","basic_cleanup","advanced_cleanup","fps_boost","gaming_mode","process_optimizer","startup_optimizer","bios_optimizer","xmp_optimizer","advanced_memory_optimizer","advanced_windows_optimizer","realtime_telemetry","priority_features"]', 3]
      ];
      for (const d of defs) {
        await conn.execute(
          'INSERT INTO plans (name, slug, description, price, billing_type, features, active, sort_order) VALUES (?,?,?,?,?,?,1,?)',
          [d[0], d[1], d[2], d[3], 'one_time', d[4], d[5]]
        );
      }
      console.log('[ok] planos seeds inseridos');
    } else {
      console.log('[skip] plans já populada');
    }

    // ---- orders ----
    if (!(await tableExists(conn, 'orders'))) {
      await conn.execute(`
        CREATE TABLE orders (
          id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          order_uuid       VARCHAR(40)  NOT NULL UNIQUE,
          user_id          INT UNSIGNED NULL,
          plan_id          INT UNSIGNED NULL,
          plan_name        VARCHAR(80)  NULL,
          amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
          currency         CHAR(3)      NOT NULL DEFAULT 'BRL',
          status           ENUM('pending','paid','failed','expired','refunded') NOT NULL DEFAULT 'pending',
          payment_provider VARCHAR(40)  NULL,
          payment_id       VARCHAR(120) NULL,
          created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
          CONSTRAINT fk_orders_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL,
          INDEX idx_orders_user (user_id),
          INDEX idx_orders_status (status),
          INDEX idx_orders_payment (payment_id)
        ) ENGINE=InnoDB
      `);
      console.log('[ok] tabela orders criada');
    } else {
      console.log('[skip] orders já existe');
    }

    // ---- downloads ----
    if (!(await tableExists(conn, 'downloads'))) {
      await conn.execute(`
        CREATE TABLE downloads (
          id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          version        VARCHAR(20)  NOT NULL,
          filename       VARCHAR(255) NOT NULL,
          url            VARCHAR(500) NOT NULL,
          release_notes  TEXT NULL,
          is_latest      TINYINT(1)   NOT NULL DEFAULT 0,
          active         TINYINT(1)   NOT NULL DEFAULT 1,
          created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_dl_latest (is_latest),
          UNIQUE KEY uq_dl_version (version)
        ) ENGINE=InnoDB
      `);
      console.log('[ok] tabela downloads criada');
    } else {
      console.log('[skip] downloads já existe');
    }

    const [dlCount] = await conn.execute('SELECT COUNT(*) AS n FROM downloads');
    if (dlCount[0].n === 0) {
      await conn.execute(
        'INSERT INTO downloads (version, filename, url, release_notes, is_latest, active) VALUES (?,?,?,?,1,1)',
        [
          '2.0.3',
          'ORION.OPTIMIZER.Setup-2.0.3.exe',
          'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.0.3/ORION.OPTIMIZER.Setup-2.0.3.exe',
          'Instalador oficial para Windows 10/11. Use o aplicativo grátis, sem chave. Os planos desbloqueiam recursos avançados.'
        ]
      );
      console.log('[ok] download público 2.0.3 inserido');
    } else {
      console.log('[skip] downloads já populada');
    }

    // ---- license_activations ----
    if (!(await tableExists(conn, 'license_activations'))) {
      await conn.execute(`
        CREATE TABLE license_activations (
          id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          license_id     INT UNSIGNED NOT NULL,
          device_id      VARCHAR(64)  NULL,
          activated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ip_hash        VARCHAR(64)  NULL,
          CONSTRAINT fk_la_license FOREIGN KEY (license_id) REFERENCES licencas(id) ON DELETE CASCADE,
          INDEX idx_la_license (license_id),
          INDEX idx_la_device (device_id)
        ) ENGINE=InnoDB
      `);
      console.log('[ok] tabela license_activations criada');
    } else {
      console.log('[skip] license_activations já existe');
    }

    // ---- payment_webhook_events ----
    if (!(await tableExists(conn, 'payment_webhook_events'))) {
      await conn.execute(`
        CREATE TABLE payment_webhook_events (
          id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          provider       VARCHAR(40) NOT NULL,
          event_id       VARCHAR(120) NULL,
          event_type     VARCHAR(80)  NULL,
          payload        JSON NULL,
          status         VARCHAR(20)  NOT NULL DEFAULT 'received',
          processed_at   DATETIME NULL,
          created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_wh_event (provider, event_id)
        ) ENGINE=InnoDB
      `);
      console.log('[ok] tabela payment_webhook_events criada');
    } else {
      console.log('[skip] payment_webhook_events já existe');
    }

    // ---- colunas em licencas ----
    for (const [col, ddl] of [
      ['plan_slug', 'ALTER TABLE licencas ADD COLUMN plan_slug VARCHAR(80) NULL AFTER plano'],
      ['order_id', 'ALTER TABLE licencas ADD COLUMN order_id INT UNSIGNED NULL AFTER plan_slug'],
      ['activation_count', 'ALTER TABLE licencas ADD COLUMN activation_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER plan_slug'],
      ['last_validation_at', 'ALTER TABLE licencas ADD COLUMN last_validation_at DATETIME NULL AFTER plan_slug']
    ]) {
      if (!(await columnExists(conn, 'licencas', col))) {
        await conn.execute(ddl);
        console.log('[ok] coluna licencas.' + col + ' criada');
      } else {
        console.log('[skip] licencas.' + col + ' já existe');
      }
    }

    // ---- colunas em pagamentos ----
    for (const [col, ddl] of [
      ['order_id', 'ALTER TABLE pagamentos ADD COLUMN order_id INT UNSIGNED NULL AFTER licenca_id'],
      ['provider_payment_id', 'ALTER TABLE pagamentos ADD COLUMN provider_payment_id VARCHAR(120) NULL AFTER ref_externa'],
      ['raw_status', 'ALTER TABLE pagamentos ADD COLUMN raw_status VARCHAR(80) NULL AFTER status']
    ]) {
      if (!(await columnExists(conn, 'pagamentos', col))) {
        await conn.execute(ddl);
        console.log('[ok] coluna pagamentos.' + col + ' criada');
      } else {
        console.log('[skip] pagamentos.' + col + ' já existe');
      }
    }

    console.log('[ok] migração SaaS concluída');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[erro]', err.message || err);
  process.exit(1);
});
