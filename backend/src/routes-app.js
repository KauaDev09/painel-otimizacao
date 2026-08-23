'use strict';

// Rotas públicas consumidas pelo aplicativo desktop (sem autenticação).
// GET /api/v1/app/updates/latest — versão ativa mais recente publicada.

const db = require('./db');
const config = require('./config');

function register(router) {
  router.get('/api/v1/app/updates/latest', async () => {
    const upd = await db.queryOne(
      config,
      `SELECT versao, url_download, changelog, obrigatoria, liberada_em
         FROM atualizacoes
        WHERE ativa = 1
        ORDER BY id DESC
        LIMIT 1`
    );
    if (!upd) return { ok: true, update: null };
    return {
      ok: true,
      update: {
        version: upd.versao,
        downloadUrl: upd.url_download,
        changelog: upd.changelog || '',
        mandatory: !!upd.obrigatoria,
        releasedAt: upd.liberada_em
      }
    };
  });
}

module.exports = { register };
