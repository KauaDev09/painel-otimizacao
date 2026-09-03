-- ORION OPTIMIZER — Migration 005: Cupons de desconto.
-- Tabela para cupons de desconto criados no painel administrativo.
-- Banco: bios_optimizer (MySQL 8 / TiDB compatível).
--
-- Aplicar:  node backend/scripts/migrate-005-coupons.js   (recomendado — idempotente)

USE bios_optimizer;

CREATE TABLE IF NOT EXISTS coupons (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(60)  NOT NULL UNIQUE,          -- nome/código do cupom (maiúsculo)
  discount_type VARCHAR(10)  NOT NULL DEFAULT 'percent', -- percent (atualmente apenas percentual)
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,     -- porcentagem (%) do desconto
  description   VARCHAR(255) NULL,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  max_uses      INT UNSIGNED NULL,                     -- limite de usos (NULL = ilimitado)
  used_count    INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at    DATETIME NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_coupons_active (active),
  INDEX idx_coupons_code (code)
) ENGINE=InnoDB;

-- Coluna em orders para registrar o cupom usado na compra.
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'coupon_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN coupon_id INT UNSIGNED NULL AFTER plan_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'discount_percent');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN discount_percent DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
