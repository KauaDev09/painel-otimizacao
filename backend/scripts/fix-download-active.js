'use strict';

// Manutenção: garante que o download público (tabela `downloads`) aponte
// para o instalador canônico mais recente (2.0.6) e esteja marcado como
// ativo/latest, para que /api/v1/public/download e a página /download
// mostrem a versão correta.
// Uso: node scripts/fix-download-active.js  (na pasta backend/)

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');

const INSTALLER = {
  version: '2.0.6',
  filename: 'ORION.OPTIMIZER.Setup-2.0.6.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.0.6/ORION.OPTIMIZER.Setup-2.0.6.exe',
  notes: 'Instalador oficial para Windows 10/11. Use o aplicativo grátis, sem chave. Os planos desbloqueiam recursos avançados.'
};

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bios_optimizer',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });

  try {
    await conn.execute('UPDATE downloads SET is_latest = 0, active = 0 WHERE version <> ?', [INSTALLER.version]);
    const [existing] = await conn.execute('SELECT id FROM downloads WHERE version = ? LIMIT 1', [INSTALLER.version]);
    if (existing.length) {
      await conn.execute(
        'UPDATE downloads SET filename = ?, url = ?, release_notes = ?, is_latest = 1, active = 1 WHERE id = ?',
        [INSTALLER.filename, INSTALLER.url, INSTALLER.notes, existing[0].id]
      );
      console.log(`[ok] download v${INSTALLER.version} atualizado para ativo/latest`);
    } else {
      await conn.execute(
        'INSERT INTO downloads (version, filename, url, release_notes, is_latest, active) VALUES (?,?,?,?,1,1)',
        [INSTALLER.version, INSTALLER.filename, INSTALLER.url, INSTALLER.notes]
      );
      console.log(`[ok] download v${INSTALLER.version} inserido como ativo/latest`);
    }

    const [rows] = await conn.execute('SELECT id, version, filename, url, is_latest, active FROM downloads ORDER BY id DESC');
    console.log('\nLinhas da tabela downloads:');
    for (const r of rows) {
      console.log(`  id=${r.id} version=${r.version} latest=${r.is_latest} active=${r.active}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});
