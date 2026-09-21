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

async function chatToGemini({ system, messages }) {
  if (!config.sevenia.apiKey) {
    return fail('SEVENIA_NOT_CONFIGURED', 'SevenIA ainda não está configurada no servidor.', 503);
  }

  const genAI = new GoogleGenerativeAI(config.sevenia.apiKey);
  const model = genAI.getGenerativeModel({
    model: config.sevenia.model,
    systemInstruction: system,
    generationConfig: { maxOutputTokens: config.sevenia.maxTokens }
  });
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  let result;
  try {
    result = await withTimeout(
      model.generateContent({ contents }, { timeout: config.sevenia.timeoutMs }),
      config.sevenia.timeoutMs + 10000
    );
  } catch (err) {
    // Fluxo completo de erros upstream: sem SEVENIA_DEBUG o log ainda registra
    // o motivo real (chave inválida 400, modelo 404, cota 429, indisponível 503).
    console.error('[sevenia] upstream Gemini:', err && err.status, err && err.message);
    const aborted = err && (err.name === 'AbortError' || String(err.message || '').toLowerCase().includes('timeout'));
    if (aborted) {
      return fail('SEVENIA_TIMEOUT', 'A SevenIA está demorando. Tente novamente em instantes.', 502);
    }
    const status = Number(err && err.status) || 0;
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

  const text = String(result.response && result.response.text ? result.response.text() : '').trim();
  if (!text) return fail('SEVENIA_EMPTY', 'A SevenIA não retornou conteúdo.', 502);
  return { ok: true, text };
}

module.exports = {
  fail,
  getPlan,
  setPlan,
  getUser,
  usageToday,
  usagePayload,
  consume,
  chatToGemini
};