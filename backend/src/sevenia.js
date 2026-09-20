'use strict';

// SevenIA — cliente do assistente de IA (Anthropic Claude) e cotas por usuário.
// A chave ANTHROPIC_API_KEY vive SOMENTE neste servidor; o app nunca a recebe.

const db = require('./db');
const config = require('./config');

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

// ---- Cliente HTTP da API Messages da Anthropic (fetch nativo, sem deps) ----
async function chatToAnthropic({ system, messages }) {
  if (!config.sevenia.apiKey) {
    return fail('SEVENIA_NOT_CONFIGURED', 'SevenIA ainda não está configurada no servidor.', 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.sevenia.timeoutMs);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.sevenia.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.sevenia.model,
        max_tokens: config.sevenia.maxTokens,
        system,
        messages
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    return fail(aborted ? 'SEVENIA_TIMEOUT' : 'SEVENIA_NETWORK', 'Não foi possível falar com a SevenIA agora.', 502);
  }
  clearTimeout(timer);

  const upstream = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return fail('SEVENIA_UPSTREAM_AUTH', 'A SevenIA está com problema de credencial no servidor.', 502);
    }
    return fail('SEVENIA_UPSTREAM_ERROR', 'A SevenIA não respondeu agora. Tente novamente.', 502);
  }

  const text = (Array.isArray(upstream.content) ? upstream.content : [])
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim();
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
  chatToAnthropic
};