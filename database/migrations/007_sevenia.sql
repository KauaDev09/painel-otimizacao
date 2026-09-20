-- SevenIA (Frente 2): plano de IA (free/pro) e cota diária de mensagens por usuário.
-- user_id referencia usuarios.id (portal web e contas geradas a partir de chave de licença).

CREATE TABLE IF NOT EXISTS plano_ia (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  plano ENUM('free','pro') NOT NULL DEFAULT 'free',
  data_ativacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS uso_ia (
  user_id BIGINT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  contador_mensagens INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;