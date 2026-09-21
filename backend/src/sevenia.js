'use strict';

// SevenIA — cliente do assistente de IA (Google Gemini) e cotas por usuário.
// A chave GEMINI_API_KEY vive SOMENTE neste servidor; o app nunca a recebe.

const db = require('./db');
const config = require('./config');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

async function getPlan(userId) {
  const row = await db.queryOne(config, 'SELECT * FROM plano_ia WHERE user_id = ? LIMIT 1', [userId]);
  if (!row) {
    await db.query(config, 'INSERT INTO plano_ia (user_id, plano) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = user_id', [userId, 'free']);
  }
  return db.queryOne(config, 'SELECT * FROM plano_ia WHERE user_id = ? LIMIT 1', [userId]);
}

async function setPlan(userId, plano, orderId) {
  await getPlan(userId);
  const orderSql = orderId ? ', order_id = ?' : '';
  const params = orderId ? [plano, orderId, userId] : [plano, userId];
  await db.query(config, `UPDATE plano_ia SET plano = ?, data_ativacao = NOW()${orderSql} WHERE user_id = ?`, params);
  return getUser(userId);
}

async function getUser(userId) {
  const row = await db.queryOne(config, 'SELECT * FROM plano_ia WHERE user_id = ? LIMIT 1', [userId]);
  return {
    userId,
    plan: row ? row.plano : 'free',
    activatedAt: row && row.data_ativacao ? new Date(row.data_ativacao).toISOString() : null
  };
}

async function usageToday(userId) {
  const data = new Date().toISOString().slice(0, 10);
  const row = await db.queryOne(config, 'SELECT contador_mensagens FROM uso_ia WHERE user_id = ? AND data = ? LIMIT 1', [userId, data]);
  return { date: data, count: row ? Number(row.contador_mensagens) : 0 };
}

function dailyLimit(plan) {
  return plan === 'pro' ? config.sevenia.maxProPerDay : config.sevenia.maxFreePerDay;
}

async function usagePayload(userId) {
  const { plan, activatedAt } = await getUser(userId);
  const { date, count } = await usageToday(userId);
  const limit = dailyLimit(plan);
  return { plan, activatedAt, date, used: count, limit, remaining: Math.max(0, limit - count) };
}

async function consume(userId) {
  const data = new Date().toISOString().slice(0, 10);
  await db.query(
    config,
    `INSERT INTO uso_ia (user_id, data, contador_mensagens) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE contador_mensagens = contador_mensagens + 1`,
    [userId, data]
  );
}

// ---- Cliente da API do Google Gemini (SDK oficial @google/generative-ai) ----
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('request timed out'), { name: 'AbortError' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Erros do SDK nem sempre trazem `status`; o código HTTP costuma vir no texto
// (ex.: "[503 Service Unavailable]"). Extrai de ambos para classificar certo.
function upstreamStatus(err) {
  const direct = Number(err && err.status);
  if (direct) return direct;
  const msg = String((err && err.message) || '');
  const bracket = /\[(\d{3})[^\]]*\]/.exec(msg);
  if (bracket) return Number(bracket[1]);
  const word = /\b(400|401|403|404|408|409|429|500|502|503|504)\b/.exec(msg);
  return word ? Number(word[1]) : 0;
}

function isAbort(err) {
  return !!err && (err.name === 'AbortError' || /timeout|timed out|aborted/i.test(String(err.message || '')));
}

// Converte o erro upstream em uma resposta de falha com mensagem honesta.
function classifyUpstream(err) {
  const status = upstreamStatus(err);
  if (isAbort(err)) {
    return fail('SEVENIA_TIMEOUT', 'A SevenIA está demorando. Tente novamente em instantes.', 504);
  }
  if (status === 401 || status === 403) {
    return fail('SEVENIA_UPSTREAM_AUTH', 'A SevenIA está com problema de credencial no servidor. Comunica o suporte.', 502);
  }
  if (status === 400) {
    return fail('SEVENIA_UPSTREAM_BAD_REQUEST', 'A SevenIA está mal configurada no servidor. Comunica o suporte.', 502);
  }
  if (status === 404) {
    return fail('SEVENIA_MODEL_UNAVAILABLE', 'O modelo de IA do servidor está indisponível. Comunica o suporte.', 502);
  }
  if (status === 429) {
    return fail('SEVENIA_UPSTREAM_RATE_LIMIT', 'O serviço de IA está sem cota no momento. Tente novamente mais tarde.', 503);
  }
  if (status >= 500) {
    return fail('SEVENIA_UPSTREAM_UNAVAILABLE', 'A IA está temporariamente indisponível. Tente novamente.', 502);
  }
  return fail('SEVENIA_UPSTREAM_ERROR', 'A IA está instável. Tente novamente.', 502);
}

