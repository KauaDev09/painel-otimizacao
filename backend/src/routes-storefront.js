'use strict';

// Rotas públicas do SaaS + área do cliente + webhook de pagamento.
//
// Público (sem auth):  planos, download, validar-key
// Auth de cliente:     /conta (licenças), pedidos
// Webhook (assinado):  /webhooks/mercadopago

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { cmpVer, verifyToken } = require('./util');
const rateLimit = require('./rateLimit');
const backoffice = require('./services/accessLog');
const { createProvider } = require('./services/paymentProvider');
const licensing = require('./services/licensing');
const users = require('./services/users');
const sevenia = require('./sevenia');

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

// Rate limit por IP para rotas autenticadas/abertas da loja.
function ipLimited(scope, req, limit) {
  const rl = rateLimit.hit(`${scope}:${backoffice.clientIp(req) || 'unknown'}`, limit, config.security.storeAuthRateWindowMs);
  return rl.allowed ? null : rl.retryAfter;
}
function rateLimitedRetry(retryAfter) {
  return { ok: false, code: 'RATE_LIMITED', message: `Muitas tentativas. Tente novamente em ${retryAfter}s.`, status: 429 };
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
    productType: p.product_type || 'license',
    features: Array.isArray(p.features) ? p.features : (() => { try { return JSON.parse(p.features); } catch (_) { return []; } })()
  };
}

async function listPlans() {
  const rows = await db.query(
    config,
    `SELECT * FROM plans
      WHERE active = 1 AND COALESCE(product_type, 'license') = 'license'
      ORDER BY sort_order ASC, id ASC`
  );
  return rows.map(serializePlan);
}

// Instalador público: o site sempre oferece o .exe, mesmo se a tabela
// downloads estiver vazia. Sem login, sem chave, sem liberação.
const INSTALLER_DOWNLOAD_PATH = '/api/v1/public/installer';
const PUBLIC_INSTALLER = {
  version: '2.1.17',
  filename: 'SevenOptimizer-Setup-2.1.17.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.1.17/SevenOptimizer-Setup-2.1.17.exe',
  release_notes: 'Instalador oficial para Windows 10/11. SeteIA estabilizada e instalação atualizada.',
  is_latest: 1,
  created_at: '2026-09-21T14:42:38.000Z',
  size: '~107 MB'
};

function httpsUrl(raw) {
  try {
    const target = new URL(String(raw || '').trim());
    return target.protocol === 'https:' ? target : null;
  } catch (_) {
    return null;
  }
}

function installerWithOverride(download) {
  const override = httpsUrl(config.installerUrl);
  if (!override) return download;
  const filename = override.pathname.split('/').pop().replace(/[^0-9A-Za-z._-]/g, '_');
  const versionMatch = filename.match(/\d+\.\d+\.\d+/);
  return {
    ...download,
    version: versionMatch ? versionMatch[0] : download.version,
    filename: filename || download.filename,
    url: override.href
  };
}

async function latestDownload() {
  let download = PUBLIC_INSTALLER;
  try {
    const row = await db.queryOne(
      config,
      'SELECT * FROM downloads WHERE active = 1 ORDER BY is_latest DESC, id DESC LIMIT 1'
    );
    if (row && cmpVer(row.version, PUBLIC_INSTALLER.version) >= 0 && httpsUrl(row.url)) download = row;
  } catch (_) { /* cai no instalador público */ }
  return installerWithOverride(download);
}

function serializeDownload(d) {
  if (!d) return null;
  return {
    version: d.version,
    filename: d.filename,
    url: INSTALLER_DOWNLOAD_PATH,
    releaseNotes: d.release_notes || d.releaseNotes || '',
    isLatest: !!(d.is_latest || d.isLatest),
    releasedAt: d.created_at ? new Date(d.created_at).toISOString() : (d.releasedAt || null),
    size: d.size || PUBLIC_INSTALLER.size
  };
}

