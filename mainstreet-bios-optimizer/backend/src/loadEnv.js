'use strict';

// Loader mínimo de .env (sem dependências externas).
// Não sobrescreve variáveis já presentes no ambiente.

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const file = filePath || path.join(__dirname, '..', '.env');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return false;
  }
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

module.exports = { loadEnv };
