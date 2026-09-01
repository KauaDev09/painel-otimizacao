'use strict';

// Ponte para o handler serverless do backend quando o Root Directory do
// Vercel é a raiz do repositório (evita deploy vazio / 404 em /admin e /api).
module.exports = require('../backend/api/[...path].js');
