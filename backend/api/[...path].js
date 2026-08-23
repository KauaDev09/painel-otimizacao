'use strict';

// Entry point serverless (Vercel). Garante que TODA resposta seja JSON,
// inclusive falhas de inicialização (ex.: variável de ambiente ausente),
// para que o frontend nunca receba HTML/texto puro.

let api = null;
let bootError = null;

try {
  api = require('../src/index');
} catch (err) {
  bootError = err;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, corsHeaders()));
  res.end(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  try {
    if (!api) {
      throw new Error(
        'A API não pôde ser inicializada. Verifique as variáveis de ambiente no projeto do Vercel. Detalhe: ' +
        ((bootError && bootError.message) || 'desconhecido')
      );
    }
    return await api.handleRequest(req, res);
  } catch (err) {
    console.error('[api] erro não tratado:', err && err.message);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, code: 'SERVER_ERROR', message: err && err.message ? String(err.message) : 'Erro interno do servidor.' });
    } else {
      res.end();
    }
  }
};
