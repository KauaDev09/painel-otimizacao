'use strict';

// Endereço da API de licenciamento.
// - Não é segredo: é um endpoint público consumido pelo aplicativo.
// - Sobrescreva em tempo de build/execução via variável de ambiente
//   ORION_API_URL, ou edite DEFAULT_API_URL antes de distribuir.
// Credenciais do banco/servidor NUNCA ficam aqui — apenas no servidor.

const { DEFAULT_API_URL } = require('../config/appConfig');

function getApiBaseUrl() {
  return String(process.env.ORION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

module.exports = { getApiBaseUrl };
