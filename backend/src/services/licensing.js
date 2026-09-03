'use strict';

// LicensingService — regras de negócio de licenças por plano, criação de
// licença após pagamento confirmado e resolução de features. Centraliza a
// lógica para não duplicar entre rotas públicas, webhook e admin.

const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { generateLicenseKey, signToken } = require('../util');

const DAY_MS = 86400000;

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

// ---------- helpers de features / plano ----------
function parseFeatures(json) {
  if (Array.isArray(json)) return json.map(String);
  if (typeof json === 'string') {
    try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(String) : []; }
    catch (_) { return []; }
  }
  return [];
}

async function getPlanBySlug(slug) {
  if (!slug) return null;
  return db.queryOne(
    config,
    'SELECT * FROM plans WHERE slug = ? AND active = 1 LIMIT 1',
    [String(slug).toLowerCase()]
  );
}

async function getPlanById(id) {
  if (!id) return null;
  return db.queryOne(config, 'SELECT * FROM plans WHERE id = ? LIMIT 1', [Number(id)]);
}

// Retorna a lista de features de um plano (do banco) + o plano.
function planWithFeatures(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    price: Number(plan.price),
    currency: plan.currency,
    billingType: plan.billing_type,
    features: parseFeatures(plan.features)
  };
}

// ---------- licença ----------
async function loadLicenseByKey(key) {
  return db.queryOne(
    config,
    'SELECT * FROM licencas WHERE chave = ? LIMIT 1',
    [String(key || '').trim().toUpperCase()]
  );
}

// Resolve as features permitidas de uma licença (do plano vinculado).
async function featuresForLicense(lic) {
  if (!lic) return [];
  // Prioridade: plan_slug -> plano (legado)
  let plan = null;
  if (lic.plan_slug) plan = await getPlanBySlug(lic.plan_slug);
  if (!plan && lic.plano) {
    const slug = String(lic.plano).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (['starter', 'pro', 'ultra'].includes(slug)) plan = await getPlanBySlug(slug);
  }
  return plan ? parseFeatures(plan.features) : [];
}

function isLifetime(lic) {
  return !lic.expira_em || lic.plano === 'vitalicia' || lic.plano === 'lifetime';
}

