'use strict';

// UsersService + autenticação de cliente final (portal web).
// Registro/login por e-mail+senha (scrypt), sessão via token HMAC.
// Reutiliza a tabela `usuarios` existente (agora com senha_hash preenchida).

const db = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, signToken } = require('../util');

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

module.exports = {
  fail,
  register,
  login,
  findByEmail,
  ensureUser,
  publicUser,
  issueToken
};
