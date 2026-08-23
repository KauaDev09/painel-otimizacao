'use strict';

// Configuração do servidor — TODAS as credenciais vêm de variáveis de ambiente.
// Copie .env.example para .env e preencha. NUNCA comite o .env.

require('./loadEnv').loadEnv();

const env = process.env;

function req(name) {
  const v = env[name];
  if (!v) {
    console.error(`[config] Variável de ambiente obrigatória ausente: ${name}`);
    process.exit(1);
  }
  return v;
}

module.exports = {
  port: Number(env.PORT || 8787),
  // Segredo usado para assinar tokens HMAC (sessões de licença e admin).
  appSecret: req('APP_SECRET'),
  // Token mestre opcional para bootstrap do painel/admin API.
  adminToken: env.ADMIN_TOKEN || null,
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: req('DB_USER'),
    password: req('DB_PASSWORD'),
    database: env.DB_NAME || 'bios_optimizer'
  },
  corsOrigin: env.CORS_ORIGIN || '*',
  license: {
    defaultMaxDevices: Number(env.LICENSE_MAX_DEVICES || 2),
    defaultDays: Number(env.LICENSE_DAYS || 365)
  }
};
