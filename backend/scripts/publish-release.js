'use strict';

// Publicação de release: atualiza o banco para apontar site (/download) e
// updater (/api/v1/app/updates/latest e /api/v1/public/download) para o novo
// instalador do GitHub Releases.
// Uso: node scripts/publish-release.js  (na pasta backend/)
// Requer as variáveis do .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME...).

const path = require('path');
const { loadEnv } = require(path.join(__dirname, '..', 'src', 'loadEnv'));
loadEnv();

const mysql = require('mysql2/promise');

const RELEASE = {
  version: '2.1.0',
  filename: 'ORION.OPTIMIZER.Setup-2.1.0.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.1.0/ORION.OPTIMIZER.Setup-2.1.0.exe',
  changelog: [
    'Nova interface (React + shadcn/ui) e núcleo reativo Orion no login e dashboard.',
    'Predefinição Avançado: executa os 3 scripts Windows (Balanced, Full e Extreme).',
    'Endurecimento de segurança: navegação restrita, IPC validado, CSP e chave de licença criptografada em repouso.'
  ].join('\n'),
  obrigatoria: false,
  exige_pagamento: false,
  preco: 15
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });

  try {
    // 1) Downloads públicos (página /download e /api/v1/public/download)
    await conn.execute('UPDATE downloads SET is_latest = 0, active = 0 WHERE version <> ?', [RELEASE.version]);
    const [existing] = await conn.execute('SELECT id FROM downloads WHERE version = ? LIMIT 1', [RELEASE.version]);
    if (existing.length) {
      await conn.execute(
        'UPDATE downloads SET filename = ?, url = ?, release_notes = ?, is_latest = 1, active = 1 WHERE id = ?',
        [RELEASE.filename, RELEASE.url, RELEASE.changelog, existing[0].id]
      );
      console.log(`[ok] download v${RELEASE.version} atualizado para ativo/latest`);
    } else {
      await conn.execute(
        'INSERT INTO downloads (version, filename, url, release_notes, is_latest, active) VALUES (?,?,?,?,1,1)',
        [RELEASE.version, RELEASE.filename, RELEASE.url, RELEASE.changelog]
      );
      console.log(`[ok] download v${RELEASE.version} inserido como ativo/latest`);
    }

    // 2) Atualização publicada (updater do app)
    await conn.execute('UPDATE atualizacoes SET ativa = 0 WHERE ativa = 1');
    try {
      await conn.execute(
        `INSERT INTO atualizacoes (versao, url_download, changelog, obrigatoria, exige_pagamento, preco, ativa, liberada_em)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [RELEASE.version, RELEASE.url, RELEASE.changelog,
          RELEASE.obrigatoria ? 1 : 0, RELEASE.exige_pagamento ? 1 : 0,
          Number.isFinite(RELEASE.preco) ? RELEASE.preco : 15]
      );
    } catch (_) {
      await conn.execute(
        `INSERT INTO atualizacoes (versao, url_download, changelog, obrigatoria, ativa, liberada_em)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [RELEASE.version, RELEASE.url, RELEASE.changelog, RELEASE.obrigatoria ? 1 : 0]
      );
    }
    console.log(`[ok] atualização v${RELEASE.version} publicada como ativa`);

    const [rows] = await conn.execute(
      'SELECT id, versao, url_download, ativa FROM atualizacoes ORDER BY id DESC LIMIT 3'
    );
    console.log('\nÚltimas atualizações:');
    for (const r of rows) {
      console.log(`  id=${r.id} versao=${r.versao} ativa=${r.ativa}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});