async function recordActivation(lic, machineId, ipHash) {
  try {
    await db.query(
      config,
      `INSERT INTO license_activations (license_id, device_id, activated_at, last_seen_at, ip_hash)
       VALUES (?, ?, NOW(), NOW(), ?)
       ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
      [lic.id, machineId ? String(machineId).slice(0, 64) : null, ipHash || null]
    );
    await db.query(
      config,
      'UPDATE licencas SET activation_count = activation_count + 1, last_validation_at = NOW() WHERE id = ?',
      [lic.id]
    );
  } catch (_) { /* não blocking */ }
}

// Valida a licença (ativa, não expirada, pagamento confirmado) e devolve
// features + plano. Modelo novo para /api/v1/public/validar-key e /validate.
async function validateLicense(key, opts = {}) {
  const machineId = opts.machineId || opts.device_id || '';
  const lic = await loadLicenseByKey(key);
  if (!lic) return fail('LICENSE_INVALID', 'Licença inválida.', 404);
  if (lic.status === 'bloqueada') return fail('LICENSE_REVOKED', 'Licença revogada.', 403);
  if (lic.status !== 'ativa') return fail('LICENSE_INVALID', 'Licença não está ativa.', 403);
  if (lic.expira_em && new Date(lic.expira_em).getTime() <= Date.now()) {
    await db.query(config, "UPDATE licencas SET status = 'expirada' WHERE id = ?", [lic.id]);
    return fail('LICENSE_EXPIRED', 'Licença expirada.', 403);
  }

  // Pagamento confirmado — a licença só existe se o pedido estiver pago.
  if (lic.order_id) {
    const order = await db.queryOne(config, 'SELECT status FROM orders WHERE id = ? LIMIT 1', [lic.order_id]);
    if (order && order.status !== 'paid') return fail('PAYMENT_NOT_CONFIRMED', 'Pagamento ainda não confirmado.', 403);
  }

  // Limite de dispositivos (via tabela dispositivos legada).
  if (machineId) {
    const count = await db.queryOne(
      config,
      'SELECT COUNT(*) AS n FROM dispositivos WHERE licenca_id = ? AND ativo = 1',
      [lic.id]
    );
    const limit = lic.max_dispositivos ?? config.license.defaultMaxDevices;
    const has = await db.queryOne(
      config,
      'SELECT id FROM dispositivos WHERE licenca_id = ? AND machine_id = ? LIMIT 1',
      [lic.id, machineId]
    );
    if (!has && count && count.n >= limit) return fail('ACTIVATION_LIMIT', 'Limite de dispositivos atingido.', 403);
    if (opts.registerDevice) {
      await recordActivation(lic, machineId, opts.ip_hash || null);
    }
  }

  const features = await featuresForLicense(lic);
  const plan = lic.plan_slug || lic.plano || 'pro';
  const token = signToken({ lic: lic.id, mid: machineId, typ: 'client' }, config.appSecret, 60 * 60 * 24 * 30);

  return {
    ok: true,
    valid: true,
    license: {
      key,
      plan,
      planSlug: lic.plan_slug || null,
      status: 'active',
      expiresAt: lic.expira_em ? new Date(lic.expira_em).toISOString() : null,
      lifetime: isLifetime(lic)
    },
    features,
    token
  };
}

// Cria/associa licença ao pedido pago e ao plano (chamado pelo webhook).
// Modelo MENSAL: toda licença expira em 30 dias. Se o usuário já tiver uma
// licença ativa e renovar, a validade é ESTENDIDA (soma 30 dias sobre a data
// atual de expiração, se ainda não expirou), nunca resetada.
async function grantLicenseForPaidOrder(order, customer) {
  const plan = await getPlanById(order.plan_id);
  if (!plan) return { ok: false, code: 'PLAN_NOT_FOUND', message: 'Plano não encontrado.', status: 404 };
  const planSlug = plan.slug;

  // Reutiliza a licença ativa do usuário se houver (renova/upgrade)
  let lic = customer && customer.id
    ? await db.queryOne(
        config,
        `SELECT * FROM licencas WHERE usuario_id = ?
          ORDER BY (status = 'ativa') DESC, id DESC LIMIT 1`,
        [customer.id]
      )
    : null;

  if (lic && lic.status === 'ativa') {
    // RENOVAÇÃO MENSAL: estende a validade a partir de hoje (ou da expiração
    // atual se ainda não expirou), somando 30 dias.
    const base = lic.expira_em && new Date(lic.expira_em).getTime() > Date.now()
      ? new Date(lic.expira_em)
      : new Date();
    base.setDate(base.getDate() + 30);
    await db.query(
      config,
      `UPDATE licencas
          SET plan_slug = ?, plano = ?, order_id = ?, status = 'ativa',
              expira_em = ?, versao_autorizada = COALESCE(versao_autorizada, ?),
              renovada_em = NOW(), bloqueada_em = NULL
        WHERE id = ?`,
      [planSlug, plan.name, order.id, base, null, lic.id]
    );
    lic.expira_em = base;
  } else if (lic && lic.status !== 'ativa') {
    // Renovação de licença que estava expirada/bloqueada: reativa com 30 dias.
    const base = new Date();
    base.setDate(base.getDate() + 30);
    await db.query(
      config,
      `UPDATE licencas
          SET plan_slug = ?, plano = ?, order_id = ?, status = 'ativa',
              expira_em = ?, versao_autorizada = COALESCE(versao_autorizada, ?),
              renovada_em = NOW(), bloqueada_em = NULL
        WHERE id = ?`,
      [planSlug, plan.name, order.id, base, null, lic.id]
    );
    lic.expira_em = base;
  } else {
    // Nova compra: cria licença com expiração em 30 dias.
    const chave = generateLicenseKey();
    const expira = new Date();
    expira.setDate(expira.getDate() + 30);
    await db.query(
      config,
      `INSERT INTO licencas
         (chave, plano, plan_slug, status, max_dispositivos, usuario_id, order_id,
          criada_em, expira_em, observacao)
       VALUES (?, ?, ?, 'ativa', ?, ?, ?,
               NOW(), ?, ?)`,
      [chave, plan.name, planSlug, config.license.defaultMaxDevices,
       customer ? customer.id : null, order.id, expira, 'compra:' + order.order_uuid]
    );
    lic = await db.queryOne(config, 'SELECT * FROM licencas WHERE chave = ? LIMIT 1', [chave]);
  }

  // Registra detalhes do pagamento vinculado ao pedido.
  const features = parseFeatures(plan.features);
  return { ok: true, license: lic, features };
}

async function registerOrderPayment(provider, providerPaymentId, order, paymentStatus, rawStatus, amount) {
  const statusMap = { approved: 'aprovado', pending: 'pendente', rejected: 'recusado', refunded: 'reembolsado' };
  const st = statusMap[paymentStatus] || 'pendente';
  try {
    await db.query(
      config,
      `INSERT INTO pagamentos (licenca_id, order_id, valor, moeda, provedor, ref_externa, provider_payment_id, status, raw_status, pago_em, criado_em)
       VALUES (NULL, ?, ?, 'BRL', ?, ?, ?, ?, ?, IF(?='aprovado', NOW(), NULL), NOW())`,
      [order.id, Number(amount || order.amount), provider, order.order_uuid,
       providerPaymentId || null, st, rawStatus || null, st]
    );
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) return { duplicate: true };
    throw err;
  }
  return { duplicate: false };
}

module.exports = {
  fail,
  getPlanBySlug,
  getPlanById,
  planWithFeatures,
  featuresForLicense,
  validateLicense,
  grantLicenseForPaidOrder,
  registerOrderPayment,
  loadLicenseByKey,
  parseFeatures,
  isLifetime
};
