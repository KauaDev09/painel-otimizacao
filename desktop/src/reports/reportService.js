'use strict';

// ReportService — gera relatório HTML + TXT com hardware, BIOS, pontuação,
// recomendações, alertas e lista de configurações que não devem ser alteradas.

const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}

function levelLabel(level) {
  const map = {
    critical: ['🔴 CRÍTICA', '#ff5c5f'],
    recommended: ['🟢 RECOMENDADA', '#4ade80'],
    optional: ['🟡 OPCIONAL', '#fbbf24'],
    informational: ['⚪ INFORMATIVA', '#9a9aa3'],
    advanced: ['⚙️ AVANÇADA — NÃO RECOMENDADA PARA USUÁRIOS COMUNS', '#ff8a5c']
  };
  return map[level] || [level.toUpperCase(), '#9a9aa3'];
}

function riskLabel(risk) {
  return { low: 'BAIXO', medium: 'MÉDIO', high: 'ALTO', info: 'INFORMATIVO' }[risk] || String(risk).toUpperCase();
}

function impactLabel(impact) {
  return { low: 'BAIXO', medium: 'MÉDIO', high: 'ALTO' }[impact] || String(impact).toUpperCase();
}

function buildTxt(result) {
  const p = result.profile;
  const L = [];
  L.push('==============================================================');
  L.push('  ORION OPTIMIZER — RELATÓRIO DE ANÁLISE DE BIOS');
  L.push('  Diagnóstico inteligente e recomendações personalizadas.');
  L.push('==============================================================');
  L.push(`Data da análise : ${fmtDate(p.meta.analyzedAt)}`);
  L.push(`Computador      : ${p.meta.hostname || '—'}`);
  L.push('');
  L.push('--- SISTEMA --------------------------------------------------');
  L.push(`Windows         : ${p.os.caption || '—'} ${p.os.displayVersion ? `(versão ${p.os.displayVersion})` : ''}`);
  L.push(`Build           : ${p.os.build || '—'} · Arquitetura: ${p.os.arch || '—'}`);
  L.push(`Tipo            : ${p.os.pcType}`);
  L.push('');
  L.push('--- PROCESSADOR ----------------------------------------------');
  L.push(`Modelo          : ${p.cpu.name || '—'}`);
  L.push(`Núcleos/Threads : ${p.cpu.cores ?? '—'} / ${p.cpu.threads ?? '—'}`);
  L.push(`Clock base/atual: ${p.cpu.baseClockMhz ?? '—'} MHz / ${p.cpu.currentClockMhz ?? '—'} MHz`);
  L.push(`Socket          : ${p.cpu.socket || '—'}`);
  L.push('');
  L.push('--- PLACA-MÃE / BIOS ------------------------------------------');
  L.push(`Fabricante      : ${p.motherboard.vendorDisplay || 'Fabricante não identificado'}`);
  L.push(`Modelo          : ${p.motherboard.boardProduct || '—'}`);
  L.push(`Chipset (prov.) : ${p.motherboard.chipset || 'Não foi possível determinar'}`);
  L.push(`BIOS            : ${p.bios.vendor || '—'} · Versão ${p.bios.version || '—'} · Data ${p.bios.dateISO || '—'}`);
  L.push(`SMBIOS          : ${p.bios.smbiosVersion || '—'}`);
  L.push('');
  L.push('--- MEMÓRIA RAM -----------------------------------------------');
  L.push(`Total           : ${p.ram.totalGB ?? '—'} GB em ${p.ram.count} módulo(s)${p.ram.slotsTotal ? ` de ${p.ram.slotsTotal} slot(s)` : ''}`);
  for (const m of p.ram.modules) {
    L.push(`  • ${m.slot || '?'}: ${m.sizeGB ?? '?'} GB ${m.type ?? '?'}, ${m.configMHz ?? '?'} MHz (anunciado ${m.ratedMHz ?? '?'} MHz) — ${m.manufacturer ?? 'fabricante n/d'} ${m.partNumber ?? ''}`.trim());
  }
  L.push(`Topologia       : ${p.ram.layout === 'matched_multi' ? 'Canal dupro provável' : p.ram.layout === 'single' ? 'Módulo único' : 'Ver detalhes no relatório HTML'}`);
  L.push('');
  L.push('--- GPU -------------------------------------------------------');
  for (const g of p.gpu) {
    L.push(`  • ${g.name || '—'} | VRAM: ${g.vramMB ? `${g.vramMB} MB` : '—'} | Driver: ${g.driver || '—'} | PCIe: ${g.pcieGenMax || 'n/d'} ${g.linkWidthMax || ''}`.trim());
  }
  L.push('');
  L.push('--- ESTADO DO FIRMWARE ----------------------------------------');
  L.push(`Modo boot       : ${p.boot.mode === 'unknown' ? 'Não foi possível determinar' : p.boot.mode}`);
  L.push(`Disco sistema   : ${p.disk.partitionStyle === 'unknown' ? 'Não foi possível determinar' : p.disk.partitionStyle}`);
  L.push(`Secure Boot     : ${p.secureBoot === 'enabled' ? 'Ativado' : p.secureBoot === 'disabled' ? 'Desativado' : 'Não foi possível determinar'}`);
  L.push(`TPM             : ${p.tpm.stateLabel}${p.tpm.specVersion ? ` (spec ${p.tpm.specVersion})` : ''}`);
  L.push(`Virtualização   : ${p.virtStatusLabel}`);
  L.push('');
  L.push('--- PONTUAÇÃO (BIOS OPTIMIZATION SCORE) -----------------------');
  L.push(`TOTAL           : ${result.scores.overall}/100`);
  for (const [cat, d] of Object.entries(result.scores.categories)) {
    L.push(`  ${cat.padEnd(4)}: ${d.percent}%`);
    for (const it of d.items) L.push(`       - ${it.name}: ${it.percent}% (${it.note})`);
  }
  L.push('');
  L.push('--- ALERTAS ----------------------------------------------------');
  if (!result.alerts.length) L.push('Nenhum alerta crítico.');
  for (const a of result.alerts) L.push(`🔴 ${a.title}: ${a.message}`);

  const section = (title, list) => {
    L.push('');
    L.push(`--- ${title} -------------------------------------------------`);
    if (!list.length) L.push('(nenhuma)');
    for (const r of list) {
      const [lbl] = levelLabel(r.level);
      L.push('');
      L.push(`${lbl} · ${r.name}`);
      L.push(`Status      : ${r.statusText.replace(/^Status: /, '')}`);
      L.push(`Recomendação: ${r.recommendation}`);
      L.push(`Impacto/Risco: ${impactLabel(r.impact)} / ${riskLabel(r.risk)}${r.rebootRequired ? ' · Reinicialização necessária' : ''}`);
      L.push(`Motivo      : ${r.reason}`);
      L.push(`Benefício   : ${r.benefit}`);
      L.push(`Caminho(s) provável(is):`);
      for (const path_ of r.paths) L.push(`   → ${path_}`);
      if (r.steps.length) { L.push('Como encontrar:'); r.steps.forEach((s, i) => L.push(`   ${i + 1}. ${s}`)); }
      for (const n of r.notes) L.push(`Obs.: ${n}`);
    }
  };

  section('RECOMENDAÇÕES CRÍTICAS', result.groups.critical);
  section('RECOMENDAÇÕES', result.groups.recommended);
  section('OPCIONAIS', result.groups.optional);
  section('INFORMATIVAS', result.groups.informational);
  section('AVANÇADAS — NÃO RECOMENDADAS PARA USUÁRIOS COMUNS', result.groups.advanced);

  L.push('');
  L.push('--- CONFIGURAÇÕES QUE NÃO DEVEM SER ALTERADAS SEM ESPECIALISTA -');
  for (const d of result.doNotTouch) L.push(`• ${d.name}`);
  L.push('');
  L.push('AVISO LEGAL:');
  L.push('Este aplicativo é um ANALISADOR E CONSULTOR. Ele NÃO escreve na BIOS,');
  L.push('NÃO altera firmware/voltagens/registro e NÃO executa comandos perigosos.');
  L.push('Todas as alterações devem ser feitas manualmente pelo técnico, por conta');
  L.push('e risco do responsável, com backup prévio.');
  L.push('');
  L.push(`Gerado por Orion Optimizer v${p.meta.appVersion} em ${fmtDate(new Date().toISOString())}`);
  return L.join('\r\n');
}

