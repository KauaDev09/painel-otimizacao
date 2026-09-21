'use strict';

// SevenIA — endpoints de chat e uso (protegidos por token HMAC).

const db = require('./db');
const config = require('./config');
const { verifyToken } = require('./util');
const rateLimit = require('./rateLimit');
const sevenia = require('./sevenia');
const users = require('./services/users');
const licensing = require('./services/licensing');
const storefront = require('./routes-storefront');

function fail(code, message, status = 400) {
  return { ok: false, code, message, status };
}

const SYSTEM_PROMPT = [
  'Você é a SevenIA, assistente de otimização do Windows embutido no SevenOptimizer (S4).',
  'Responda em português do Brasil, de forma direta, técnica e segura.',
  'Você pode explicar configurações, interpretar o laudo do sistema e sugerir otimizações.',
  'NUNCA execute comandos, scripts nem modifique o sistema — apenas oriente.',
  'Não peça senhas, chaves de licença completas ou tokens.',
  'Se não souber, diga que não sabe em vez de inventar.'
].join(' ');

function clientIp(req) {
  const fwd = req && req.headers ? String(req.headers['x-forwarded-for'] || '') : '';
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

// Extrai o principal autenticado (portal web ou desktop) e resolve o user_id.
async function resolveUserId(req) {
  const header = req && req.headers ? (req.headers['authorization'] || '') : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: fail('UNAUTHORIZED', 'Não autenticado.', 401) };

  const payload = verifyToken(token, config.appSecret);
  if (!payload) return { error: fail('UNAUTHORIZED', 'Sessão inválida.', 401) };

  if (payload.typ === 'customer' && payload.uid) {
    const user = await db.queryOne(config, 'SELECT id FROM usuarios WHERE id = ? LIMIT 1', [payload.uid]);
    if (!user) return { error: fail('UNAUTHORIZED', 'Conta não encontrada.', 401) };
    return { userId: user.id };
  }

  if (payload.typ === 'client' && payload.lic) {
    const lic = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [payload.lic]);
    if (!lic || lic.status !== 'ativa') {
      return { error: fail('LICENSE_INVALID', 'Licença inválida para a SevenIA.', 403) };
    }
    if (lic.expira_em && new Date(lic.expira_em).getTime() <= Date.now()) {
      return { error: fail('LICENSE_EXPIRED', 'Licença expirada.', 403) };
    }
    const userId = await users.ensureUserForLicense(lic);
    if (!userId) return { error: fail('USER_ERROR', 'Não foi possível vincular a licença a um perfil.', 500) };
    return { userId };
  }

  return { error: fail('UNAUTHORIZED', 'Sessão inválida.', 401) };
}

function buildMessages(body) {
  const message = String((body && body.message) || '').trim();
  if (!message) return { error: fail('BAD_REQUEST', 'A mensagem é obrigatória.', 400) };
  if (message.length > config.sevenia.maxMessageLength) {
    return { error: fail('MESSAGE_TOO_LONG', 'A mensagem excede o limite de caracteres.', 400) };
  }

  const history = Array.isArray(body && body.history) ? body.history : [];
  const clean = history
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) => ({ role: h.role, content: h.content.slice(0, config.sevenia.maxMessageLength) }))
    .slice(-config.sevenia.maxHistory);
  clean.push({ role: 'user', content: message });
  return { messages: clean };
}

async function handleChat(body, req) {
  const rl = rateLimit.hit(`sevenia:${clientIp(req)}`, config.security.seveniaIpRateLimit, 60000);
  if (!rl.allowed) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.', status: 429, retryAfter: rl.retryAfter };
  }

  const { messages, error } = buildMessages(body);
  if (error) return error;

  const principal = await resolveUserId(req);
  if (principal.error) return principal.error;
  const { userId } = principal;

  const usage = await sevenia.usagePayload(userId);
  if (usage.used >= usage.limit) {
    return { ...fail('SEVENIA_QUOTA', 'Limite diário de mensagens atingido na SevenIA.', 429), usage };
  }

  const result = await sevenia.chatToGemini({ system: SYSTEM_PROMPT, messages });
  if (!result.ok) return result; // não consome cota se o modelo falhou

  await sevenia.consume(userId);
  const after = await sevenia.usagePayload(userId);
  return { ok: true, reply: result.text, model: config.sevenia.model, usage: after };
}

async function handleUsage(req) {
  const principal = await resolveUserId(req);
  if (principal.error) return principal.error;
  return { ok: true, usage: await sevenia.usagePayload(principal.userId) };
}

async function handleProInfo(req) {
  const customer = storefront.getCustomer(req);
  if (!customer) return fail('UNAUTHORIZED', 'Faça login para contratar a SevenIA Pro.', 401);
  const plan = await licensing.getPlanBySlug('sevenia_pro');
  if (!plan) return fail('SEVENIA_PRO_UNAVAILABLE', 'SevenIA Pro indisponível no momento.', 404);
  return {
    ok: true,
    plan: {
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: Number(plan.price),
      currency: plan.currency,
      billingType: plan.billing_type
    }
  };
}

async function handleProActivate(body, req) {
  const customer = storefront.getCustomer(req);
  if (!customer) return fail('UNAUTHORIZED', 'Faça login para ativar a SevenIA Pro.', 401);
  const method = String((body && body.method) || 'pix').toLowerCase();
  if (method !== 'pix' && method !== 'credit_card') {
    return fail('BAD_REQUEST', 'Método de pagamento inválido.', 400);
  }
  return storefront.createCheckout({ plan: 'sevenia_pro', method, coupon: body && body.coupon }, customer);
}

function register(router) {
  router.post('/api/v1/sevenia/chat', async (body, _p, _u, req) => handleChat(body, req));
  router.get('/api/v1/sevenia/uso-hoje', async (_b, _p, _u, req) => handleUsage(req));
  router.get('/api/v1/sevenia/ativar-pro', async (_b, _p, _u, req) => handleProInfo(req));
  router.post('/api/v1/sevenia/ativar-pro', async (body, _p, _u, req) => handleProActivate(body, req));
}

module.exports = { register };