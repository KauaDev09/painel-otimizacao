'use strict';

// Rotas públicas consumidas pelo aplicativo desktop (sem autenticação).
// GET /api/v1/app/updates/latest — versão ativa mais recente publicada.
// Query opcional ?key=XXXX — se a licença vitalícia não tiver o pacote,
// a URL de download é omitida e requiresPurchase=true.

const db = require('./db');
const config = require('./config');

function cmpVer(a, b) {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function register(router) {
  router.get('/api/v1/app/updates/latest', async (_body, _params, urlObj) => {
    let upd;
    try {
      upd = await db.queryOne(
        config,
        `SELECT versao, url_download, changelog, obrigatoria, exige_pagamento, preco, liberada_em
           FROM atualizacoes
          WHERE ativa = 1
          ORDER BY id DESC
          LIMIT 1`
      );
    } catch (_) {
      upd = await db.queryOne(
        config,
        `SELECT versao, url_download, changelog, obrigatoria, liberada_em
           FROM atualizacoes
          WHERE ativa = 1
          ORDER BY id DESC
          LIMIT 1`
      );
    }
    if (!upd) return { ok: true, update: null };

    const key = urlObj ? String(urlObj.searchParams.get('key') || '').trim().toUpperCase() : '';
    let requiresPurchase = false;
    let downloadUrl = upd.url_download;

    if (key && upd.exige_pagamento) {
      const lic = await db.queryOne(
        config,
        'SELECT plano, expira_em, versao_autorizada, status FROM licencas WHERE chave = ? LIMIT 1',
        [key]
      );
      const lifetime = lic && (!lic.expira_em || lic.plano === 'vitalicia' || lic.plano === 'lifetime');
      if (lic && lic.status === 'ativa' && lifetime && lic.versao_autorizada) {
        if (cmpVer(upd.versao, lic.versao_autorizada) > 0) {
          requiresPurchase = true;
          downloadUrl = null;
        }
      }
    }

    return {
      ok: true,
      update: {
        version: upd.versao,
        downloadUrl,
        changelog: upd.changelog || '',
        mandatory: !!upd.obrigatoria && !requiresPurchase,
        releasedAt: upd.liberada_em,
        requiresPurchase,
        price: requiresPurchase ? Number(upd.preco || 15) : null,
        storeUrl: config.storePublicUrl || null
      }
    };
  });
}

module.exports = { register };
