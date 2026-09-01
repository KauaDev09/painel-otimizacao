'use strict';

const { currentState } = require('./compatibility');
const catalog = require('./catalog');

function matchesExpected(item, scan, expected) {
  const now = currentState(item, scan);
  if (!expected) return { ok: false, reason: 'Estado esperado ausente.' };

  if (item.id === 'xmp' || item.id === 'expo' || item.id === 'docp') {
    const currentMhz = now.currentMhz;
    const target = expected.minConfigMHz;
    const ram = scan.profile && scan.profile.ram;
    const prev = expected.previousMhz;
    if (Number.isFinite(currentMhz) && Number.isFinite(target) && currentMhz >= target * 0.95) {
      return { ok: true, now, detail: `Frequência atual ${currentMhz} MT/s (≥ ${target} MT/s).` };
    }
    if (Number.isFinite(currentMhz) && Number.isFinite(prev) && currentMhz > prev * 1.05) {
      return { ok: true, now, detail: `Frequência subiu de ${prev} para ${currentMhz} MT/s.` };
    }
    if (now.key === 'enabled_or_jedec' && ram && ram.maxRatedMHz && currentMhz && Math.abs(currentMhz - ram.maxRatedMHz) <= ram.maxRatedMHz * 0.05) {
      return { ok: true, now, detail: 'Frequência alinhada à velocidade anunciada dos módulos.' };
    }
    return { ok: false, now, detail: `Frequência atual ${currentMhz || '—'} MT/s; esperado ≈ ${target || 'perfil'} MT/s.` };
  }

  if (item.id === 'resizable_bar') {
    const ok = now.key === 'enabled';
    return { ok, now, detail: ok ? 'Resizable BAR confirmado pelo driver.' : 'Resizable BAR não confirmado após o reboot.' };
  }

  if (item.id === 'above_4g') {
    const ok = now.key === 'likely_enabled' || (scan.extra && scan.extra.rebar && scan.extra.rebar.state === 'enabled');
    return { ok, now, detail: ok ? 'Above 4G provavelmente ativo (ReBAR visível).' : 'Não foi possível confirmar Above 4G Decoding.' };
  }

  if (item.id === 'csm') {
    const boot = scan.profile && scan.profile.boot && scan.profile.boot.mode;
    const ok = boot === 'UEFI';
    return { ok, now, detail: ok ? 'Boot UEFI confirmado.' : `Boot atual: ${boot || 'desconhecido'}.` };
  }

  if (item.id === 'secure_boot') {
    const ok = now.key === 'enabled';
    return { ok, now, detail: ok ? 'Secure Boot ativado.' : `Secure Boot: ${now.label}.` };
  }

  if (item.id === 'virtualization') {
    const ok = now.key === 'enabled';
    return { ok, now, detail: ok ? 'Virtualização ativa.' : `Virtualização: ${now.label}.` };
  }

  if (item.id === 'high_performance_plan') {
    const ok = now.key === 'enabled';
    return { ok, now, detail: ok ? `Plano ativo: ${now.label}.` : `Plano atual: ${now.label}.` };
  }

  return { ok: false, now, detail: 'Não há método confiável de verificação para este item.' };
}

function verifyOperation(op, scan) {
  const item = catalog.itemById(op.setting) || catalog.itemByOperation(op.operation);
  if (!item) return { ok: false, detail: 'Otimização desconhecida.', now: null };
  const expected = Object.assign({}, op.expectedState || {}, {
    previousMhz: op.previousState && (op.previousState.currentMhz || op.previousState.minConfigMHz)
  });
  return matchesExpected(item, scan, expected);
}

module.exports = { matchesExpected, verifyOperation };
