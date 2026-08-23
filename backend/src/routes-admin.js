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
  return db.query(
    config,
    `SELECT l.id, l.chave, l.plano, l.status, l.max_dispositivos, l.criada_em, l.expira_em,
            l.renovada_em, l.bloqueada_em, l.observacao,
            u.email AS usuario_email,
            (SELECT COUNT(*) FROM dispositivos d WHERE d.licenca_id = l.id AND d.ativo = 1) AS dispositivos_ativos
       FROM licencas l
       LEFT JOIN usuarios u ON u.id = l.usuario_id
      ORDER BY l.id DESC
      LIMIT 500`
  );
}

async function createLicenses(body) {
  const plano = String(body.plano || 'mensal');
  const maxDisp = Number(body.maxDispositivos || config.license.defaultMaxDevices);
  const dias = Number(body.dias || config.license.defaultDays);
  const qtd = Math.min(50, Math.max(1, Number(body.quantidade || 1)));
  const observacao = body.observacao ? String(body.observacao).slice(0, 255) : null;
  let email = body.email ? String(body.email).trim().toLowerCase() : null;

  let usuarioId = null;
  if (email) {
    await db.query(
      config,
      'INSERT INTO usuarios (nome, email, criado_em) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE email = VALUES(email)',
      [email.split('@')[0], email]
    );
    const u = await db.queryOne(config, 'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    usuarioId = u ? u.id : null;
  }

  const created = [];
  for (let i = 0; i < qtd; i++) {
    const chave = generateLicenseKey();
    await db.query(
      config,
      `INSERT INTO licencas (chave, plano, status, max_dispositivos, criada_em, expira_em, observacao, usuario_id)
       VALUES (?, ?, 'ativa', ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)`,
      [chave, plano, maxDisp, dias, observacao, usuarioId]
    );
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
      await db.query(config, "UPDATE licencas SET status = IF(expira_em > NOW(), 'ativa', 'expirada'), bloqueada_em = NULL WHERE id = ?", [lic.id]);
      break;
    case 'renew': {
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
  router.get('/api/v1/admin/updates', async () => ({
    ok: true,
    updates: await db.query(
      config,
      `SELECT id, versao, url_download, changelog, obrigatoria, ativa, liberada_em
         FROM atualizacoes ORDER BY id DESC LIMIT 100`
    )
  }));

  router.post('/api/v1/admin/updates', async (body) => {
    const versao = String((body && body.versao) || '').trim();
    const url = String((body && body.url) || '').trim();
    const changelog = body && body.changelog ? String(body.changelog).slice(0, 2000) : null;
    const obrigatoria = !!(body && body.obrigatoria);
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
    await db.query(
      config,
      `INSERT INTO atualizacoes (versao, url_download, changelog, obrigatoria, ativa, liberada_em)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [versao, url, changelog, obrigatoria ? 1 : 0]
    );
    await db.query(config, 'INSERT INTO logs (evento, detalhe, criado_em) VALUES (?, ?, NOW())',
      ['update.published', JSON.stringify({ versao, obrigatoria })]);
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
    return {
      ok: true,
      stats: {
        licencas: totals || {},
        dispositivosAtivos: dispositivos ? dispositivos.n : 0,
        usuarios: usuarios ? usuarios.n : 0,
        porPlano,
        ativacoesSemana,
        versoes
      }
    };
  });
}

module.exports = { register };
