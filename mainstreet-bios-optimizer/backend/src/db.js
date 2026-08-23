'use strict';

// Pool MySQL (mysql2/promise). Instalado via `npm install` dentro de /server.

let pool = null;

function getPool(cfg) {
  if (!pool) {
    let mysql;
    try {
      mysql = require('mysql2/promise');
    } catch (_) {
      throw new Error('Dependência mysql2 ausente. Execute "npm install" na pasta server/.');
    }
    pool = mysql.createPool({
      host: cfg.db.host,
      port: cfg.db.port,
      user: cfg.db.user,
      password: cfg.db.password,
      database: cfg.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false
    });
  }
  return pool;
}

async function query(cfg, sql, params = []) {
  const [rows] = await getPool(cfg).query(sql, params);
  return rows;
}

async function queryOne(cfg, sql, params = []) {
  const rows = await query(cfg, sql, params);
  return rows[0] || null;
}

module.exports = { query, queryOne };
