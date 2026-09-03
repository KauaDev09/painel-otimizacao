-- ORION OPTIMIZER — Migration 006: novos preços + instalador público.
-- Aplicar:  node backend/scripts/migrate-006-plan-prices.js   (recomendado — idempotente)

USE bios_optimizer;

UPDATE plans SET price = 19.99 WHERE slug = 'starter';
UPDATE plans SET price = 39.99 WHERE slug = 'pro';
UPDATE plans SET price = 69.99 WHERE slug = 'ultra';
