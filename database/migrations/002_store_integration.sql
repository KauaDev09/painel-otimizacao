-- Integração loja → licenças (segura, não destrói dados).
-- Preferir: node backend/scripts/migrate-store-integration.js
-- Aplicar manualmente só se o script não estiver disponível.

-- Licença vitalícia: expiração opcional
ALTER TABLE licencas
  MODIFY COLUMN expira_em DATETIME NULL;

-- Versão autorizada (pacote de atualização vitalício) e pedido da loja (auditoria)
ALTER TABLE licencas
  ADD COLUMN versao_autorizada VARCHAR(20) NULL AFTER observacao;

ALTER TABLE licencas
  ADD COLUMN pedido_loja VARCHAR(64) NULL AFTER versao_autorizada;

-- Atualizações pagas
ALTER TABLE atualizacoes
  ADD COLUMN exige_pagamento TINYINT(1) NOT NULL DEFAULT 0 AFTER obrigatoria;

ALTER TABLE atualizacoes
  ADD COLUMN preco DECIMAL(10,2) NOT NULL DEFAULT 15.00 AFTER exige_pagamento;

-- Idempotência de pagamento da loja
ALTER TABLE pagamentos
  ADD UNIQUE INDEX uq_pag_ref_externa (ref_externa);
