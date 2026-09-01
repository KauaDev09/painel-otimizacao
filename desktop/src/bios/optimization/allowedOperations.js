'use strict';

// Whitelist de operações aceitas pelo serviço local.
// A UI só envia IDs — nunca comandos livres, NVRAM genérica ou flash.

const ALLOWED = new Set([
  'enable_xmp',
  'enable_expo',
  'enable_docp',
  'enable_resizable_bar',
  'enable_above_4g',
  'disable_csm',
  'enable_secure_boot',
  'enable_cpb',
  'enable_virtualization',
  'enable_high_performance_plan',
  'schedule_verify',
  'rollback'
]);

const DENIED = new Set([
  'arbitrary_command',
  'arbitrary_nvram_write',
  'bios_flash',
  'flash_bios',
  'write_efi_variable'
]);

function assertAllowed(operation) {
  const id = String(operation || '').trim();
  if (DENIED.has(id) || /nvram|flash|efi|shell|cmd|powershell/i.test(id) && !ALLOWED.has(id)) {
    const err = new Error('Operação bloqueada por segurança.');
    err.code = 'OPERATION_DENIED';
    throw err;
  }
  if (!ALLOWED.has(id)) {
    const err = new Error(`Operação não autorizada: ${id}`);
    err.code = 'OPERATION_DENIED';
    throw err;
  }
  return id;
}

module.exports = { ALLOWED, DENIED, assertAllowed };