function buildHtml(result) {
  const p = result.profile;
  const catRows = Object.entries(result.scores.categories).map(([cat, d]) => `
    <tr><td class="cat">${esc(cat)}</td><td>${d.percent}%</td></tr>`).join('');

  const recCard = (r) => {
    const [lbl, color] = levelLabel(r.level);
    return `<div class="card" style="border-left-color:${color}">
      <div class="lvl" style="color:${color}">${lbl}</div>
      <h3>${esc(r.name)}</h3>
      <p><b>Status:</b> ${esc(r.statusText.replace(/^Status: /, ''))}</p>
      <p><b>Recomendação:</b> ${esc(r.recommendation)}</p>
      <p><b>Impacto:</b> ${esc(impactLabel(r.impact))} &nbsp; <b>Risco:</b> ${esc(riskLabel(r.risk))}${r.rebootRequired ? ' &nbsp; <b>Reinicialização:</b> necessária' : ''}</p>
      <p><b>Motivo:</b> ${esc(r.reason)}</p>
      <p><b>Benefício:</b> ${esc(r.benefit)}</p>
      <p><b>Caminho(s) provável(is):</b><br>${r.paths.map((x) => `→ ${esc(x)}`).join('<br>')}</p>
      ${r.steps.length ? `<ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${r.compatibility ? `<p><b>Compatibilidade:</b> ${esc(r.compatibility)}</p>` : ''}
      ${r.notes.map((n) => `<p class="note">Obs.: ${esc(n)}</p>`).join('')}
    </div>`;
  };

  const sec = (title, list) => list.length
    ? `<h2>${esc(title)}</h2>${list.map(recCard).join('')}`
    : `<h2>${esc(title)}</h2><p class="dim">(nenhuma)</p>`;

  const ramLines = p.ram.modules.map((m) =>
    `<li>${esc(`${m.slot || '?'}: ${m.sizeGB ?? '?'} GB ${m.type ?? '?'} @ ${m.configMHz ?? '?'} MHz (anunciado ${m.ratedMHz ?? '?'} MHz) — ${m.manufacturer ?? 'fabricante n/d'} ${m.partNumber ?? ''}`)}</li>`
  ).join('');
  const gpuLines = p.gpu.map((g) =>
    `<li>${esc(g.name || '—')} — VRAM: ${g.vramMB ? `${g.vramMB} MB` : '—'} · Driver: ${esc(g.driver || '—')} · PCIe: ${esc(g.pcieGenMax || 'n/d')} ${esc(g.linkWidthMax || '')}</li>`
  ).join('');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Orion Optimizer — Relatório</title><style>
 body{background:#0b0b0d;color:#ececf0;font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px}
 h1{color:#e5484d;letter-spacing:2px;margin-bottom:4px}
 h2{border-bottom:2px solid #26272e;padding-bottom:6px;margin-top:36px}
 .sub{color:#9a9aa3}.card{background:#15161a;border:1px solid #26272e;border-left:4px solid #555;border-radius:10px;padding:16px 20px;margin:14px 0}
 .lvl{font-weight:700;font-size:12px;letter-spacing:1px}
 table{border-collapse:collapse;width:100%;max-width:520px}td{padding:6px 10px;border-bottom:1px solid #26272e}
 td.cat{width:120px;font-weight:700}.dim{color:#9a9aa3}.note{color:#fbbf24;font-size:13px}
 code,.path{font-family:Consolas,monospace;color:#ffb3b5}
 ol li{margin:4px 0}
 .scorebox{display:inline-block;background:#15161a;border:1px solid #26272e;border-radius:12px;padding:18px 28px;font-size:42px;font-weight:800;color:#fff}
 .scorebox small{font-size:14px;color:#9a9aa3;font-weight:400}
</style></head><body>
<h1>ORION OPTIMIZER</h1>
<p class="sub">Diagnóstico inteligente e recomendações personalizadas para sua BIOS.</p>
<p>Data da análise: <b>${fmtDate(p.meta.analyzedAt)}</b> · Computador: <b>${esc(p.meta.hostname)}</b></p>
<p class="note">${esc(p.meta.disclaimer)}</p>

<h2>PONTUAÇÃO — BIOS OPTIMIZATION SCORE</h2>
<div class="scorebox">${result.scores.overall}<small>/100</small></div>
<table>${catRows}</table>
<p class="dim">A pontuação representa somente o quanto da configuração recomendada foi identificada/configurada — não é benchmark.</p>

<h2>SISTEMA</h2><ul>
<li>Windows: ${esc(p.os.caption)} ${esc(p.os.displayVersion ? `(versão ${p.os.displayVersion})` : '')} — Build ${esc(p.os.build)} (${esc(p.os.arch)})</li>
<li>Tipo: ${esc(p.os.pcType)}</li></ul>

<h2>PROCESSADOR</h2><ul>
<li>${esc(p.cpu.name)}</li><li>Núcleos/Threads: ${esc(p.cpu.cores)}/${esc(p.cpu.threads)}</li>
<li>Clock base: ${esc(p.cpu.baseClockMhz)} MHz · Atual: ${esc(p.cpu.currentClockMhz)} MHz${p.cpu.boostClockMhz ? ` · Boost conhecido: ${p.cpu.boostClockMhz} MHz` : ''}</li>
<li>Socket: ${esc(p.cpu.socket)}</li></ul>

<h2>PLACA-MÃE / BIOS</h2><ul>
<li>Fabricante: ${esc(p.motherboard.vendorDisplay || 'Fabricante não identificado')} · Modelo: ${esc(p.motherboard.boardProduct)}</li>
<li>Chipset (provável): ${esc(p.motherboard.chipset || 'Não foi possível determinar')}</li>
<li>BIOS: ${esc(p.bios.vendor)} · Versão ${esc(p.bios.version)} · Data ${esc(p.bios.dateISO)} · SMBIOS ${esc(p.bios.smbiosVersion)}</li></ul>

<h2>MEMÓRIA RAM</h2><ul>
<li>Total: ${esc(p.ram.totalGB)} GB em ${p.ram.count} módulo(s)${p.ram.slotsTotal ? ` (de ${p.ram.slotsTotal} slots)` : ''}</li>
${ramLines}
<li>Perfil: ${p.ram.profile === 'likely_inactive' ? `operando a ${p.ram.minConfigMHz} MHz — perfil XMP/EXPO provavelmente inativo (anunciado ${p.ram.maxRatedMHz} MHz)` : p.ram.profile === 'active_or_no_profile' ? `operando a ${p.ram.minConfigMHz} MHz` : 'não foi possível determinar'}</li></ul>

<h2>GPU</h2><ul>${gpuLines}</ul>

<h2>ESTADO DO FIRMWARE</h2><ul>
<li>Modo de inicialização: ${esc(p.boot.mode === 'unknown' ? 'Não foi possível determinar' : p.boot.mode)}</li>
<li>Disco do sistema: ${esc(p.disk.partitionStyle === 'unknown' ? 'Não foi possível determinar' : p.disk.partitionStyle)}</li>
<li>Secure Boot: ${esc(p.secureBoot === 'enabled' ? 'Ativado' : p.secureBoot === 'disabled' ? 'Desativado' : 'Não foi possível determinar')}</li>
<li>TPM: ${esc(p.tpm.stateLabel)}${p.tpm.specVersion ? ` (spec ${esc(p.tpm.specVersion)})` : ''}</li>
<li>Virtualização: ${esc(p.virtStatusLabel)}</li></ul>

<h2>ALERTAS</h2>
${result.alerts.length ? result.alerts.map((a) => `<div class="card" style="border-left-color:#ff5c5f"><b>🔴 ${esc(a.title)}</b><br>${esc(a.message)}</div>`).join('') : '<p>Nenhum alerta crítico.</p>'}

${sec('RECOMENDAÇÕES CRÍTICAS', result.groups.critical)}
${sec('RECOMENDAÇÕES', result.groups.recommended)}
${sec('OPCIONAIS', result.groups.optional)}
${sec('INFORMATIVAS', result.groups.informational)}
${sec('AVANÇADAS — NÃO RECOMENDADAS PARA USUÁRIOS COMUNS', result.groups.advanced)}

<h2>CONFIGURAÇÕES QUE NÃO DEVEM SER ALTERADAS SEM ESPECIALISTA</h2>
<ul>${result.doNotTouch.map((d) => `<li><b>${esc(d.name)}</b></li>`).join('')}</ul>

<p class="note">Este aplicativo é um analisador e consultor. Ele NÃO escreve na BIOS, NÃO altera firmware,
voltagens ou registro e NÃO executa comandos perigosos. Alterações devem ser manuais, com backup prévio.</p>
<p class="dim">Gerado por Orion Optimizer v${esc(p.meta.appVersion)} — ${fmtDate(new Date().toISOString())}</p>
</body></html>`;
}

class ReportService {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  ensureDir() {
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  generate(result) {
    this.ensureDir();
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const base = `relatorio-bios-${stamp}`;
    const htmlPath = path.join(this.outputDir, `${base}.html`);
    const txtPath = path.join(this.outputDir, `${base}.txt`);

    fs.writeFileSync(htmlPath, buildHtml(result), 'utf8');
    fs.writeFileSync(txtPath, buildTxt(result), 'utf8');

    return { htmlPath, txtPath, dir: this.outputDir };
  }
}

module.exports = { ReportService };
