-- ORION OPTIMIZER — Migration 004: Assinaturas MENSAIS (subscription).
-- Converte todos os planos de venda única (one_time/lifetime) para assinatura
-- mensal recorrente. Não destrói dados existentes.
-- Banco: bios_optimizer (MySQL 8 / TiDB compatível).

USE bios_optimizer;

-- 1) Todos os planos passam a ser assinatura mensal.
UPDATE plans SET billing_type = 'subscription' WHERE billing_type <> 'subscription';

-- 2) Licenças existentes sem data de expiração (vitalícias) passam a expirar
--    em 30 dias a partir de agora, dado que o modelo agora é mensal.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'licencas' AND column_name = 'expira_em') > 0,
  'UPDATE licencas SET expira_em = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE expira_em IS NULL AND status = ''ativa''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Licenças com status expirada e sem validade definida não mudam (ficam expiradas).