function installerFilename(d) {
  const version = String((d && d.version) || 'latest').replace(/[^0-9A-Za-z._-]/g, '');
  const filename = String((d && d.filename) || '').replace(/[^0-9A-Za-z._-]/g, '_');
  return filename || `SevenOptimizer-Setup-${version || 'latest'}.exe`;
}

function installerTarget(d) {
  return httpsUrl(d && d.url);
}

function redirectInstaller(d, res) {
  const target = installerTarget(d);
  if (!target || !res || typeof res.writeHead !== 'function') {
    return fail('INSTALLER_UNAVAILABLE', 'Instalador temporariamente indisponível.', 503);
  }
  res.writeHead(302, {
    'Location': target.href,
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${installerFilename(d)}"`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });
  res.end();
  return undefined;
}

// ---------- registro/login de cliente ----------
async function handleRegister(body) {
  return users.register(body);
}
async function handleLogin(body) {
  return users.login(body);
}
async function handleLoginByKey(body) {
  return users.loginByKey(body);
}

// ---------- Criação de checkout ----------
async function validateCoupon(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return fail('COUPON_REQUIRED', 'Informe um código de cupom.', 400);
  const c = await db.queryOne(config, 'SELECT * FROM coupons WHERE code = ? LIMIT 1', [clean]);
  if (!c) return fail('COUPON_INVALID', 'Cupom inválido ou inexistente.', 404);
  if (!c.active) return fail('COUPON_INACTIVE', 'Este cupom está inativo.', 400);
  if (c.expires_at) {
    const exp = new Date(c.expires_at);
    if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return fail('COUPON_EXPIRED', 'Este cupom expirou.', 400);
    }
  }
  if (c.max_uses != null && Number(c.used_count || 0) >= Number(c.max_uses)) {
    return fail('COUPON_LIMIT', 'Este cupom atingiu o limite de usos.', 400);
  }
  const discountValue = Number(c.discount_value);
  if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
    return fail('COUPON_INVALID', 'Cupom inválido.', 400);
  }
  return { ok: true, coupon: c, discountPercent: discountValue, couponId: Number(c.id) };
}

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

  // Cupom de desconto (opcional).
  let coupon = null;
  let discountPercent = 0;
  if (body && body.coupon) {
    const r = await validateCoupon(body.coupon);
    if (!r.ok) return r;
    coupon = r;
    discountPercent = r.discountPercent;
    if (plan.billing_type === 'subscription' && discountPercent >= 100) {
      return fail('COUPON_INVALID', 'O desconto não pode ser de 100% para assinatura.', 400);
    }
  }

  const orderUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const baseAmount = Number(plan.price);
  const discount = Math.round((baseAmount * discountPercent) / 100 * 100) / 100;
  const amount = Math.max(0, Math.round((baseAmount - discount) * 100) / 100);

  const res = await db.query(
    config,
    `INSERT INTO orders (order_uuid, user_id, plan_id, plan_name, coupon_id, discount_percent, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [orderUuid, user ? user.id : null, plan.id, plan.name,
      coupon ? coupon.couponId : null, discountPercent, amount,
      String(plan.currency || 'BRL')]
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
    ['checkout.created', JSON.stringify({ order: orderUuid, plan: planSlug, amount, discountPercent })]);

  return {
    ok: true,
    order: {
      id: order.id,
      uuid: orderUuid,
      plan: plan.name,
      amount: Number(order.amount),
      currency: order.currency,
      status: order.status,
      discountPercent,
      originalAmount: Math.round(baseAmount * 100) / 100
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

    // Registra o uso do cupom quando o pedido com desconto é pago.
    if (order.coupon_id) {
      await db.query(config, 'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [order.coupon_id]);
    }

    const customer = order.user_id
      ? await db.queryOne(config, 'SELECT * FROM usuarios WHERE id = ? LIMIT 1', [order.user_id])
      : null;

    // Produto SevenIA (assistente de IA) → ativa o plano Pro, não gera licença.
    const planObj = await licensing.getPlanById(order.plan_id);
    const isSeveniaProduct = planObj && planObj.product_type === 'sevenia';
    if (isSeveniaProduct) {
      if (order.user_id) {
        const set = await sevenia.setPlan(order.user_id, 'pro', order.id);
        await db.query(config, 'INSERT INTO logs (evento, detalhe, criado_em) VALUES (?, ?, NOW())',
          ['sevenia.pro_activated', JSON.stringify({ userId: set.userId, order: order.order_uuid })]);
      }
    } else {
      const grant = await licensing.grantLicenseForPaidOrder(order, customer);
      if (!grant.ok) return grant;
      await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
        ['license.created', grant.license.id, JSON.stringify({ order: order.order_uuid, plan: order.plan_name })]);
    }
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
    return { ok: true, download: serializeDownload(d || PUBLIC_INSTALLER) };
  });

  router.get('/api/v1/public/installer', async (_body, _params, _urlObj, _req, res) => {
    const d = await latestDownload();
    return redirectInstaller(d || PUBLIC_INSTALLER, res);
  });

  // Resgate de chave: valida a key devolvendo plano + features (desktop).
  router.post('/api/v1/public/validar-key', async (body, _p, _u, req) => handleValidateKey(body, req));

  // ---- Autenticação de cliente ----
  router.post('/api/v1/store/register', async (body, _p, _u, req) => {
    const ra = ipLimited('store-register', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    return handleRegister(body);
  });
  router.post('/api/v1/store/login', async (body, _p, _u, req) => {
    const ra = ipLimited('store-login', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    return handleLogin(body);
  });
  router.post('/api/v1/store/login-key', async (body, _p, _u, req) => {
    const ra = ipLimited('store-login-key', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    return handleLoginByKey(body);
  });

  // ---- Checkout ----
  router.post('/api/v1/store/checkout', async (body, _params, _urlObj, req) => {
    const ra = ipLimited('store-checkout', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    const customer = getCustomer(req);
    return createCheckout(body, customer);
  });

  // Valida um cupom de desconto (retorna o percentual e o código, sem consumir).
  router.post('/api/v1/public/validate-coupon', async (body, _p, _u, req) => {
    const ra = ipLimited('store-coupon', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    const r = await validateCoupon(body && body.coupon);
    if (!r.ok) return r;
    return {
      ok: true,
      coupon: { code: r.coupon.code, discountPercent: r.discountPercent },
      message: `Cupom aplicado: ${Number(r.discountPercent).toFixed(0)}% de desconto`
    };
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

  router.post('/api/v1/store/account/erase', async (body, _p, _u, req) => {
    const customer = getCustomer(req);
    if (String((body && body.confirm) || '') !== 'APAGAR') {
      return fail('CONFIRM_REQUIRED', 'Digite APAGAR para confirmar a exclusão total.', 400);
    }
    return users.eraseByUserId(customer.id, 'pedido_conta');
  });

  router.post('/api/v1/public/erase-request', async (body, _p, _u, req) => {
    const ra = ipLimited('store-erase', req, config.security.storeAuthRateLimit);
    if (ra) return rateLimitedRetry(ra);
    if (String((body && body.confirm) || '') !== 'APAGAR') {
      return fail('CONFIRM_REQUIRED', 'Digite APAGAR para confirmar a exclusão total.', 400);
    }
    return users.eraseByKey(body && body.key, 'pedido_key');
  });

  router.post('/api/v1/public/access', async (body, _p, _u, req) => {
    const accessLog = require('./services/accessLog');
    await accessLog.write(config, {
      ip: accessLog.clientIp(req),
      path: body && body.path,
      method: 'PAGE',
      userAgent: req && req.headers && req.headers['user-agent'],
      event: String((body && body.event) || 'page')
    });
    return { ok: true };
  });
}

module.exports = { register, createCheckout, getCustomer };
