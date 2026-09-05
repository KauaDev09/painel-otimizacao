'use strict';

// UsersService + autenticação de cliente final (portal web).
// Registro/login por e-mail+senha (scrypt), sessão via token HMAC.
// Reutiliza a tabela `usuarios` existente (agora com senha_hash preenchida).

const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, signToken } = require('../util');
const accessLog = require('./accessLog');

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function findByEmail(email) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail) return null;
  return db.queryOne(config, 'SELECT * FROM usuarios WHERE email = ? LIMIT 1', [mail]);
}

async function ensureUser({ name, email }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail) return null;
  let u = await findByEmail(mail);
  if (u) return u;
  await db.query(
    config,
    'INSERT INTO usuarios (nome, email, criado_em) VALUES (?, ?, NOW())',
    [String(name || mail).slice(0, 120), mail]
  );
  return findByEmail(mail);
}

async function register({ name, email, password }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!validEmail(mail)) return fail('INVALID_EMAIL', 'E-mail inválido.', 400);
  if (!password || String(password).length < 6) {
    return fail('WEAK_PASSWORD', 'A senha deve ter ao menos 6 caracteres.', 400);
  }
  const exists = await findByEmail(mail);
  if (exists) return fail('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', 409);

  const hash = hashPassword(String(password));
  const res = await db.query(
    config,
    'INSERT INTO usuarios (nome, email, senha_hash, ativo, criado_em) VALUES (?, ?, ?, 1, NOW())',
    [String(name || mail).slice(0, 120), mail, hash]
  );
  const u = await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [Number(res.insertId)]);
  return { ok: true, user: publicUser(u), token: issueToken(u) };
}

async function login({ email, password }) {
  const mail = String(email || '').trim().toLowerCase();
  const u = await findByEmail(mail);
  if (!u || !u.senha_hash || !verifyPassword(String(password || ''), u.senha_hash)) {
    return fail('INVALID_CREDENTIALS', 'Credenciais inválidas.', 401);
  }
  if (!u.ativo) return fail('ACCOUNT_DISABLED', 'Conta desativada.', 403);
  return { ok: true, user: publicUser(u), token: issueToken(u) };
}

async function loginByKey({ key }) {
  const k = String(key || '').trim().toUpperCase();
  if (!k || k.length < 10) return fail('INVALID_KEY', 'Chave de licença inválida.', 400);

  const lic = await db.queryOne(config,
    'SELECT * FROM licencas WHERE UPPER(chave) = ? LIMIT 1', [k]);
  if (!lic) return fail('KEY_NOT_FOUND', 'Licença não encontrada.', 404);
  if (lic.status === 'bloqueada') return fail('KEY_BLOCKED', 'Licença bloqueada.', 403);
  if (lic.status === 'expirada' || (lic.expira_em && new Date(lic.expira_em) < new Date())) {
    return fail('KEY_EXPIRED', 'Licença expirada.', 403);
  }

  let user = null;
  if (lic.usuario_id) {
    user = await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [lic.usuario_id]);
  }
  if (!user) {
    const fakeEmail = 'cli_' + k.replace(/-/g, '').toLowerCase() + '@orion.local';
    user = await ensureUser({ name: 'Cliente', email: fakeEmail });
    if (user) {
      await db.query(config, 'UPDATE licencas SET usuario_id = ? WHERE id = ?', [user.id, lic.id]);
    }
  }
  if (!user) return fail('USER_ERROR', 'Não foi possível criar o perfil do cliente.', 500);

  return { ok: true, user: publicUser(user), token: issueToken(user), license: { key: lic.chave, plan: lic.plano || lic.plan_slug, status: lic.status } };
}

function issueToken(user) {
  return signToken({ typ: 'customer', uid: user.id }, config.appSecret, 60 * 60 * 24 * 30);
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.nome,
    email: u.email,
    createdAt: u.criado_em ? new Date(u.criado_em).toISOString() : null
  };
}

async function runSafe(sql, params) {
  try { await db.query(config, sql, params); } catch (_) { /* tabela pode não existir */ }
}

async function eraseAllDataForUser(user, motivo) {
  const licenses = await db.query(config, 'SELECT id, chave FROM licencas WHERE usuario_id = ?', [user.id]);
  const ids = licenses.map((l) => l.id);

  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await runSafe(`DELETE FROM ativacoes WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM historico_otimizacoes WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM analises_seguranca WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM license_activations WHERE license_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM dispositivos WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM pagamentos WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM logs WHERE licenca_id IN (${ph})`, ids);
    await runSafe(`DELETE FROM licencas WHERE id IN (${ph})`, ids);
  }

  await runSafe('DELETE FROM orders WHERE user_id = ?', [user.id]);
  await runSafe('DELETE FROM access_logs WHERE user_id = ?', [user.id]);
  await runSafe('UPDATE pagamentos SET licenca_id = NULL WHERE licenca_id IS NULL', []);
  await db.query(config, 'DELETE FROM usuarios WHERE id = ?', [user.id]);

  const emailHash = crypto.createHash('sha256').update(String(user.email || '')).digest('hex');
  await accessLog.recordErasure(config, emailHash, motivo || 'pedido_cliente');
  return { ok: true, erased: true };
}

async function eraseByUserId(userId, motivo) {
  const user = await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [userId]);
  if (!user) return fail('NOT_FOUND', 'Usuário não encontrado.', 404);
  return eraseAllDataForUser(user, motivo);
}

async function eraseByKey(key, motivo) {
  const k = String(key || '').trim().toUpperCase();
  if (!k || k.length < 10) return fail('INVALID_KEY', 'Informe a chave de licença.', 400);
  const lic = await db.queryOne(config, 'SELECT * FROM licencas WHERE UPPER(chave) = ? LIMIT 1', [k]);
  if (!lic) return fail('KEY_NOT_FOUND', 'Licença não encontrada.', 404);
  if (!lic.usuario_id) {
    await runSafe('DELETE FROM ativacoes WHERE licenca_id = ?', [lic.id]);
    await runSafe('DELETE FROM historico_otimizacoes WHERE licenca_id = ?', [lic.id]);
    await runSafe('DELETE FROM analises_seguranca WHERE licenca_id = ?', [lic.id]);
    await runSafe('DELETE FROM license_activations WHERE license_id = ?', [lic.id]);
    await runSafe('DELETE FROM dispositivos WHERE licenca_id = ?', [lic.id]);
    await runSafe('DELETE FROM pagamentos WHERE licenca_id = ?', [lic.id]);
    await runSafe('DELETE FROM logs WHERE licenca_id = ?', [lic.id]);
    await db.query(config, 'DELETE FROM licencas WHERE id = ?', [lic.id]);
    await accessLog.recordErasure(config, null, motivo || 'pedido_cliente_key');
    return { ok: true, erased: true };
  }
  return eraseByUserId(lic.usuario_id, motivo || 'pedido_cliente_key');
}

module.exports = {
  fail,
  register,
  login,
  loginByKey,
  findByEmail,
  ensureUser,
  publicUser,
  issueToken,
  eraseByUserId,
  eraseByKey
};
