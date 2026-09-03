-- ORION OPTIMIZER — Migration 003: SaaS (planos, pedidos, licenças por plano,
-- downloads, ativações e webhooks). Não destrói dados existentes.
-- Banco: bios_optimizer (MySQL 8 / TiDB compatível).
--
-- Aplicar:  node backend/scripts/migrate-saas.js   (recomendado — idempotente)
-- Ou manualmente com o conteudo abaixo.

USE bios_optimizer;

-- ---------- Planos ----------------
CREATE TABLE IF NOT EXISTS plans (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  slug          VARCHAR(80)  NOT NULL UNIQUE,
  description   TEXT NULL,
  price         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency      CHAR(3)      NOT NULL DEFAULT 'BRL',
  billing_type  VARCHAR(20)  NOT NULL DEFAULT 'one_time', -- one_time | subscription
  features      JSON NOT NULL,                              -- ["system_monitoring","fps_boost",...]
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plans_active (active),
  INDEX idx_plans_sort (sort_order)
) ENGINE=InnoDB;

-- ---------- Pedidos ----------------
CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_uuid       VARCHAR(40)  NOT NULL UNIQUE,     -- token público de checkout
  user_id          INT UNSIGNED NULL,
  plan_id          INT UNSIGNED NULL,
  plan_name        VARCHAR(80)  NULL,                -- snapshot no momento da compra
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
) ENGINE=InnoDB;

-- ---------- Pagamentos ----------
-- Já existe a tabela `pagamentos`. Adicionamos colunas para pedido/provedor.
-- Migramos de forma idempotente (MySQL/TiDB não têm IF NOT EXISTS em ADD COLUMN
-- em versões antigas — usamos stored procedure com checagem de information_schema).

-- ---------- Downloads (releases) ----------
CREATE TABLE IF NOT EXISTS downloads (
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
) ENGINE=InnoDB;

-- ---------- Ativações de licença (histórico por dispositivo) ----------
-- A tabela `ativacoes` já existe. Criamos license_activations dedicada como
-- pede a especificação, além de `dispositivos` existente.
CREATE TABLE IF NOT EXISTS license_activations (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_id     INT UNSIGNED NOT NULL,
  device_id      VARCHAR(64)  NULL,
  activated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash        VARCHAR(64)  NULL,
  CONSTRAINT fk_la_license FOREIGN KEY (license_id) REFERENCES licencas(id) ON DELETE CASCADE,
  INDEX idx_la_license (license_id),
  INDEX idx_la_device (device_id)
) ENGINE=InnoDB;

-- ---------- Eventos de webhook de pagamento ----------
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider       VARCHAR(40) NOT NULL,
  event_id       VARCHAR(120) NULL,       -- fornecido pelo gateway (idempotência)
  event_type     VARCHAR(80)  NULL,
  payload        JSON NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'received',  -- received | processed | error
  processed_at   DATETIME NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wh_event (provider, event_id)
) ENGINE=InnoDB;

-- ---------- Colunas adicionais em licencas (SaaS) ----------
-- plano_id, plano_slug, features derivado do plano + features_json armazenado
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'licencas' AND column_name = 'plan_slug');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE licencas ADD COLUMN plan_slug VARCHAR(80) NULL AFTER plano',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'licencas' AND column_name = 'order_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE licencas ADD COLUMN order_id INT UNSIGNED NULL AFTER plan_slug',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'licencas' AND column_name = 'activation_count');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE licencas ADD COLUMN activation_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER plan_slug',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'licencas' AND column_name = 'last_validation_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE licencas ADD COLUMN last_validation_at DATETIME NULL AFTER plan_slug',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- Colunas em pagamentos para pedido/provedor estruturado ----
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'pagamentos' AND column_name = 'order_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pagamentos ADD COLUMN order_id INT UNSIGNED NULL AFTER licenca_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'pagamentos' AND column_name = 'provider_payment_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pagamentos ADD COLUMN provider_payment_id VARCHAR(120) NULL AFTER ref_externa',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'pagamentos' AND column_name = 'raw_status');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE pagamentos ADD COLUMN raw_status VARCHAR(80) NULL AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- Seeds de planos (apenas se a tabela estiver vazia) ----------
INSERT INTO plans (name, slug, description, price, currency, billing_type, features, active, sort_order)
SELECT * FROM (
  SELECT 'STARTER' AS name, 'starter' AS slug,
         'Base de monitoramento e limpeza essencial.' AS description,
         29.90 AS price, 'BRL' AS currency, 'subscription' AS billing_type,
         JSON_ARRAY('system_monitoring','basic_cleanup','basic_fps_boost') AS features,
         1 AS active, 1 AS sort_order
  UNION ALL SELECT 'PRO','pro','Monitoramento completo, limpeza avançada e FPS Boost.',59.90,'BRL','subscription',
         JSON_ARRAY('system_monitoring','basic_cleanup','advanced_cleanup','fps_boost','gaming_mode','process_optimizer','startup_optimizer'),1,2
  UNION ALL SELECT 'ULTRA','ultra','Tudo do PRO + otimizador de BIOS, XMP e telemetria em tempo real.',99.90,'BRL','subscription',
         JSON_ARRAY('system_monitoring','basic_cleanup','advanced_cleanup','fps_boost','gaming_mode','process_optimizer','startup_optimizer','bios_optimizer','xmp_optimizer','advanced_memory_optimizer','advanced_windows_optimizer','realtime_telemetry','priority_features'),1,3
) AS s
WHERE NOT EXISTS (SELECT 1 FROM plans);

-- Cache das colunas da tabela licencas vem do schema.sql atual; nada a mais aqui.