// Modelos tentados em ordem: o configurado + fallbacks (sem repetições).
function modelCandidates() {
  const list = [config.sevenia.model, ...(config.sevenia.fallbackModels || [])];
  return [...new Set(list.filter(Boolean))];
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function buildContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}

function newModel(modelName, system) {
  const genAI = new GoogleGenerativeAI(config.sevenia.apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: system,
    generationConfig: { maxOutputTokens: config.sevenia.maxTokens, temperature: 0.6 }
  });
}

// Geração simples (sem streaming), com fallback de modelo.
async function chatToGemini({ system, messages }) {
  if (!config.sevenia.apiKey) {
    return fail('SEVENIA_NOT_CONFIGURED', 'SevenIA ainda não está configurada no servidor.', 503);
  }
  const contents = buildContents(messages);
  let lastErr = null;

  for (const modelName of modelCandidates()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = newModel(modelName, system);
        const result = await withTimeout(
          model.generateContent({ contents }, { timeout: config.sevenia.timeoutMs }),
          config.sevenia.timeoutMs + 10000
        );
        const text = String(result.response && result.response.text ? result.response.text() : '').trim();
        if (!text) {
          lastErr = Object.assign(new Error('empty response'), { status: 502 });
          break;
        }
        return { ok: true, text, model: modelName };
      } catch (err) {
        lastErr = err;
        const status = upstreamStatus(err);
        console.error(`[sevenia] generate ${modelName} tentativa ${attempt}:`, status, err && err.message);
        if (isAbort(err)) return classifyUpstream(err);
        if (RETRYABLE.has(status) && attempt === 1) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break; // tenta o próximo modelo
      }
    }
  }
  return classifyUpstream(lastErr);
}

// Geração com streaming token a token. Só troca de modelo enquanto NADA foi
// enviado ao cliente (evita resposta duplicada). `isCancelled` interrompe quando
// o cliente desconecta.
async function streamToGemini({ system, messages, onChunk, isCancelled }) {
  if (!config.sevenia.apiKey) {
    return fail('SEVENIA_NOT_CONFIGURED', 'SevenIA ainda não está configurada no servidor.', 503);
  }
  const contents = buildContents(messages);
  let lastErr = null;

  for (const modelName of modelCandidates()) {
    let emitted = false;
    try {
      const model = newModel(modelName, system);
      const result = await model.generateContentStream({ contents }, { timeout: config.sevenia.timeoutMs });
      let full = '';
      for await (const chunk of result.stream) {
        if (isCancelled && isCancelled()) break;
        const piece = chunk && chunk.text ? chunk.text() : '';
        if (!piece) continue;
        emitted = true;
        full += piece;
        onChunk(piece);
      }
      if (!full.trim()) {
        lastErr = Object.assign(new Error('empty stream'), { status: 502 });
        continue;
      }
      return { ok: true, text: full.trim(), model: modelName };
    } catch (err) {
      lastErr = err;
      const status = upstreamStatus(err);
      console.error(`[sevenia] stream ${modelName}:`, status, err && err.message);
      if (emitted) {
        return fail('SEVENIA_STREAM_INTERRUPTED', 'A resposta foi interrompida no meio. Tente novamente.', 502);
      }
      if (isAbort(err)) return classifyUpstream(err);
      // sem nada enviado: pode tentar o próximo modelo
    }
  }
  return classifyUpstream(lastErr);
}

module.exports = {
  fail,
  getPlan,
  setPlan,
  getUser,
  usageToday,
  usagePayload,
  consume,
  chatToGemini,
  streamToGemini
};