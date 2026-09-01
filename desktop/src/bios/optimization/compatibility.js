'use strict';

const catalog = require('./catalog');

function memoryKind(scan) {
  const ddr = (scan.profile && scan.profile.ram && scan.profile.ram.ddrType) || '';
  const vendor = (scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey) || 'unknown';
  const brand = (scan.profile && scan.profile.cpu && scan.profile.cpu.brand) || null;
  if (/DDR5/i.test(ddr) && brand === 'AMD') return 'expo';
  if (vendor === 'asus' && brand === 'AMD') return 'docp';
  return 'xmp';
}

function xmpStatus(scan) {
  const ram = (scan.profile && scan.profile.ram) || {};
  if (ram.profile === 'likely_inactive') return 'disabled';
  if (ram.profile === 'active_or_no_profile' && ram.minConfigMHz && ram.maxRatedMHz) {
    const close = Math.abs(ram.minConfigMHz - ram.maxRatedMHz) <= ram.maxRatedMHz * 0.05;
    return close ? 'enabled_or_jedec' : 'unknown';
  }
  return 'unknown';
}

function hardwareOk(item, scan) {
  const p = scan.profile || {};
  const extra = scan.extra || {};
  switch (item.id) {
    case 'xmp':
      return memoryKind(scan) === 'xmp' && /DDR/i.test(p.ram && p.ram.ddrType || '') && p.ram && p.ram.detected;
    case 'expo':
      return memoryKind(scan) === 'expo' && p.ram && p.ram.detected;
    case 'docp':
      return memoryKind(scan) === 'docp' && p.ram && p.ram.detected;
    case 'above_4g':
    case 'resizable_bar':
      return Boolean(p.gpuSummary && p.gpuSummary.hasModernRebarCapable && p.boot && p.boot.mode === 'UEFI');
    case 'csm':
      return p.boot && (p.boot.mode === 'Legacy' || p.boot.mode === 'UEFI');
    case 'secure_boot':
      return p.boot && p.boot.mode === 'UEFI';
    case 'cpb':
      return p.cpu && p.cpu.brand === 'AMD' && /ryzen/i.test(p.cpu.name || '');
    case 'virtualization':
      return Boolean(p.cpu && p.cpu.detected);
    case 'high_performance_plan':
      return extra.power ? extra.power.detected !== false : true;
    default:
      return false;
  }
}

function currentState(item, scan) {
  const p = scan.profile || {};
  const extra = scan.extra || {};
  switch (item.id) {
    case 'xmp':
    case 'expo':
    case 'docp':
      return {
        key: xmpStatus(scan),
        label: xmpStatus(scan) === 'disabled' ? 'DESATIVADO' : (xmpStatus(scan) === 'enabled_or_jedec' ? 'ATIVO OU JEDEC' : 'NÃO DETERMINADO'),
        currentMhz: p.ram && p.ram.minConfigMHz,
        ratedMhz: p.ram && p.ram.maxRatedMHz
      };
    case 'resizable_bar':
      return {
        key: extra.rebar && extra.rebar.state || 'unknown',
        label: extra.rebar && extra.rebar.state === 'enabled' ? 'ATIVADO' : (extra.rebar && extra.rebar.state === 'disabled' ? 'DESATIVADO' : 'NÃO DETERMINADO')
      };
    case 'above_4g':
      return {
        key: extra.rebar && extra.rebar.state === 'enabled' ? 'likely_enabled' : 'unknown',
        label: extra.rebar && extra.rebar.state === 'enabled'
          ? 'PROVAVELMENTE ATIVO (ReBAR detectado)'
          : 'NÃO DETERMINADO'
      };
    case 'csm':
      if (p.boot && p.boot.mode === 'Legacy') return { key: 'enabled', label: 'ATIVO (boot Legacy)' };
      if (p.boot && p.boot.mode === 'UEFI') return { key: 'likely_disabled', label: 'PROVAVELMENTE DESATIVADO (boot UEFI)' };
      return { key: 'unknown', label: 'NÃO DETERMINADO' };
    case 'secure_boot':
      if (p.secureBoot === 'enabled') return { key: 'enabled', label: 'ATIVADO' };
      if (p.secureBoot === 'disabled') return { key: 'disabled', label: 'DESATIVADO' };
      return { key: 'unknown', label: 'NÃO DETERMINADO' };
    case 'cpb':
      return { key: 'unknown', label: 'NÃO EXPOSTO PELO WINDOWS' };
    case 'virtualization':
      if (p.virtStatus === 'enabled_hypervisor_running' || p.virtStatus === 'enabled_firmware') {
        return { key: 'enabled', label: p.virtStatusLabel || 'ATIVADA' };
      }
      if (p.virtStatus === 'off_or_hidden_by_hypervisor') return { key: 'disabled', label: 'DESATIVADA OU OCULTA' };
      return { key: 'unknown', label: 'NÃO DETERMINADO' };
    case 'high_performance_plan':
      if (extra.power && extra.power.isHighPerformance) return { key: 'enabled', label: extra.power.name || 'ALTO DESEMPENHO' };
      if (extra.power && extra.power.detected) return { key: 'disabled', label: extra.power.name || 'OUTRO PLANO' };
      return { key: 'unknown', label: 'NÃO DETERMINADO' };
    default:
      return { key: 'unknown', label: 'NÃO DETERMINADO' };
  }
}

