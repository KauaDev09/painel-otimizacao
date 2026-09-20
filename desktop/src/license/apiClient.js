'use strict';

// Cliente HTTP mínimo (sem dependências) para a API de licenças.
// Roda apenas no processo principal do Electron.

const http = require('http');
const https = require('https');

// TLS obrigatório: HTTP puro é recusado por padrão. Só desenvolvimento local
// explícito (SEVEN_ALLOW_HTTP=1) usa http:// (ex.: testes contra API local).
function selectMod(u) {
  if (u.protocol === 'https:') return https;
  if (u.protocol === 'http:' && process.env.SEVEN_ALLOW_HTTP === '1') return http;
  if (u.protocol === 'http:') throw new Error('Conexão insegura (HTTP) recusada pelo aplicativo.');
  throw new Error('Protocolo de rede não suportado.');
}

function postJson(base, pathStr, body, { headers = {}, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(pathStr, base);
    } catch (_) {
      reject(new Error('Endereço da API inválido.'));
      return;
    }
    const mod = selectMod(u);
    const data = JSON.stringify(body || {});
    const req = mod.request(
      u,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        },
        timeout: timeoutMs
      },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          let j = null;
          try { j = buf ? JSON.parse(buf) : null; } catch (_) { /* resposta não-JSON */ }
          if (res.statusCode >= 200 && res.statusCode < 300 && j && j.ok) {
            resolve(j);
          } else {
            const err = new Error((j && (j.message || j.error)) || `Servidor respondeu HTTP ${res.statusCode}`);
            err.code = (j && j.code) || 'HTTP_ERROR';
            err.status = res.statusCode;
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao contatar o servidor de licenças.')));
    req.on('error', (err) => {
      const netErr = new Error('Não foi possível conectar ao servidor de licenças. Verifique sua internet.');
      netErr.code = 'NETWORK_ERROR';
      netErr.cause = err;
      reject(netErr);
    });
    req.write(data);
    req.end();
  });
}

function getJson(base, pathStr, { headers = {}, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(pathStr, base);
    } catch (_) {
      reject(new Error('Endereço da API inválido.'));
      return;
    }
    const mod = selectMod(u);
    const req = mod.request(u, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { buf += d; });
      res.on('end', () => {
        let j = null;
        try { j = buf ? JSON.parse(buf) : null; } catch (_) { /* resposta não-JSON */ }
        if (res.statusCode >= 200 && res.statusCode < 300 && j && j.ok) {
          resolve(j);
        } else {
          const err = new Error((j && (j.message || j.error)) || `Servidor respondeu HTTP ${res.statusCode}`);
          err.code = (j && j.code) || 'HTTP_ERROR';
          err.status = res.statusCode;
          reject(err);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao contatar o servidor.')));
    req.on('error', (err) => {
      const netErr = new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
      netErr.code = 'NETWORK_ERROR';
      netErr.cause = err;
      reject(netErr);
    });
    req.end();
  });
}

module.exports = { postJson, getJson };
