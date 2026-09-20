'use strict';

// Configuração central do produto.
// Para renomear o produto comercialmente, altere apenas os valores aqui
// (o restante do aplicativo lê deste arquivo) e ajuste também:
//   - desktop/package.json  → "name" e build.productName
//   - backend/admin/index.html (marca visual)

const APP_NAME = 'SevenOptimizer';
const APP_NAME_SHORT = 'SevenOptimizer';
const APP_VERSION = '2.1.11';
const SUPPORT_EMAIL = '';
// Suporte oficial via Discord (aberto pelo botão de suporte da interface).
const OFFICIAL_URL = 'https://discord.gg/e3jHfF7ANp';
// Domínio público da loja/API. Sobrescreva com SEVEN_API_URL se necessário.
const SITE_URL = 'https://sevenoptimizer.com.br';
const DEFAULT_API_URL = SITE_URL;

module.exports = {
  APP_NAME,
  APP_NAME_SHORT,
  APP_VERSION,
  SUPPORT_EMAIL,
  OFFICIAL_URL,
  SITE_URL,
  DEFAULT_API_URL
};
