'use strict';

// Utilidades: tokens HMAC, hash de senha (scrypt), geração de chaves e
// helpers de HTTP. Sem dependências externas — usa apenas node:crypto.

const crypto = require('crypto');

// ---------- Tokens HMAC (payload.payload-hmac em base64url) ----------
function b64u(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function signToken(payload, secret, ttlSeconds) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64u(body);
  const mac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${mac}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const [data, mac] = token.split('.');
  if (!data || !mac) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// ---------- Senhas (scrypt com salt aleatório) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [algo, salt, hash] = String(stored).split(':');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const test = crypto.scryptSync(String(password), salt, 32);
    const ref = Buffer.from(hash, 'hex');
    return test.length === ref.length && crypto.timingSafeEqual(test, ref);
  } catch (_) {
    return false;
  }
}

// ---------- Chaves de licença XXXX-XXXX-XXXX-XXXX ----------
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1

function generateLicenseKey() {
  const group = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length])
      .join('');
  return `${group()}-${group()}-${group()}-${group()}`;
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword, generateLicenseKey };
