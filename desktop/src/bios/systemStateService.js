'use strict';

const { asArray } = require('../utils/asArray');

// Deteccao de modo de inicializacao, Secure Boot, TPM e virtualizacao.
// Todas as fontes sao somente-leitura. Quando o Windows nao expoe a informacao
// sem privilegios elevados, o resultado e honestamente "unknown".

function detectBootMode(raw) {
  const boot = raw && raw.boot ? raw.boot : {};
  // 1) Variavel de ambiente firmware_type (Win10+): "UEFI" | "Legacy"
  const fwEnv = typeof boot.fwEnv === 'string' ? boot.fwEnv.trim() : '';
  if (/uefi/i.test(fwEnv)) return 'UEFI';
  if (/legacy|bios/i.test(fwEnv)) return 'Legacy';
  // 2) Registro HKLM\SYSTEM\CurrentControlSet\Control\PEFirmwareType (1=BIOS, 2=UEFI)
  const pe = Number(boot.peReg);
  if (pe === 2) return 'UEFI';
  if (pe === 1) return 'Legacy';
  return 'unknown';
}

function detectSecureBoot(raw) {
  const sb = raw && raw.secureboot ? raw.secureboot : {};
  const regVal = sb.reg;
  if (regVal === 1) return 'enabled';
  if (regVal === 0) return 'disabled';
  return 'unknown'; // chave ausente normalmente significa Legacy ou acesso negado
}

function detectTpm(raw) {
  const wmi = asArray(raw && raw.tpm)[0];
  const pnpArr = asArray(raw && raw.tpmPnp);
  if (wmi) {
    const enabled = wmi.IsEnabled_InitialValue;
    const spec = wmi.SpecVersion ? String(wmi.SpecVersion).split(',')[0] : null;
    if (enabled === true || enabled === 1) {
      return { state: 'present_enabled', specVersion: spec };
    }
    if (enabled === false || enabled === 0) {
      return { state: 'present_disabled', specVersion: spec };
    }
  }
  if (pnpArr.length) {
    return { state: 'present_unknown', specVersion: null };
  }
  return { state: 'unknown', specVersion: null };
}

function detectVirtualization(cpu, hypervisorPresent) {
  if (hypervisorPresent === true) return 'enabled_hypervisor_running';
  if (cpu && cpu.virtualizationFirmwareEnabled === true) return 'enabled_firmware';
  if (cpu && cpu.virtualizationFirmwareEnabled === false) return 'off_or_hidden_by_hypervisor';
  return 'unknown';
}

module.exports = { detectBootMode, detectSecureBoot, detectTpm, detectVirtualization };
