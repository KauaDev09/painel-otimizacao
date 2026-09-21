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

// POST com resposta em Server-Sent Events (SSE). Chama onEvent(evento, dados)
// a cada quadro e resolve com o payload do evento "done". Suporta cancelamento
// via AbortSignal (req.destroy).
function postJsonStream(base, pathStr, body, { headers = {}, timeoutMs = 90000, onEvent = () => {}, signal } = {}) {
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
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };

    const req = mod.request(
      u,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept: 'text/event-stream',
          ...headers
        },
        timeout: timeoutMs
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let buf = '';
          res.setEncoding('utf8');
          res.on('data', (d) => { buf += d; });
          res.on('end', () => {
            let j = null;
            try { j = buf ? JSON.parse(buf) : null; } catch (_) { /* não-JSON */ }
            const err = new Error((j && (j.message || j.error)) || `Servidor respondeu HTTP ${res.statusCode}`);
            err.code = (j && j.code) || 'HTTP_ERROR';
            err.status = res.statusCode;
            finish(reject, err);
          });
          return;
        }

        res.setEncoding('utf8');
        let buf = '';
        let donePayload = null;
        let errored = false;

        res.on('data', (chunk) => {
          if (errored) return;
          buf += chunk;
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (!raw.trim()) continue;
            let ev = 'message';
            let dataStr = '';
            for (const line of raw.split('\n')) {
              if (line.startsWith('event:')) ev = line.slice(6).trim();
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            }
            let parsed = null;
            try { parsed = dataStr ? JSON.parse(dataStr) : null; } catch (_) { parsed = { raw: dataStr }; }
            if (ev === 'done') {
              donePayload = parsed;
            } else if (ev === 'error') {
              errored = true;
              const err = new Error((parsed && parsed.message) || 'Falha na SevenIA.');
              err.code = (parsed && parsed.code) || 'SEVENIA_ERROR';
              finish(reject, err);
              return;
            } else {
              try { onEvent(ev, parsed); } catch (_) { /* callback não pode derrubar o stream */ }
            }
          }
        });

        res.on('end', () => {
          if (donePayload) finish(resolve, donePayload);
          else finish(reject, Object.assign(new Error('A resposta da IA foi interrompida.'), { code: 'SEVENIA_STREAM_INTERRUPTED' }));
        });
      }
    );

    req.on('timeout', () => req.destroy(Object.assign(new Error('Tempo esgotado ao contatar o servidor.'), { code: 'NETWORK_ERROR' })));
    req.on('error', (err) => {
      if (signal && signal.aborted) {
        finish(reject, Object.assign(new Error('Consulta cancelada.'), { code: 'CANCELLED' }));
        return;
      }
      const netErr = new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
      netErr.code = 'NETWORK_ERROR';
      netErr.cause = err;
      finish(reject, netErr);
    });

    if (signal) {
      if (signal.aborted) req.destroy();
      else signal.addEventListener('abort', () => req.destroy());
    }

    req.write(data);
    req.end();
  });
}

module.exports = { postJson, getJson, postJsonStream };
