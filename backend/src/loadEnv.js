'use strict';

// Carregamento de variáveis de ambiente via dotenv.
// Não sobrescreve variáveis já presentes no ambiente.

const path = require('path');

function loadEnv(filePath) {
  const result = require('dotenv').config({
    path: filePath || path.join(__dirname, '..', '.env'),
    override: false
  });
  if (result.error) {
    console.error(`[loadEnv] Falha ao carregar .env: ${result.error.message}`);
    return false;
  }
  return true;
}

module.exports = { loadEnv };