function expectedAfterEnable(item, scan) {
  const p = scan.profile || {};
  switch (item.id) {
    case 'xmp':
    case 'expo':
    case 'docp':
      return { key: 'enabled', minConfigMHz: p.ram && p.ram.maxRatedMHz };
    case 'resizable_bar':
      return { key: 'enabled' };
    case 'above_4g':
      return { key: 'likely_enabled' };
    case 'csm':
      return { key: 'likely_disabled', bootMode: 'UEFI' };
    case 'secure_boot':
      return { key: 'enabled' };
    case 'cpb':
      return { key: 'unknown' };
    case 'virtualization':
      return { key: 'enabled' };
    case 'high_performance_plan':
      return { key: 'enabled' };
    default:
      return { key: 'enabled' };
  }
}

function evaluateItem(item, scan, provider) {
  const hw = hardwareOk(item, scan);
  const state = currentState(item, scan);
  const cap = provider ? provider.canApply(item, scan) : { ok: false, mode: 'manual', reason: 'Provider ausente.' };
  const firmwareOk = Boolean(scan.profile && scan.profile.bios && scan.profile.bios.detected !== false);
  const detectOk = state.key !== undefined;
  const verifyOk = item.id !== 'cpb'; // CPB não é verificável pelo Windows
  const applyOk = !!(cap && cap.ok);
  const auto = hw && firmwareOk && detectOk && applyOk && verifyOk && cap.mode === 'auto';

  let uiStatus = 'unavailable';
  let button = 'INDISPONÍVEL';

  if (!hw) {
    uiStatus = 'unavailable';
    button = 'INDISPONÍVEL';
  } else if (state.key === 'enabled' || state.key === 'enabled_or_jedec' || state.key === 'likely_enabled' || state.key === 'likely_disabled' && item.id === 'csm') {
    if (item.id === 'csm' && state.key === 'enabled') {
      uiStatus = auto ? 'available' : 'manual';
      button = auto ? 'ATIVAR' : 'CONFIGURAÇÃO MANUAL';
    } else if (item.id === 'high_performance_plan' && state.key === 'enabled') {
      uiStatus = 'active';
      button = 'ATIVO';
    } else if ((item.id === 'xmp' || item.id === 'expo' || item.id === 'docp') && state.key === 'disabled') {
      uiStatus = auto ? 'available' : 'manual';
      button = auto ? 'ATIVAR' : 'CONFIGURAÇÃO MANUAL';
    } else if (state.key === 'enabled' || state.key === 'enabled_or_jedec' || state.key === 'likely_enabled') {
      uiStatus = state.key === 'enabled' || state.key === 'likely_enabled' ? 'active' : 'informational';
      button = state.key === 'enabled' || state.key === 'likely_enabled' ? 'ATIVO' : 'VERIFICAR';
    } else {
      uiStatus = auto ? 'available' : 'manual';
      button = auto ? 'ATIVAR' : 'CONFIGURAÇÃO MANUAL';
    }
  } else if (state.key === 'disabled') {
    uiStatus = auto ? 'available' : 'manual';
    button = auto ? 'ATIVAR' : 'CONFIGURAÇÃO MANUAL';
  } else {
    uiStatus = auto ? 'available' : 'manual';
    button = auto ? 'ATIVAR' : 'CONFIGURAÇÃO MANUAL';
  }

  if (item.id === 'csm' && state.key === 'likely_disabled') {
    uiStatus = 'informational';
    button = 'VERIFICAR';
  }
  if (item.id === 'cpb') {
    uiStatus = 'manual';
    button = 'CONFIGURAÇÃO MANUAL';
  }

  return {
    hardwareOk: hw,
    firmwareOk,
    detectOk,
    applyOk,
    verifyOk,
    auto,
    state,
    expected: expectedAfterEnable(item, scan),
    capability: cap,
    uiStatus,
    button,
    compatibilityNote: hw
      ? (auto
        ? `Método automático disponível via ${provider && provider.id}.`
        : 'Não é possível alterar automaticamente nesta placa.')
      : 'Hardware incompatível ou pré-requisitos não atendidos.'
  };
}

function relevantItems(scan) {
  return catalog.ITEMS.filter((item) => {
    if (item.id === 'xmp' || item.id === 'expo' || item.id === 'docp') {
      return hardwareOk(item, scan) || (scan.profile && scan.profile.ram && scan.profile.ram.detected && memoryKind(scan) === item.id);
    }
    return true;
  });
}

module.exports = {
  memoryKind,
  xmpStatus,
  hardwareOk,
  currentState,
  expectedAfterEnable,
  evaluateItem,
  relevantItems
};
