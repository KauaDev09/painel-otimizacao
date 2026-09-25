'use strict';

// Configuração do servidor — TODAS as credenciais vêm de variáveis de ambiente.
// Copie .env.example para .env e preencha. NUNCA comite o .env.

require('./loadEnv').loadEnv();

const env = process.env;

function req(name) {
  const v = env[name];
  if (!v) {
    // Em serverless (Vercel) process.exit() derrubaria a função sem resposta.
    // Lançar o erro permite que a camada superior responda JSON descrevendo
    // exatamente qual variável precisa ser configurada no painel do Vercel.
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
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
  // URL pública da loja (exibida no app quando a atualização é paga).
  storePublicUrl: env.STORE_PUBLIC_URL || '',
  appUrl: env.APP_URL || '',
  installerUrl: env.INSTALLER_URL || '',
  license: {
    defaultMaxDevices: Number(env.LICENSE_MAX_DEVICES || 2),
    defaultDays: Number(env.LICENSE_DAYS || 365),
    // Segredo compartilhado entre o painel desktop e a API de licença.
    // Garante que a resposta de validação não possa ser forjada no cliente.
    apiSecret: env.LICENSE_API_SECRET || ''
  },
  // Gateway de pagamento — isolamento via PaymentProvider.
  payment: {
    provider: env.PAYMENT_PROVIDER || 'mercadopago',
    mercadopago: {
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN || '',
      publicKey: env.MERCADOPAGO_PUBLIC_KEY || '',
      webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || ''
    }
  },
  // Segurança — limites de taxa (rate limiting) contra abuso e brute-force.
  security: {
    // validar-key: por IP.
    keyRateLimit: Number(env.RATE_LIMIT_KEY || 30),
    keyRateWindowMs: 60000,
    // license/activate|validate|heartbeat: por IP.
    licenseRateLimit: Number(env.RATE_LIMIT_LICENSE || 60),
    licenseRateWindowMs: 60000,
    // history/sync: por IP.
    historyRateLimit: Number(env.RATE_LIMIT_HISTORY || 120),
    historyRateWindowMs: 60000,
    // sevenia/chat: por IP.
    seveniaIpRateLimit: Number(env.RATE_LIMIT_SEVENIA || 15),
    seveniaIpRateWindowMs: 60000,
    // admin/login: por IP.
    adminLoginRateLimit: Number(env.RATE_LIMIT_ADMIN_LOGIN || 10),
    // store register/login/login-key/checkout/cupom/erase: por IP.
    storeAuthRateLimit: Number(env.RATE_LIMIT_AUTH || 10),
    storeAuthRateWindowMs: 60000
  },
  // SevenIA — assistente de IA (Google Gemini). A chave NUNCA sai do servidor.
  sevenia: {
    // gemini-3.6-flash exige cota paga e responde devagar no free tier (503/429).
    // flash-lite é estável e rápido para o assistente do painel.
    model: env.SEVENIA_MODEL || 'gemini-3.5-flash-lite',
    // Modelos tentados em sequência quando o principal está sem cota (429) ou
    // indisponível (404/503). Mantém o assistente de pé sem trocar de provedor.
    fallbackModels: (env.SEVENIA_FALLBACK_MODELS || 'gemini-flash-lite-latest')
      .split(',').map((m) => m.trim()).filter(Boolean),
    apiKey: env.GEMINI_API_KEY || '',
    maxFreePerDay: Number(env.SEVENIA_LIMIT_FREE || 10),
    maxProPerDay: Number(env.SEVENIA_LIMIT_PRO || 100),
    maxHistory: Number(env.SEVENIA_MAX_HISTORY || 12),
    maxMessageLength: Number(env.SEVENIA_MAX_MESSAGE || 4000),
    timeoutMs: Number(env.SEVENIA_TIMEOUT_MS || 45000),
    maxTokens: Number(env.SEVENIA_MAX_TOKENS || 2048)
  }
};
