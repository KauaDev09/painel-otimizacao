'use strict';

// Rotas administrativas (protegidas por token).
// Autenticação:
//   - POST /api/v1/admin/login  {usuario, senha}  → token de sessão (8h)
//   - Ou cabeçalho Authorization: Bearer <ADMIN_TOKEN> (token mestre de bootstrap)
// Endpoints: licenças (gerar/listar/bloquear/reativar/renovar), usuários,
// dispositivos, histórico e logs.

const db = require('./db');
const config = require('./config');
const { signToken, verifyToken, hashPassword, verifyPassword, generateLicenseKey } = require('./util');

function isAuthorized(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  if (config.adminToken && token === config.adminToken) return { role: 'master' };
  const payload = verifyToken(token, config.appSecret);
  if (payload && payload.typ === 'admin') return { role: 'admin', usuario: payload.usuario };
  return null;
}

async function listLicenses() {
  try {
    return await db.query(
      config,
      `SELECT l.id, l.chave, l.plano, l.status, l.max_dispositivos, l.criada_em, l.expira_em,
              l.renovada_em, l.bloqueada_em, l.observacao, l.versao_autorizada, l.pedido_loja,
              u.nome AS usuario_nome,
              u.email AS usuario_email,
              (SELECT COUNT(*) FROM dispositivos d WHERE d.licenca_id = l.id AND d.ativo = 1) AS dispositivos_ativos,
              (SELECT d.hostname FROM dispositivos d WHERE d.licenca_id = l.id AND d.ativo = 1
                ORDER BY d.ultimo_visto DESC LIMIT 1) AS maquina
         FROM licencas l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
        ORDER BY l.id DESC
        LIMIT 500`
    );
  } catch (_) {
    return db.query(
      config,
      `SELECT l.id, l.chave, l.plano, l.status, l.max_dispositivos, l.criada_em, l.expira_em,
              l.renovada_em, l.bloqueada_em, l.observacao,
              u.nome AS usuario_nome,
              u.email AS usuario_email,
              (SELECT COUNT(*) FROM dispositivos d WHERE d.licenca_id = l.id AND d.ativo = 1) AS dispositivos_ativos
         FROM licencas l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
        ORDER BY l.id DESC
        LIMIT 500`
    );
  }
}

async function upsertUsuarioByEmail(nome, email) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail) return null;
  let u = await db.queryOne(config, 'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [mail]);
  if (u) {
    if (nome) {
      await db.query(config, 'UPDATE usuarios SET nome = COALESCE(?, nome) WHERE id = ?', [nome, u.id]);
    }
    return u.id;
  }
  await db.query(
    config,
    'INSERT INTO usuarios (nome, email, criado_em) VALUES (?, ?, NOW())',
    [nome || mail, mail]
  );
  u = await db.queryOne(config, 'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [mail]);
  return u ? u.id : null;
}

async function currentPublishedVersion() {
  try {
    return await db.queryOne(
      config,
      `SELECT versao, exige_pagamento, preco, url_download FROM atualizacoes WHERE ativa = 1 ORDER BY id DESC LIMIT 1`
    );
  } catch (_) {
    return db.queryOne(
      config,
      `SELECT versao, url_download FROM atualizacoes WHERE ativa = 1 ORDER BY id DESC LIMIT 1`
    );
  }
}

async function insertPagamento(licencaId, valor, storeOrderId) {
  const amount = Number(valor);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    await db.query(
      config,
      `INSERT INTO pagamentos (licenca_id, valor, moeda, provedor, ref_externa, status, pago_em, criado_em)
       VALUES (?, ?, 'BRL', 'mercadopago', ?, 'aprovado', NOW(), NOW())`,
      [licencaId, safeAmount, storeOrderId]
    );
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) return { duplicate: true };
    throw err;
  }
  return { duplicate: false };
}

function licensePublic(lic, extra = {}) {
  return {
    key: lic.chave,
    plano: lic.plano,
    status: lic.status,
    expiresAt: lic.expira_em ? new Date(lic.expira_em).toISOString() : null,
    authorizedVersion: lic.versao_autorizada || null,
    createdAt: lic.criada_em ? new Date(lic.criada_em).toISOString() : null,
    ...extra
  };
}

