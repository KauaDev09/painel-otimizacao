'use strict';

// Aplica a Migration 004: converte planos para assinatura mensal (subscription)
// e ajusta licenças existentes (vitalícias -> expiram em 30 dias).
// Uso: node scripts/migrate-004-subscription.js  (na pasta backend/)

const mysql = require('mysql2/promise');
const { loadEnv } = require('../src/loadEnv');

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
    // 1) Todos os planos passam a ser assinatura mensal.
    const [plansRes] = await conn.execute(
      "UPDATE plans SET billing_type = 'subscription' WHERE billing_type <> 'subscription'"
    );
    console.log(`[ok] planos atualizados para subscription: ${plansRes.affectedRows || 0}`);

    // 2) Verifica se a coluna expira_em existe em licencas.
    const [cols] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'licencas' AND COLUMN_NAME = 'expira_em'`
    );
    if (Number(cols[0].n) > 0) {
      // Licenças ativas sem expiração (vitalícias) passam a expirar em 30 dias.
      const [licRes] = await conn.execute(
        "UPDATE licencas SET expira_em = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE expira_em IS NULL AND status = 'ativa'"
      );
      console.log(`[ok] licenças ativas vitalícias migradas para +30 dias: ${licRes.affectedRows || 0}`);
    } else {
      console.log('[warn] coluna licencas.expira_em não encontrada; nada a migrar em licenças.');
    }

    // Verificação final.
    const [plans] = await conn.execute('SELECT id, name, slug, billing_type FROM plans ORDER BY id');
    console.log('\nPlanos:');
    for (const p of plans) console.log(`  ${p.name} (${p.slug}) -> ${p.billing_type}`);

    const [lics] = await conn.execute(
      "SELECT COUNT(*) AS n FROM licencas WHERE expira_em IS NULL AND status = 'ativa'"
    );
    console.log(`\nLicenças ativas ainda sem expiração: ${lics[0].n || 0}`);
    console.log('\nMigration 004 aplicada com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Falha na migration:', err.message);
  process.exit(1);
});
