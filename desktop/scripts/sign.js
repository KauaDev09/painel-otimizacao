'use strict';

// Assina um executável/instalador com signtool (Windows SDK).
//
// Pós-build, quando a assinatura é feita FORA do electron-builder:
//   node scripts/sign.js "release/SevenOptimizer-Setup-1.0.0.exe"
//
// Variáveis de ambiente:
//   SIGN_CERT_PFX   (obrigatório) caminho do .pfx
//   SIGN_PFX_PASS   (opcional)    senha do .pfx
//   SIGN_TSA        (opcional)    TSA, default timestamp.digicert.com
//
// Sem SIGN_CERT_PFX o script NÃO assina e avisa (não quebra o build diário).

const { execFileSync } = require('child_process');
const fs = require('fs');

const env = process.env;
const exe = process.argv[2];

if (!env.SIGN_CERT_PFX) {
  console.log('[sign] SIGN_CERT_PFX não definido — instalador permanece sem assinatura.');
  process.exit(0);
}
if (!exe || !fs.existsSync(exe)) {
  console.error('Uso: node scripts/sign.js <caminho-do-instalador.exe>');
  process.exit(2);
}

const args = ['sign', '/f', env.SIGN_CERT_PFX];
if (env.SIGN_PFX_PASS) args.push('/p', env.SIGN_PFX_PASS);
args.push(
  '/tr', env.SIGN_TSA || 'http://timestamp.digicert.com',
  '/td', 'SHA256',
  '/fd', 'SHA256',
  exe
);

try {
  execFileSync('signtool', args, { stdio: 'inherit' });
  console.log('[sign] OK:', exe);
} catch (err) {
  console.error('[sign] Falha na assinatura:', err.message);
  process.exit(1);
}