async function findCustomerLicense(usuarioId) {
  if (!usuarioId) return null;
  return db.queryOne(
    config,
    `SELECT * FROM licencas
      WHERE usuario_id = ?
      ORDER BY (status = 'ativa') DESC,
               (expira_em IS NULL) DESC,
               id DESC
      LIMIT 1`,
    [usuarioId]
  );
}

/**
 * Provisiona/renova licença a partir da loja após pagamento aprovado.
 * Idempotente por storeOrderId (pagamentos.ref_externa).
 */
async function provisionFromStore(body) {
  const storeOrderId = String((body && body.storeOrderId) || '').trim();
  const email = String((body && body.email) || '').trim().toLowerCase();
  const nome = String((body && body.name) || '').trim().slice(0, 120) || email;
  const plano = String((body && body.plano) || '30d');
  const diasRaw = body && body.dias;
  const dias = diasRaw == null || diasRaw === '' ? null : Number(diasRaw);
  const isUpdate = plano === 'update' || plano === 'atualizacao';
  const isLifetime = plano === 'vitalicia' || plano === 'lifetime' || dias === 0;
  const valor = body && body.valor;

  if (!storeOrderId) return { ok: false, code: 'BAD_REQUEST', message: 'Pedido inválido.', status: 400 };
  if (!email) return { ok: false, code: 'BAD_REQUEST', message: 'Email do cliente é obrigatório.', status: 400 };
  if (!isUpdate && !isLifetime && (!Number.isFinite(dias) || dias < 1)) {
    return { ok: false, code: 'BAD_REQUEST', message: 'Duração da licença inválida.', status: 400 };
  }

  const existingPay = await db.queryOne(
    config,
    "SELECT * FROM pagamentos WHERE ref_externa = ? LIMIT 1",
    [storeOrderId]
  );
  if (existingPay && existingPay.licenca_id) {
    const lic = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [existingPay.licenca_id]);
    if (lic) {
      return { ok: true, alreadyProcessed: true, action: 'duplicate', ...licensePublic(lic) };
    }
  }

  const usuarioId = await upsertUsuarioByEmail(nome, email);
  const latest = await currentPublishedVersion();
  const latestVersion = (latest && latest.versao) || String((body && body.versaoAutorizada) || '1.0.0');

  if (isUpdate) {
    const lic = await findCustomerLicense(usuarioId);
    if (!lic) {
      return { ok: false, code: 'LICENSE_NOT_FOUND', message: 'Licença não encontrada para este cliente.', status: 404 };
    }
    const newVer = latestVersion;
    try {
      await db.query(config, 'UPDATE licencas SET versao_autorizada = ? WHERE id = ?', [newVer, lic.id]);
    } catch (err) {
      console.error('[provision] falha ao gravar versão autorizada', err.message || err);
      return { ok: false, code: 'LICENSE_UPDATE_FAILED', message: 'Não foi possível liberar a atualização.', status: 500 };
    }
    const pay = await insertPagamento(lic.id, valor, storeOrderId);
    if (pay.duplicate) {
      const again = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [lic.id]);
      return { ok: true, alreadyProcessed: true, action: 'duplicate', ...licensePublic(again) };
    }
    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.update_granted', lic.id, JSON.stringify({ storeOrderId, versao: newVer })]);
    const updated = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [lic.id]);
    return { ok: true, action: 'update_granted', alreadyProcessed: false, ...licensePublic(updated) };
  }

  const current = await findCustomerLicense(usuarioId);

  if (!current) {
    const chave = generateLicenseKey();
    try {
      if (isLifetime) {
        await db.query(
          config,
          `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id, versao_autorizada, pedido_loja)
           VALUES (?, 'vitalicia', 'ativa', ?, NOW(), NULL, ?, ?, ?, ?)`,
          [chave, config.license.defaultMaxDevices, 'loja:' + storeOrderId, usuarioId, latestVersion, storeOrderId]
        );
      } else {
        await db.query(
          config,
          `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id, versao_autorizada, pedido_loja)
           VALUES (?, ?, 'ativa', ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?, ?, ?)`,
          [chave, plano, config.license.defaultMaxDevices, dias, 'loja:' + storeOrderId, usuarioId, latestVersion, storeOrderId]
        );
      }
    } catch (err) {
      if (String(err.message || '').includes('versao_autorizada') || String(err.message || '').includes('pedido_loja')) {
        if (isLifetime) {
          await db.query(
            config,
            `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id)
             VALUES (?, 'vitalicia', 'ativa', ?, NOW(), NULL, ?, ?)`,
            [chave, config.license.defaultMaxDevices, 'loja:' + storeOrderId, usuarioId]
          );
        } else {
          await db.query(
            config,
            `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id)
             VALUES (?, ?, 'ativa', ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)`,
            [chave, plano, config.license.defaultMaxDevices, dias, 'loja:' + storeOrderId, usuarioId]
          );
        }
      } else {
        console.error('[provision] falha ao criar licença', err);
        return { ok: false, code: 'LICENSE_CREATE_FAILED', message: 'Erro ao gerar a licença.', status: 500 };
      }
    }
    const created = await db.queryOne(config, 'SELECT * FROM licencas WHERE chave = ? LIMIT 1', [chave]);
    await insertPagamento(created.id, valor, storeOrderId);
    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.store_created', created.id, JSON.stringify({ storeOrderId, plano, dias })]);
    return { ok: true, action: 'created', alreadyProcessed: false, ...licensePublic(created) };
  }

  const expired = current.expira_em && new Date(current.expira_em).getTime() <= Date.now();
  const currentIsLifetime = !current.expira_em || current.plano === 'vitalicia' || current.plano === 'lifetime';

  if (currentIsLifetime && !expired) {
    const pay = await insertPagamento(current.id, valor, storeOrderId);
    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.store_keep_lifetime', current.id, JSON.stringify({ storeOrderId, plano })]);
    return {
      ok: true,
      action: isLifetime ? 'already_lifetime' : 'keep_lifetime',
      alreadyProcessed: pay.duplicate,
      ...licensePublic(current)
    };
  }

  if (isLifetime) {
    try {
      await db.query(
        config,
        `UPDATE licencas
            SET plano = 'vitalicia', expira_em = NULL, status = 'ativa',
                versao_autorizada = COALESCE(versao_autorizada, ?),
                renovada_em = NOW(), bloqueada_em = NULL
          WHERE id = ?`,
        [latestVersion, current.id]
      );
    } catch (_) {
      await db.query(
        config,
        `UPDATE licencas SET plano = 'vitalicia', expira_em = NULL, status = 'ativa', renovada_em = NOW(), bloqueada_em = NULL WHERE id = ?`,
        [current.id]
      );
    }
    await insertPagamento(current.id, valor, storeOrderId);
    const updated = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [current.id]);
    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.store_upgrade_lifetime', current.id, JSON.stringify({ storeOrderId })]);
    return { ok: true, action: 'upgrade_lifetime', alreadyProcessed: false, ...licensePublic(updated) };
  }

  if (expired || current.status === 'expirada' || current.status === 'inativa') {
    await db.query(
      config,
      `UPDATE licencas
          SET plano = ?, expira_em = DATE_ADD(NOW(), INTERVAL ? DAY), status = 'ativa',
              renovada_em = NOW(), bloqueada_em = NULL
        WHERE id = ?`,
      [plano, dias, current.id]
    );
    await insertPagamento(current.id, valor, storeOrderId);
    const updated = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [current.id]);
    await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
      ['license.store_restarted', current.id, JSON.stringify({ storeOrderId, plano, dias })]);
    return { ok: true, action: 'restarted', alreadyProcessed: false, ...licensePublic(updated) };
  }

  await db.query(
    config,
    `UPDATE licencas
        SET plano = ?, expira_em = DATE_ADD(expira_em, INTERVAL ? DAY), status = 'ativa',
            renovada_em = NOW(), bloqueada_em = NULL
      WHERE id = ?`,
    [plano, dias, current.id]
  );
  await insertPagamento(current.id, valor, storeOrderId);
  const updated = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [current.id]);
  await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
    ['license.store_renewed', current.id, JSON.stringify({ storeOrderId, plano, dias })]);
  return { ok: true, action: 'renewed', alreadyProcessed: false, ...licensePublic(updated) };
}

