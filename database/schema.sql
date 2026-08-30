-- ORION OPTIMIZER — Schema do banco (MySQL 8+ / InnoDB / utf8mb4)
-- Compatível com TiDB Cloud Serverless (MySQL-compatible).
-- Aplicar: mysql -u root -p < sql/schema.sql  ou  colar no SQL Editor do TiDB.
-- Nota TiDB: foreign keys são aceitas; se alguma versão antiga der warning,
-- basta ignorar (o TiDB não aplica as restrições, o schema continua válido).

CREATE DATABASE IF NOT EXISTS bios_optimizer
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bios_optimizer;

-- ---------- Usuários finais ----------
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(190) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NULL,           -- opcional: portal do cliente
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Administradores (painel separado) ----------
CREATE TABLE IF NOT EXISTS administradores (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(60)  NOT NULL UNIQUE,
  senha_hash    VARCHAR(255) NOT NULL,     -- scrypt:salt:hash (gerada por scripts/create-admin.js)
  ativo         TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login  DATETIME NULL
) ENGINE=InnoDB;

-- ---------- Licenças ----------
CREATE TABLE IF NOT EXISTS licencas (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chave             VARCHAR(29)  NOT NULL UNIQUE,      -- XXXX-XXXX-XXXX-XXXX
  plano             VARCHAR(40)  NOT NULL DEFAULT 'mensal',
  status            ENUM('ativa','inativa','expirada','bloqueada') NOT NULL DEFAULT 'ativa',
  max_dispositivos  INT UNSIGNED NOT NULL DEFAULT 2,
  usuario_id        INT UNSIGNED NULL,
  observacao        VARCHAR(255) NULL,
  criada_em         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em         DATETIME     NOT NULL,
  renovada_em       DATETIME NULL,
  bloqueada_em      DATETIME NULL,
  CONSTRAINT fk_lic_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_lic_status (status),
  INDEX idx_lic_expira (expira_em)
) ENGINE=InnoDB;

-- ---------- Dispositivos (máquinas vinculadas) ----------
CREATE TABLE IF NOT EXISTS dispositivos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  licenca_id      INT UNSIGNED NOT NULL,
  machine_id      CHAR(34)     NOT NULL,   -- hash SHA-256 do MachineGuid
  hostname        VARCHAR(120) NULL,
  primeiro_visto  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_visto    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_disp (licenca_id, machine_id),
  CONSTRAINT fk_disp_licenca FOREIGN KEY (licenca_id) REFERENCES licencas(id) ON DELETE CASCADE,
  INDEX idx_disp_visto (ultimo_visto)
) ENGINE=InnoDB;

-- ---------- Ativações (histórico de vínculos) ----------
CREATE TABLE IF NOT EXISTS ativacoes (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  licenca_id     INT UNSIGNED NOT NULL,
  dispositivo_id INT UNSIGNED NOT NULL,
  ativada_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  desativada_em  DATETIME NULL,
  ip             VARCHAR(45) NULL,
  CONSTRAINT fk_ativ_licenca FOREIGN KEY (licenca_id) REFERENCES licencas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ativ_disp FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Histórico de otimizações (sincronizado pelo app) ----------
CREATE TABLE IF NOT EXISTS historico_otimizacoes (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  licenca_id     INT UNSIGNED NOT NULL,
  dispositivo_id INT UNSIGNED NULL,
  analisado_em   DATETIME NOT NULL,
  score          SMALLINT NULL,
  categorias_json JSON NULL,
  contagens_json  JSON NULL,
  hardware_json   JSON NULL,
  boot_mode       VARCHAR(20) NULL,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_licenca FOREIGN KEY (licenca_id) REFERENCES licencas(id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_disp FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL,
  INDEX idx_hist_data (analisado_em)
) ENGINE=InnoDB;

-- ---------- Análises de segurança (Defender/malware) ----------
CREATE TABLE IF NOT EXISTS analises_seguranca (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  licenca_id         INT UNSIGNED NOT NULL,
  dispositivo_id     INT UNSIGNED NULL,
  analisado_em       DATETIME NOT NULL,
  score              SMALLINT NULL,
  ameacas_total      INT NULL,
  ameacas_ativas     INT NULL,
  defender_tempo_real TINYINT(1) NULL,
  criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_seg_licenca FOREIGN KEY (licenca_id) REFERENCES licencas(id) ON DELETE CASCADE,
  CONSTRAINT fk_seg_disp FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL,
  INDEX idx_seg_data (analisado_em)
) ENGINE=InnoDB;

-- ---------- Logs ----------
CREATE TABLE IF NOT EXISTS logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evento     VARCHAR(60) NOT NULL,
  licenca_id INT UNSIGNED NULL,
  detalhe    JSON NULL,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_evento (evento),
  INDEX idx_logs_data (criado_em)
) ENGINE=InnoDB;

-- ---------- Atualizações do aplicativo ----------
-- O painel publica uma versão por vez; as anteriores ficam inativas.
CREATE TABLE IF NOT EXISTS atualizacoes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  versao        VARCHAR(20)  NOT NULL,             -- semântica X.Y.Z
  url_download  VARCHAR(500) NOT NULL,             -- página oficial de download
  changelog     TEXT NULL,
  obrigatoria   TINYINT(1)   NOT NULL DEFAULT 0,
  ativa         TINYINT(1)   NOT NULL DEFAULT 0,
  liberada_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_upd_ativa (ativa),
  INDEX idx_upd_versao (versao)
) ENGINE=InnoDB;

-- ---------- Pagamentos (opcional — integração futura) ----------
CREATE TABLE IF NOT EXISTS pagamentos (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  licenca_id   INT UNSIGNED NULL,
  valor        DECIMAL(10,2) NOT NULL,
  moeda        CHAR(3) NOT NULL DEFAULT 'BRL',
  provedor     VARCHAR(40) NOT NULL,           -- mercadopago | stripe | pix ...
  ref_externa  VARCHAR(120) NULL,
  status       ENUM('pendente','aprovado','recusado','reembolsado') NOT NULL DEFAULT 'pendente',
  pago_em      DATETIME NULL,
  criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pag_licenca FOREIGN KEY (licenca_id) REFERENCES licencas(id) ON DELETE SET NULL
) ENGINE=InnoDB;
