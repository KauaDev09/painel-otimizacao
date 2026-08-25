'use strict';

// BIOS Optimization Score
// Representa SOMENTE o quanto da configuração recomendada foi identificada/
// configurada — não é benchmark e não mede desempenho.
// Itens que o Windows não consegue verificar pontuam 0 no item e recebem nota
// explicativa ("não foi possível verificar"), nunca um número inventado.

const CATEGORY_WEIGHTS = { RAM: 30, CPU: 20, GPU: 20, UEFI: 15, BIOS: 15 };

function pct(score, weight) {
  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

function computeScores(profile) {
  const categories = {};

  // ---------- RAM ----------
  const ramItems = [];
  if (profile.ram.detected) {
    // Capacidade identificada e adequada para uso geral
    ramItems.push({
      name: 'Capacidade de memória',
      weight: 25,
      score: profile.ram.totalGB >= 16 ? 25 : (profile.ram.totalGB >= 8 ? 15 : 0),
      note: `${profile.ram.totalGB} GB detectados`
    });
    // Topologia
    let topoScore = 0; let topoNote = 'Não foi possível determinar.';
    if (profile.ram.layout === 'matched_multi') { topoScore = 25; topoNote = `Canal dupro provável com ${profile.ram.count} módulos idênticos em velocidade.`; }
    else if (profile.ram.layout === 'mixed_part_matched_size') { topoScore = 20; topoNote = `${profile.ram.count} módulos de mesma capacidade/velocidade, fabricante/modelo diferente.`; }
    else if (profile.ram.layout === 'mixed') { topoNote = 'Módulos diferentes detectados (capacidade ou velocidade).'; }
    else if (profile.ram.layout === 'single') { topoNote = 'Apenas 1 módulo — sem canal duplo.'; }
    ramItems.push({ name: 'Topologia de canais', weight: 25, score: topoScore, note: topoNote });

    // Perfil de frequência
    let profScore = 0; let profNote = '';
    if (profile.ram.profile === 'active_or_no_profile') { profScore = 50; profNote = `Operando a ${profile.ram.minConfigMHz} MHz, compatível com a velocidade anunciada pelos módulos.`; }
    else if (profile.ram.profile === 'likely_inactive') { profNote = `Operando a ${profile.ram.minConfigMHz} MHz, abaixo da velocidade anunciada (${profile.ram.maxRatedMHz} MHz) — perfil XMP/EXPO provavelmente inativo.`; }
    else { profNote = 'Não foi possível determinar o perfil pelo Windows.'; }
    ramItems.push({ name: 'Perfil de frequência (XMP/EXPO)', weight: 50, score: profScore, note: profNote });
  } else {
    ramItems.push({ name: 'Detecção de memória', weight: 100, score: 0, note: 'Não foi possível determinar os módulos instalados.' });
  }

  // ---------- CPU ----------
  const cpuItems = [];
  cpuItems.push({
    name: 'Virtualização de hardware',
    weight: 40,
    score: ['enabled_hypervisor_running', 'enabled_firmware'].includes(profile.virtStatus) ? 40 : 0,
    note: profile.virtStatusLabel + (['off_or_hidden_by_hypervisor', 'unknown'].includes(profile.virtStatus)
      ? ' (relacionada à virtualização — não afeta jogos diretamente)' : '')
  });
  cpuItems.push({
    name: 'Identificação completa do processador',
    weight: 30,
    score: profile.cpu.cores && profile.cpu.threads ? 30 : 0,
    note: profile.cpu.cores ? `${profile.cpu.cores} núcleos / ${profile.cpu.threads} threads` : 'Não foi possível determinar núcleos/threads.'
  });
  cpuItems.push({
    name: 'Frequências identificadas',
    weight: 30,
    score: profile.cpu.baseClockMhz ? 30 : 0,
    note: profile.cpu.baseClockMhz ? `Base: ${profile.cpu.baseClockMhz} MHz · Atual: ${profile.cpu.currentClockMhz ?? '—'} MHz` : 'Não foi possível determinar.'
  });

  // ---------- GPU ----------
  const gpu = profile.gpu[0];
  const gpuItems = [];
  gpuItems.push({
    name: 'Driver identificado',
    weight: 40,
    score: gpu && gpu.driver ? 40 : 0,
    note: gpu && gpu.driver ? `Versão ${gpu.driver}` : 'Não foi possível determinar o driver.'
  });
  let rebarScore = 0; let rebarNote = '';
  if (!gpu) rebarNote = 'Nenhuma GPU identificada.';
  else if (gpu.gen === 'integrated') { rebarScore = 60; rebarNote = 'GPU integrada — Resizable BAR não se aplica como otimização principal.'; }
  else if (gpu.gen === 'older_or_unknown') { rebarScore = 60; rebarNote = 'GPU sem suporte confirmado a ReBAR — nada a configurar.'; }
  else if (profile.boot.mode === 'UEFI') { rebarScore = 30; rebarNote = 'Pré-requisitos básicos atendidos (GPU moderna + UEFI). Estado do ReBAR na BIOS não pode ser lido pelo Windows — verifique na BIOS para garantir os pontos restantes.'; }
  else rebarNote = `Modo de inicialização ${profile.boot.mode} impede o uso de Resizable BAR.`;
  gpuItems.push({ name: 'Pré-requisitos de Resizable BAR', weight: 60, score: rebarScore, note: rebarNote });

  // ---------- UEFI ----------
  const uefiItems = [];
  uefiItems.push({
    name: 'Inicialização UEFI',
    weight: 70,
    score: profile.boot.mode === 'UEFI' ? 70 : 0,
    note: profile.boot.mode === 'UEFI' ? 'Sistema inicia via UEFI.' :
      profile.boot.mode === 'Legacy' ? '⚠ Sistema em Legacy/CSM — veja o alerta crítico nas recomendações.' : 'Não foi possível determinar.'
  });
  uefiItems.push({
    name: 'Secure Boot',
    weight: 15,
    score: profile.secureBoot === 'enabled' ? 15 : (profile.secureBoot === 'disabled' ? 7 : 0),
    note: profile.secureBoot === 'enabled' ? 'Ativado.' :
      profile.secureBoot === 'disabled' ? 'Desativado (segurança/compatibilidade — decisão sua).' :
      'Não foi possível verificar sem privilégios elevados.'
  });
  uefiItems.push({
    name: 'TPM',
    weight: 15,
    score: profile.tpm.state === 'present_enabled' ? 15 : (profile.tpm.state === 'present_unknown' ? 7 : 0),
    note: profile.tpm.stateLabel + (profile.tpm.state !== 'present_enabled' && profile.tpm.state !== 'present_unknown'
      ? '' : profile.tpm.specVersion ? ` (especificação ${profile.tpm.specVersion})` : '')
  });

  // ---------- BIOS ----------
  const biosItems = [];
  biosItems.push({
    name: 'Idade da versão da BIOS',
    weight: 60,
    score: profile.bios.ageYears === null ? 0 : (profile.bios.ageYears <= 4 ? 60 : 0),
    note: profile.bios.dateISO
      ? `Data: ${profile.bios.dateISO} (~${profile.bios.ageYears} anos)` + (profile.bios.ageYears > 4 ? ' — considere avaliar atualização junto ao fabricante.' : '')
      : 'Não foi possível determinar a data da BIOS.'
  });
  biosItems.push({
    name: 'Fabricante da BIOS/placa identificado',
    weight: 20,
    score: (profile.motherboard.vendorKey !== 'unknown' || profile.bios.vendor) ? 20 : 0,
    note: profile.motherboard.vendorDisplay || profile.bios.vendor || 'Fabricante não identificado.'
  });
  biosItems.push({
    name: 'Dados SMBIOS completos',
    weight: 20,
    score: (profile.bios.smbiosVersion && profile.motherboard.boardProduct) ? 20 : 10,
    note: `SMBIOS ${profile.bios.smbiosVersion ?? '—'} · Modelo: ${profile.motherboard.boardProduct || '—'}`
  });

  categories.RAM = ramItems;
  categories.CPU = cpuItems;
  categories.GPU = gpuItems;
  categories.UEFI = uefiItems;
  categories.BIOS = biosItems;

  const details = {};
  let totalWeighted = 0; let totalWeights = 0;
  for (const [cat, items] of Object.entries(categories)) {
    const w = items.reduce((a, i) => a + i.weight, 0);
    const s = items.reduce((a, i) => a + i.score, 0);
    const catPct = w > 0 ? Math.round((s / w) * 100) : 0;
    details[cat] = {
      percent: Math.max(0, Math.min(100, catPct)),
      items: items.map(({ name, weight, score, note }) => ({ name, percent: pct(score, weight), note }))
    };
    totalWeighted += catPct * CATEGORY_WEIGHTS[cat];
    totalWeights += CATEGORY_WEIGHTS[cat];
  }
  const overall = Math.round(totalWeighted / totalWeights);

  return { overall: Math.max(0, Math.min(100, overall)), weights: CATEGORY_WEIGHTS, categories: details };
}

module.exports = { computeScores };