async function createLicenses(body) {
  const plano = String(body.plano || 'mensal');
  const maxDisp = Number(body.maxDispositivos || config.license.defaultMaxDevices);
  const dias = Number(body.dias || config.license.defaultDays);
  const qtd = Math.min(50, Math.max(1, Number(body.quantidade || 1)));
  const observacao = body.observacao ? String(body.observacao).slice(0, 255) : null;
  let nome = body.nome ? String(body.nome).trim().slice(0, 120) : null;

  // Vincula a licença a um cliente identificado pelo nome.
  // O schema exige e-mail único: gera um endereço interno a partir do nome.
  let usuarioId = null;
  if (nome) {
    const slug = nome
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'cliente';
    let u = await db.queryOne(config, 'SELECT id FROM usuarios WHERE nome = ? LIMIT 1', [nome]);
    if (!u) {
      let email = `${slug}@clientes.local`;
      if (await db.queryOne(config, 'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email])) {
        email = `${slug}.${Date.now()}@clientes.local`;
      }
      await db.query(
        config,
        'INSERT INTO usuarios (nome, email, criado_em) VALUES (?, ?, NOW())',
        [nome, email]
      );
      u = await db.queryOne(config, 'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    }
    usuarioId = u ? u.id : null;
  }

  const created = [];
  const isLifetime = plano === 'vitalicia' || plano === 'lifetime' || dias === 0;
  for (let i = 0; i < qtd; i++) {
    const chave = generateLicenseKey();
    if (isLifetime) {
      await db.query(
        config,
        `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id)
         VALUES (?, 'vitalicia', 'ativa', ?, NOW(), NULL, ?, ?)`,
        [chave, maxDisp, observacao, usuarioId]
      );
    } else {
      await db.query(
        config,
        `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id)
         VALUES (?, ?, 'ativa', ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)`,
        [chave, plano, maxDisp, dias, observacao, usuarioId]
      );
    }
    created.push(chave);
  }
  return { ok: true, created };
}

async function licenseAction(id, body) {
  const action = String((body && body.action) || '');
  const dias = Number((body && body.dias) || 30);
  const lic = await db.queryOne(config, 'SELECT * FROM licencas WHERE id = ? LIMIT 1', [Number(id)]);
  if (!lic) return { ok: false, code: 'NOT_FOUND', message: 'Licença não encontrada.', status: 404 };

  switch (action) {
    case 'block':
      await db.query(config, "UPDATE licencas SET status = 'bloqueada', bloqueada_em = NOW() WHERE id = ?", [lic.id]);
      break;
    case 'unblock':
    case 'activate':
      await db.query(
        config,
        "UPDATE licencas SET status = IF(expira_em IS NULL OR expira_em > NOW(), 'ativa', 'expirada'), bloqueada_em = NULL WHERE id = ?",
        [lic.id]
      );
      break;
    case 'renew': {
      if (!lic.expira_em) {
        await db.query(
          config,
          "UPDATE licencas SET status = 'ativa', bloqueada_em = NULL, renovada_em = NOW() WHERE id = ?",
          [lic.id]
        );
        break;
      }
      const base = lic.expira_em && new Date(lic.expira_em) > new Date() ? new Date(lic.expira_em) : new Date();
      await db.query(
        config,
        "UPDATE licencas SET expira_em = DATE_ADD(?, INTERVAL ? DAY), status = 'ativa', bloqueada_em = NULL, renovada_em = NOW() WHERE id = ?",
        [base, dias, lic.id]
      );
      break;
    }
    case 'deactivate':
      await db.query(config, "UPDATE licencas SET status = 'inativa' WHERE id = ?", [lic.id]);
      break;
    case 'delete':
      await db.query(config, 'DELETE FROM licencas WHERE id = ?', [lic.id]);
      break;
    default:
      return { ok: false, code: 'BAD_ACTION', message: 'Ação inválida.', status: 400 };
  }
  await db.query(config, 'INSERT INTO logs (evento, licenca_id, detalhe, criado_em) VALUES (?, ?, ?, NOW())',
    [`admin.${action}`, lic.id, JSON.stringify({ by: 'admin', dias })]);
  return { ok: true };
}

function register(router) {
  router.post('/api/v1/admin/login', async (body) => {
    const usuario = String((body && body.usuario) || '').trim();
    const senha = String((body && body.senha) || '');
    if (!usuario || !senha) return { ok: false, code: 'BAD_REQUEST', message: 'Usuário e senha obrigatórios.', status: 400 };
    const admin = await db.queryOne(config, 'SELECT * FROM administradores WHERE usuario = ? AND ativo = 1 LIMIT 1', [usuario]);
    if (!admin || !verifyPassword(senha, admin.senha_hash)) {
      return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.', status: 401 };
    }
    await db.query(config, 'UPDATE administradores SET ultimo_login = NOW() WHERE id = ?', [admin.id]);
    return { ok: true, token: signToken({ typ: 'admin', usuario }, config.appSecret, 60 * 60 * 8) };
  });

  // ---- Demais rotas /api/v1/admin/* exigem autorização (login é público) ----
  router.use('/api/v1/admin/', async (req) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/v1/admin/login') return undefined; // público
    const auth = isAuthorized(req);
    if (!auth) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado.', status: 401 };
    }
  });

  router.get('/api/v1/admin/licenses', async () => ({ ok: true, licenses: await listLicenses() }));
  router.post('/api/v1/admin/licenses', async (body) => createLicenses(body));
  router.post('/api/v1/admin/licenses/provision', async (body) => provisionFromStore(body));
  router.post('/api/v1/admin/licenses/:id/action', async (body, params) => licenseAction(params.id, body));

  router.get('/api/v1/admin/users', async () => ({
    ok: true,
    users: await db.query(
      config,
      `SELECT u.id, u.nome, u.email, u.ativo, u.criado_em,
              (SELECT COUNT(*) FROM licencas l WHERE l.usuario_id = u.id) AS licencas
         FROM usuarios u ORDER BY u.id DESC LIMIT 500`
    )
  }));

  router.get('/api/v1/admin/devices', async () => ({
    ok: true,
    devices: await db.query(
      config,
      `SELECT d.id, d.hostname, d.machine_id, d.primeiro_visto, d.ultimo_visto, d.ativo,
              l.chave, l.plano, l.status, l.expira_em
         FROM dispositivos d JOIN licencas l ON l.id = d.licenca_id
        ORDER BY d.ultimo_visto DESC LIMIT 500`
    )
  }));

  router.get('/api/v1/admin/history', async (_body, params, urlObj) => {
    const limit = Math.min(200, Number(urlObj.searchParams.get('limit') || 100));
    const otim = await db.query(
      config,
      `SELECT h.id, h.analisado_em, h.score, h.boot_mode, l.chave, d.hostname
         FROM historico_otimizacoes h
         JOIN licencas l ON l.id = h.licenca_id
         LEFT JOIN dispositivos d ON d.id = h.dispositivo_id
        ORDER BY h.id DESC LIMIT ${limit}`
    );
    const seg = await db.query(
      config,
      `SELECT a.id, a.analisado_em, a.score, a.ameacas_total, a.ameacas_ativas, l.chave, d.hostname
         FROM analises_seguranca a
         JOIN licencas l ON l.id = a.licenca_id
         LEFT JOIN dispositivos d ON d.id = a.dispositivo_id
        ORDER BY a.id DESC LIMIT ${limit}`
    );
    return { ok: true, otimizacoes: otim, seguranca: seg };
  });

  router.get('/api/v1/admin/logs', async (_body, _params, urlObj) => {
    const limit = Math.min(500, Number(urlObj.searchParams.get('limit') || 200));
    return {
      ok: true,
      logs: await db.query(
        config,
        `SELECT lg.id, lg.evento, lg.detalhe, lg.criado_em, l.chave
           FROM logs lg LEFT JOIN licencas l ON l.id = lg.licenca_id
          ORDER BY lg.id DESC LIMIT ${limit}`
      )
    };
  });

  // ---- Atualizações do aplicativo ----
  router.get('/api/v1/admin/updates', async () => {
    try {
      return {
        ok: true,
        updates: await db.query(
          config,
          `SELECT id, versao, url_download, changelog, obrigatoria, exige_pagamento, preco, ativa, liberada_em
             FROM atualizacoes ORDER BY id DESC LIMIT 100`
        )
      };
    } catch (_) {
      return {
        ok: true,
        updates: await db.query(
          config,
          `SELECT id, versao, url_download, changelog, obrigatoria, ativa, liberada_em
             FROM atualizacoes ORDER BY id DESC LIMIT 100`
        )
      };
    }
  });

  router.post('/api/v1/admin/updates', async (body) => {
    const versao = String((body && body.versao) || '').trim();
    const url = String((body && body.url) || '').trim();
    const changelog = body && body.changelog ? String(body.changelog).slice(0, 2000) : null;
    const obrigatoria = !!(body && body.obrigatoria);
    const exigePagamento = !!(body && (body.exigePagamento || body.exige_pagamento));
    const preco = Number((body && body.preco) != null ? body.preco : 15);
    if (!/^\d+\.\d+\.\d+$/.test(versao)) {
      return { ok: false, code: 'BAD_VERSION', message: 'Versão deve seguir o formato X.Y.Z (ex.: 2.1.0).', status: 400 };
    }
    let parsed;
    try { parsed = new URL(url); } catch (_) {
      return { ok: false, code: 'BAD_URL', message: 'Informe uma URL de download válida.', status: 400 };
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, code: 'BAD_URL', message: 'A URL deve ser http/https.', status: 400 };
    }
    await db.query(config, 'UPDATE atualizacoes SET ativa = 0 WHERE ativa = 1');
    try {
      await db.query(
        config,
        `INSERT INTO atualizacoes (versao, url_download, changelog, obrigatoria, exige_pagamento, preco, ativa, liberada_em)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [versao, url, changelog, obrigatoria ? 1 : 0, exigePagamento ? 1 : 0, Number.isFinite(preco) ? preco : 15]
      );
    } catch (_) {
      await db.query(
        config,
        `INSERT INTO atualizacoes (versao, url_download, changelog, obrigatoria, ativa, liberada_em)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [versao, url, changelog, obrigatoria ? 1 : 0]
      );
    }
    await db.query(config, 'INSERT INTO logs (evento, detalhe, criado_em) VALUES (?, ?, NOW())',
      ['update.published', JSON.stringify({ versao, obrigatoria, exigePagamento })]);
    return { ok: true };
  });

  router.post('/api/v1/admin/updates/:id/toggle', async (_body, params) => {
    const id = Number(params.id);
    const upd = await db.queryOne(config, 'SELECT * FROM atualizacoes WHERE id = ? LIMIT 1', [id]);
    if (!upd) return { ok: false, code: 'NOT_FOUND', message: 'Atualização não encontrada.', status: 404 };
    if (!upd.ativa) await db.query(config, 'UPDATE atualizacoes SET ativa = 0 WHERE ativa = 1');
    await db.query(config, 'UPDATE atualizacoes SET ativa = ? WHERE id = ?', [upd.ativa ? 0 : 1, id]);
    return { ok: true };
  });

  // ---- Estatísticas para o painel administrativo ----
  router.get('/api/v1/admin/stats', async () => {
    const totals = await db.queryOne(config, `
      SELECT
        COUNT(*)                                            AS total,
        SUM(status = 'ativa')                               AS ativas,
        SUM(status = 'bloqueada')                           AS bloqueadas,
        SUM(status = 'expirada')                            AS expiradas,
        SUM(status = 'inativa')                             AS inativas,
        SUM(plano = 'vitalicia')                            AS vitalicias,
        SUM(plano <> 'vitalicia')                           AS pagas
      FROM licencas`);
    const dispositivos = await db.queryOne(config,
      'SELECT COUNT(*) AS n FROM dispositivos WHERE ativo = 1');
    const usuarios = await db.queryOne(config,
      'SELECT COUNT(*) AS n FROM usuarios');
    const porPlano = await db.query(config,
      `SELECT plano, COUNT(*) AS n FROM licencas GROUP BY plano ORDER BY n DESC`);
    const ativacoesSemana = await db.query(config, `
      SELECT DATE(primeiro_visto) AS dia, COUNT(*) AS n
        FROM dispositivos
       WHERE primeiro_visto >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(primeiro_visto)
       ORDER BY dia`);
    const versoes = await db.query(config, `
      SELECT h.versao, COUNT(*) AS n FROM (
        SELECT JSON_UNQUOTE(JSON_EXTRACT(hardware_json, '$.appVersion')) AS versao
          FROM historico_otimizacoes
         ORDER BY id DESC LIMIT 500
      ) h WHERE h.versao IS NOT NULL GROUP BY h.versao`);
    const latestUpdate = await db.queryOne(config,
      `SELECT versao, obrigatoria, liberada_em FROM atualizacoes WHERE ativa = 1 ORDER BY id DESC LIMIT 1`);
    return {
      ok: true,
      stats: {
        licencas: totals || {},
        dispositivosAtivos: dispositivos ? dispositivos.n : 0,
        usuarios: usuarios ? usuarios.n : 0,
        porPlano,
        ativacoesSemana,
        versoes,
        latestUpdate: latestUpdate || null
      }
    };
  });
}

module.exports = { register };
