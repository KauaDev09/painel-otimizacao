'use strict';

// Rotas públicas do SaaS + área do cliente + webhook de pagamento.
//
// Público (sem auth):  planos, download, validar-key
// Auth de cliente:     /conta (licenças), pedidos
// Webhook (assinado):  /webhooks/mercadopago

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { verifyToken } = require('./util');
const rateLimit = require('./rateLimit');
const { createProvider } = require('./services/paymentProvider');
const licensing = require('./services/licensing');
const users = require('./services/users');

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

// ---- Auth de cliente (Bearer token) -------------
function getCustomer(req) {
  const header = req && req.headers ? (req.headers['authorization'] || '') : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const payload = verifyToken(token, config.appSecret);
  if (!payload || payload.typ !== 'customer' || !payload.uid) return null;
  return { id: payload.uid };
}

function serializePlan(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: Number(p.price),
    currency: p.currency,
    billingType: p.billing_type,
    features: Array.isArray(p.features) ? p.features : (() => { try { return JSON.parse(p.features); } catch (_) { return []; } })()
  };
}

async function listPlans() {
  const rows = await db.query(
    config,
    'SELECT * FROM plans WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(serializePlan);
}

// Retorna o download atual (mais recente e ativo).
async function latestDownload() {
  return db.queryOne(
    config,
    'SELECT * FROM downloads WHERE active = 1 ORDER BY is_latest DESC, id DESC LIMIT 1'
  );
}

function serializeDownload(d) {
  if (!d) return null;
  return {
    version: d.version,
    filename: d.filename,
    url: d.url,
    releaseNotes: d.release_notes || '',
    isLatest: !!d.is_latest,
    releasedAt: d.created_at ? new Date(d.created_at).toISOString() : null
  };
}

// ---------- registro/login de cliente ----------
async function handleRegister(body) {
  return users.register(body);
}
async function handleLogin(body) {
  return users.login(body);
}

// ---------- Criação de checkout ----------
async function createCheckout(body, customer) {
  const planSlug = String((body && body.plan) || '').toLowerCase();
  const plan = await licensing.getPlanBySlug(planSlug);
  if (!plan) return fail('PLAN_NOT_FOUND', 'Plano não encontrado.', 404);

  // Não confiar em preço do frontend — usa o preço real do banco.
  let user = customer
    ? await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [customer.id])
    : null;

  // Cliente não logado: permite comprar fornecendo e-mail, criando/vinculando conta.
  if (!user && body && body.email) {
    user = await users.ensureUser({ name: body.name, email: body.email });
  }

  const orderUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const amount = Number(plan.price);
  const res = await db.query(
    config,
    `INSERT INTO orders (order_uuid, user_id, plan_id, plan_name, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [orderUuid, user ? user.id : null, plan.id, plan.name, amount, String(plan.currency || 'BRL')]
  );
  const order = await db.queryOne(config, 'SELECT * FROM orders WHERE id = ? LIMIT 1', [Number(res.insertId)]);

  // Chama o PaymentProvider de forma isolada.
  const provider = createProvider();
  let payment;
  try {
    payment = await provider.createCheckout({
      order,
      customer: user ? users.publicUser(user) : { name: body && body.name, email: body && body.email },
      plan: { name: plan.name, description: plan.description, price: amount, currency: plan.currency },
      method: String(body && body.method || '').toLowerCase()
    });
  } catch (err) {
    if (err.code === 'PAYMENT_NOT_CONFIGURED') {
      return fail('PAYMENT_NOT_CONFIGURED', 'Gateway de pagamento não configurado no servidor.', 503);
    }
    return fail('PAYMENT_CREATE_FAILED', err.message || 'Não foi possível iniciar o pagamento.', 502);
  }

  // Mantém o id do pedido por referência no gateway.
  await db.query(config, "UPDATE orders SET payment_provider = ? WHERE id = ?",
    [config.payment.provider, order.id]);

  await db.query(config, 'INSERT INTO logs (evento, detalhe, criado_em) VALUES (?, ?, NOW())',
    ['checkout.created', JSON.stringify({ order: orderUuid, plan: planSlug, amount })]);

  return {
    ok: true,
    order: {
      id: order.id,
      uuid: orderUuid,
      plan: plan.name,
      amount: Number(order.amount),
      currency: order.currency,
      status: order.status
    },
    checkout: payment,
    paymentMethods: ['pix', 'credit_card']
  };
}

// ---------- Webhook Mercado Pago ----------
async function handleWebhook(body, headers) {
  const provider = createProvider();
  let parsed;
  try {
    parsed = await provider.handleWebhook(body || {}, headers || {});
  } catch (_) {
    parsed = null;
  }
  if (!parsed || !parsed.paymentId) return { ok: false, code: 'INVALID_WEBHOOK', status: 400 };

  // Registro de evento com idempotência por (provider, eventId).
  const eventId = parsed.eventId || parsed.paymentId;
  try {
    await db.query(
      config,
      `INSERT INTO payment_webhook_events (provider, event_id, event_type, payload, status, created_at)
       VALUES (?, ?, ?, ?, 'received', NOW())`,
      [config.payment.provider, eventId, parsed.eventType || 'payment', JSON.stringify(body || {})]
    );
  } catch (err) {
    // Duplicado — já processado, responde 200 para não retrigger.
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) ||
        String(err && err.message || '').toLowerCase().includes('duplicate')) {
      return { ok: true, alreadyProcessed: true };
    }
    throw err;
  }

  // Consulta o pagamento no gateway para confirmar status real.
  let payment;
  try {
    payment = await provider.getPayment(parsed.paymentId);
  } catch (_) {
    await db.query(config, "UPDATE payment_webhook_events SET status='error' WHERE provider=? AND event_id=?",
      [config.payment.provider, eventId]);
    return { ok: false, code: 'PAYMENT_QUERY_FAILED', status: 502 };
  }

  await db.query(config, "UPDATE payment_webhook_events SET status='processed', processed_at=NOW() WHERE provider=? AND event_id=?",
    [config.payment.provider, eventId]);

  if (payment.status !== 'approved') {
    return { ok: true, ignored: true, status: payment.status };
  }

  // Encontra o pedido pela referência externa (order_uuid).
  const order = await db.queryOne(
    config,
    'SELECT * FROM orders WHERE order_uuid = ? LIMIT 1',
    [payment.externalRef]
  );
  if (!order) return { ok: true, ignored: true, reason: 'order_not_found' };

  // Confirma valor (não confia no webhook — usa o valor consultado).
  const expected = Number(order.amount);
  const paid = Number(payment.amount);
  if (Math.abs(expected - paid) > 0.01) {
    return { ok: false, code: 'AMOUNT_MISMATCH', message: 'Valor do pagamento não confere.', status: 409 };
  }

  if (order.status !== 'paid') {
    await db.query(config, "UPDATE orders SET status='paid', payment_id=?, updated_at=NOW() WHERE id=?",
      [payment.paymentId, order.id]);
    await licensing.registerOrderPayment(config.payment.provider, payment.paymentId, order,
      'approved', payment.rawStatus, payment.amount);

    const customer = order.user_id
      ? await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [order.user_id])
      : null;

    const grant = await licensing.grantLicenseForPaidOrder(order, customer);
    if (!grant.ok) return grant;

    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.created', grant.license.id, JSON.stringify({ order: order.order_uuid, plan: order.plan_name })]);
  }

  return { ok: true, processed: true };
}

// ---------- validar-key (para o painel desktop) ----------
async function handleValidateKey(body, req) {
  const key = String((body && body.license_key) || (body && body.key) || '').trim().toUpperCase();
  const deviceId = String((body && body.device_id) || (body && body.machineId) || '').trim();
  if (!key) return fail('BAD_REQUEST', 'license_key é obrigatória.', 400);

  // Proteção contra brute-force de keys e abuso — limita por IP.
  const ip = clientIp(req);
  const rlKey = `validarkey:${ip}`;
  const rl = rateLimit.hit(rlKey, config.security.keyRateLimit, config.security.keyRateWindowMs);
  if (!rl.allowed) {
    return {
      ok: false, code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.',
      status: 429, retryAfter: rl.retryAfter
    };
  }

  const result = await licensing.validateLicense(key, {
    machineId: deviceId,
    registerDevice: true
  });
  if (!result.ok) return { ok: false, valid: false, reason: result.code };
  return {
    ok: true,
    valid: true,
    license: result.license,
    features: result.features,
    token: result.token
  };
}

function clientIp(req) {
  const fwd = req && req.headers ? String(req.headers['x-forwarded-for'] || '') : '';
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

// ---------- Minha conta ----------
async function myAccount(customer) {
  const user = await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [customer.id]);
  if (!user) return fail('NOT_FOUND', 'Usuário não encontrado.', 404);

  const licenses = await db.query(
    config,
    `SELECT l.id, l.chave, l.plano, l.plan_slug, l.status, l.criada_em, l.expira_em,
            l.max_dispositivos,
            (SELECT COUNT(*) FROM dispositivos d WHERE d.licenca_id = l.id AND d.ativo=1) AS ativacoes,
            o.plan_name AS order_plan, o.amount, o.created_at AS order_date
       FROM licencas l
       LEFT JOIN orders o ON o.id = l.order_id
      WHERE l.usuario_id = ?
      ORDER BY l.id DESC`,
    [customer.id]
  );

  const orders = await db.query(
    config,
    `SELECT id, order_uuid, plan_name, amount, currency, status, payment_provider, created_at
       FROM orders WHERE user_id = ? ORDER BY id DESC`,
    [customer.id]
  );

  const features = {};
  for (const l of licenses) {
    const lic = { plan_slug: l.plan_slug, plano: l.plano };
    features[l.chave] = await licensing.featuresForLicense(lic);
  }

  return {
    ok: true,
    user: users.publicUser(user),
    licenses: licenses.map((l) => ({
      id: l.id,
      key: l.chave,
      plan: l.plan_slug || l.plano,
      status: l.status,
      createdAt: l.criada_em ? new Date(l.criada_em).toISOString() : null,
      expiresAt: l.expira_em ? new Date(l.expira_em).toISOString() : null,
      activations: l.ativacoes,
      maxActivations: l.max_dispositivos,
      orderAmount: l.amount != null ? Number(l.amount) : null,
      orderDate: l.order_date ? new Date(l.order_date).toISOString() : null,
      features: features[l.chave] || []
    })),
    orders: orders.map((o) => ({
      id: o.id,
      uuid: o.order_uuid,
      plan: o.plan_name,
      amount: Number(o.amount),
      currency: o.currency,
      status: o.status,
      provider: o.payment_provider,
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : null
    }))
  };
}

async function myLicenseKeys(customer) {
  const rows = await db.query(
    config,
    `SELECT chave, plan_slug, plano, status FROM licencas WHERE usuario_id = ? ORDER BY id DESC`,
    [customer.id]
  );
  return { ok: true, keys: rows.map((r) => ({ key: r.chave, plan: r.plan_slug || r.plano, status: r.status })) };
}

function register(router) {
  // ---- Conteúdo público ----
  router.get('/api/v1/public/plans', async () => ({ ok: true, plans: await listPlans() }));

  router.get('/api/v1/public/download', async () => {
    const d = await latestDownload();
    if (!d) return { ok: true, download: null };
    return { ok: true, download: serializeDownload(d) };
  });

  // Resgate de chave: valida a key devolvendo plano + features (desktop).
  router.post('/api/v1/public/validar-key', async (body, _p, _u, req) => handleValidateKey(body, req));

  // ---- Autenticação de cliente ----
  router.post('/api/v1/store/register', async (body) => handleRegister(body));
  router.post('/api/v1/store/login', async (body) => handleLogin(body));

  // ---- Checkout ----
  router.post('/api/v1/store/checkout', async (body, _params, _urlObj, req) => {
    const customer = getCustomer(req);
    return createCheckout(body, customer);
  });

  // ---- Webhook Mercado Pago (isolado do resto) ----
  router.post('/api/v1/public/webhooks/mercadopago', async (body, _params, _urlObj, req) => {
    return handleWebhook(body, req.headers);
  });

  // ---- Área do cliente (Bearer) ----
  router.use('/api/v1/store/account/', async (req) => {
    const customer = getCustomer(req);
    if (!customer) return { ok: false, code: 'UNAUTHORIZED', message: 'Não autenticado.', status: 401 };
  });
  router.get('/api/v1/store/account/me', async (_b, _p, _u, req) => {
    const customer = getCustomer(req);
    return myAccount(customer);
  });
  router.get('/api/v1/store/account/keys', async (_b, _p, _u, req) => {
    const customer = getCustomer(req);
    return myLicenseKeys(customer);
  });
}

module.exports = { register };
