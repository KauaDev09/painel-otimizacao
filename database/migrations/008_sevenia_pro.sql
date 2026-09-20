-- SevenIA Pro (Frente 2, E2.2): plano de produto do assistente de IA.
-- Produto 'sevenia_pro' aparece no checkout mas NÃO no grid de planos de licença
-- (listagem pública filtra por product_type = 'license').
-- Aplicar: manualmente ou com o mesmo padrão idempotente das migrations 003+.

USE bios_optimizer;

-- plans.product_type: 'license' (padrão, existente) | 'sevenia' (assistente de IA)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'plans' AND column_name = 'product_type');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE plans ADD COLUMN product_type ENUM(''license'',''sevenia'') NOT NULL DEFAULT ''license'' AFTER billing_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- plano_ia.order_id: pedido que ativou/renovou o plano Pro (auditoria).
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'plano_ia' AND column_name = 'order_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE plano_ia ADD COLUMN order_id INT UNSIGNED NULL AFTER data_ativacao',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed do produto SevenIA Pro (uma única vez, por slug).
INSERT INTO plans (name, slug, description, price, currency, billing_type, product_type, features, active, sort_order)
SELECT 'SEVENIA PRO', 'sevenia_pro',
       'Assistente de IA com resposta por IA generativa, análise do laudo do sistema e sugestões de otimização. Pagamento único.',
       19.90, 'BRL', 'one_time', 'sevenia',
       JSON_ARRAY('sevenia_pro_ai_chat'),
       1, 10
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'sevenia_pro');