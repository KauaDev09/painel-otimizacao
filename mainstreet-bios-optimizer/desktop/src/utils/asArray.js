'use strict';

// Normaliza saída de consultas WMI/CIM: dependendo da versão do PowerShell e da
// serialização JSON, um único item pode chegar como objeto em vez de array.
function asArray(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return [v];
}

module.exports = { asArray };
