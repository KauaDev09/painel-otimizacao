'use strict';

// Carregamento opcional de .env via dotenv (dev local).
// Em serverless (Vercel) as variáveis já vêm do ambiente — dotenv pode não estar
// no bundle se o install for só do front.

const path = require('path');

function loadEnv(filePath) {
  let dotenv;
  try {
    dotenv = require('dotenv');
  } catch {
    // Sem dotenv: assume env já injetado (Vercel / produção).
    return false;
  }

  const result = dotenv.config({
    path: filePath || path.join(__dirname, '..', '.env'),
    override: false
  });
  if (result.error) {
    // Arquivo ausente é normal em produção.
    if (result.error.code !== 'ENOENT') {
      console.error(`[loadEnv] Falha ao carregar .env: ${result.error.message}`);
    }
    return false;
  }
  return true;
}

module.exports = { loadEnv };
