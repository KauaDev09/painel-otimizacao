'use strict';

// Configuração central do produto.
// Para renomear o produto comercialmente, altere apenas os valores aqui
// (o restante do aplicativo lê deste arquivo) e ajuste também:
//   - desktop/package.json  → "name" e build.productName
//   - backend/admin/index.html e desktop/src/ui/index.html (marca visual)

const APP_NAME = 'ORION OPTIMIZER';
const APP_NAME_SHORT = 'Orion Optimizer';
const APP_VERSION = '2.0.7';
const SUPPORT_EMAIL = '';
// Suporte oficial via Discord (aberto pelo botão de suporte da interface).
const OFFICIAL_URL = 'https://discord.gg/zEWrvddVmZ';
// URL pública da API de licenças/atualizações (não é segredo).
const DEFAULT_API_URL = 'https://orion-optimizer-ten.vercel.app';

module.exports = {
  APP_NAME,
  APP_NAME_SHORT,
  APP_VERSION,
  SUPPORT_EMAIL,
  OFFICIAL_URL,
  DEFAULT_API_URL
};
