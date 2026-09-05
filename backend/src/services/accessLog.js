'use strict';

const db = require('../db');

let ready = false;

async function ensureTable(cfg) {
  if (ready) return;
  await db.query(cfg, `
    CREATE TABLE IF NOT EXISTS access_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip VARCHAR(45) NULL,
      path VARCHAR(240) NULL,
      method VARCHAR(12) NULL,
      user_agent VARCHAR(255) NULL,
      user_id INT UNSIGNED NULL,
      license_key VARCHAR(32) NULL,
      event VARCHAR(40) NOT NULL DEFAULT 'http',
      INDEX idx_al_created (created_at),
      INDEX idx_al_ip (ip),
      INDEX idx_al_event (event)
    ) ENGINE=InnoDB
  `);
  await db.query(cfg, `
    CREATE TABLE IF NOT EXISTS exclusoes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      email_hash CHAR(64) NULL,
      motivo VARCHAR(80) NULL
    ) ENGINE=InnoDB
  `);
  ready = true;
}

function clientIp(req) {
  const fwd = req && req.headers ? String(req.headers['x-forwarded-for'] || '') : '';
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first.slice(0, 45);
  }
  return ((req && req.socket && req.socket.remoteAddress) || '').slice(0, 45) || null;
}

async function write(cfg, rec) {
  try {
    await ensureTable(cfg);
    await db.query(
      cfg,
      `INSERT INTO access_logs (ip, path, method, user_agent, user_id, license_key, event)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.ip || null,
        String(rec.path || '').slice(0, 240) || null,
        String(rec.method || 'GET').slice(0, 12),
        String(rec.userAgent || '').slice(0, 255) || null,
        rec.userId || null,
        rec.licenseKey ? String(rec.licenseKey).slice(0, 32) : null,
        String(rec.event || 'http').slice(0, 40)
      ]
    );
  } catch (err) {
    console.error('[access-log]', err && err.message);
  }
}

async function list(cfg, limit) {
  await ensureTable(cfg);
  const n = Math.min(500, Math.max(1, Number(limit) || 200));
  return db.query(
    cfg,
    `SELECT id, created_at, ip, path, method, user_agent, user_id, license_key, event
       FROM access_logs ORDER BY id DESC LIMIT ${n}`
  );
}

async function recordErasure(cfg, emailHash, motivo) {
  await ensureTable(cfg);
  await db.query(
    cfg,
    'INSERT INTO exclusoes (email_hash, motivo) VALUES (?, ?)',
    [emailHash || null, String(motivo || 'pedido_cliente').slice(0, 80)]
  );
}

module.exports = { ensureTable, write, list, clientIp, recordErasure };
