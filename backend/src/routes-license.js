'use strict';

// Rotas de licença e sincronização de histórico.
// POST /api/v1/license/activate   — ativa chave em um dispositivo
// POST /api/v1/license/validate   — valida estado (renovação/expiração/bloqueio)
// POST /api/v1/license/heartbeat  — mantém dispositivo "visto" sem criar vínculo
// POST /api/v1/history/sync       — recebe resumos de análises do aplicativo

const db = require('./db');
const config = require('./config');
const { signToken } = require('./util');

const DAY_MS = 86400000;

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

async function loadLicense(key) {
  const lic = await db.queryOne(
    config,
    'SELECT * FROM licencas WHERE chave = ? LIMIT 1',
    [String(key || '').trim().toUpperCase()]
  );
  return lic;
}

async function deviceCount(licencaId) {
  const row = await db.queryOne(
    config,
    'SELECT COUNT(*) AS n FROM dispositivos WHERE licenca_id = ? AND ativo = 1',
    [licencaId]
  );
  return row ? row.n : 0;
}

async function upsertDevice(licenca, machineId, hostname) {
  const existing = await db.queryOne(
    config,
    'SELECT id FROM dispositivos WHERE licenca_id = ? AND machine_id = ? LIMIT 1',
    [licenca.id, machineId]
  );
  if (existing) {
    await db.query(
      config,
      'UPDATE dispositivos SET hostname = COALESCE(?, hostname), ultimo_visto = NOW() WHERE id = ?',
      [hostname || null, existing.id]
    );
    return { deviceId: existing.id, created: false };
  }
  const count = await deviceCount(licenca.id);
  const limit = licenca.max_dispositivos ?? config.license.defaultMaxDevices;
  if (count >= limit) return { limitReached: true };
  const res = await db.query(
    config,
    `INSERT INTO dispositivos (licenca_id, machine_id, hostname, primeiro_visto, ultimo_visto, ativo)
     VALUES (?, ?, ?, NOW(), NOW(), 1)`,
    [licenca.id, machineId, hostname || null]
  );
  await db.query(
    config,
    `INSERT INTO ativacoes (licenca_id, dispositivo_id, ativada_em, ip)
     VALUES (?, ?, NOW(), NULL)`,
    [licenca.id, Number(res.insertId)]
  );
  return { deviceId: Number(res.insertId), created: true };
}

async function logEvent(evento, licencaId, detalhe) {
  try {
    await db.query(
      config,
      'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      [evento, licencaId, JSON.stringify(detalhe || {})]
    );
  } catch (_) { /* logging nunca derruba a API */ }
}

function licensePayload(lic, extra = {}) {
  const expiresMs = lic.expira_em ? new Date(lic.expira_em).getTime() : null;
  return {
    ok: true,
    status: 'active',
    plan: lic.plano || null,
    expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
    daysLeft: expiresMs ? Math.max(0, Math.ceil((expiresMs - Date.now()) / DAY_MS)) : null,
    ...extra
  };
}

// Resolve o estado da licença para um dispositivo.
async function resolveLicense(body, { bind }) {
  const key = String((body && body.key) || '').trim().toUpperCase();
  const machineId = String((body && body.machineId) || '').trim();
  const hostname = (body && body.hostname) || null;
  if (!key || !machineId) return fail('BAD_REQUEST', 'Chave e identificação da máquina são obrigatórias.');

  const lic = await loadLicense(key);
  if (!lic) return fail('LICENSE_NOT_FOUND', 'Licença não encontrada.', 404);
  if (lic.status === 'bloqueada') return fail('LICENSE_BLOCKED', 'Esta licença foi bloqueada.', 403);
  if (lic.status !== 'ativa') return fail('LICENSE_INACTIVE', 'Esta licença não está ativa.', 403);
  if (lic.expira_em && new Date(lic.expira_em).getTime() <= Date.now()) {
    await db.query(config, "UPDATE licencas SET status = 'expirada' WHERE id = ?", [lic.id]);
    await logEvent('license.expired', lic.id, { machineId });
    return fail('LICENSE_EXPIRED', 'Esta licença está expirada.', 403);
  }

  let deviceInfo = {};
  if (bind || (await db.queryOne(config, 'SELECT id FROM dispositivos WHERE licenca_id = ? AND machine_id = ? LIMIT 1', [lic.id, machineId]))) {
    const r = await upsertDevice(lic, machineId, hostname);
    if (r.limitReached) {
      await logEvent('license.device_limit', lic.id, { machineId });
      return fail('DEVICE_LIMIT', 'Limite de dispositivos atingido para esta licença.', 403);
    }
    const count = await deviceCount(lic.id);
    deviceInfo = { deviceRegistered: true, deviceCount: count, maxDevices: lic.max_dispositivos ?? config.license.defaultMaxDevices };
  }

  await logEvent(bind ? 'license.activate' : 'license.validate', lic.id, { machineId });
  const token = signToken({ lic: lic.id, mid: machineId, typ: 'client' }, config.appSecret, 60 * 60 * 24 * 30);
  return licensePayload(lic, { key, token, machineId, ...deviceInfo });
}

async function syncHistory(body) {
  const key = String((body && body.key) || '').trim().toUpperCase();
  const machineId = String((body && body.machineId) || '').trim();
  const type = String((body && body.type) || 'analysis');
  const entry = (body && body.entry) || {};

  const lic = await loadLicense(key);
  if (!lic || lic.status !== 'ativa') return fail('LICENSE_INVALID', 'Licença inválida.', 403);
  if (lic.expira_em && new Date(lic.expira_em).getTime() <= Date.now()) return fail('LICENSE_EXPIRED', 'Licença expirada.', 403);

  const device = await db.queryOne(
    config,
    'SELECT id FROM dispositivos WHERE licenca_id = ? AND machine_id = ? LIMIT 1',
    [lic.id, machineId]
  );

  if (type === 'security') {
    await db.query(
      config,
      `INSERT INTO analises_seguranca
         (licenca_id, dispositivo_id, analisado_em, score, ameacas_total, ameacas_ativas, defender_tempo_real)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lic.id,
        device ? device.id : null,
        entry.date ? new Date(entry.date) : new Date(),
        entry.score ?? null,
        entry.threatCount ?? null,
        entry.activeThreatCount ?? null,
        entry.defenderRealTime == null ? null : (entry.defenderRealTime ? 1 : 0)
      ]
    );
  } else {
    await db.query(
      config,
      `INSERT INTO historico_otimizacoes
         (licenca_id, dispositivo_id, analisado_em, score, categorias_json, contagens_json, hardware_json, boot_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lic.id,
        device ? device.id : null,
        entry.date ? new Date(entry.date) : new Date(),
        entry.score ?? null,
        JSON.stringify(entry.categories || {}),
        JSON.stringify(entry.counts || {}),
        JSON.stringify(entry.hardware || {}),
        entry.bootMode || null
      ]
    );
  }
  return { ok: true };
}

function register(router) {
  router.post('/api/v1/license/activate', async (body) => resolveLicense(body, { bind: true }));
  router.post('/api/v1/license/validate', async (body) => resolveLicense(body, { bind: true }));
  router.post('/api/v1/license/heartbeat', async (body) => resolveLicense(body, { bind: false }));
  router.post('/api/v1/history/sync', async (body) => syncHistory(body));
}

module.exports = { register };
