'use strict';

// Renderer — toda a lógica da interface. Não acessa Node diretamente;
// comunica-se apenas via window.OrionAPI (contextIsolation).

const api = () => window.OrionAPI;

const state = {
  result: null,
  techMode: false,
  filter: 'all',
  historySelection: [],
  licensed: false,
  licenseInfo: null,
  security: null,
  gameBoost: null,
  optItems: [],
  optProfiles: [],
  optSelected: new Set(),
  optFilter: 'all',
  cleanTargets: [],
  cleanSizes: {},
  cleanSelected: new Set(),
  optSearch: '',
  optRiskFilter: 'all',
  optPlanFilter: 'all',
  optUnappliedOnly: false,
  optSort: 'name',
  optActiveProfile: null,
  optApplied: new Set(),
  optExpanded: new Set(),
  optCustomIds: [],
  bios: null
};

const CATEGORY_LABEL = {
  windows: 'Windows', cpu: 'CPU', gpu: 'GPU', ram: 'RAM', rede: 'Rede',
  armazenamento: 'Armazenamento', energia: 'Energia', inicializacao: 'Inicialização',
  jogos: 'Jogos', limpeza: 'Limpeza', seguranca: 'Segurança'
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LEVEL_META = {
  critical: { label: 'CRÍTICA', color: 'var(--red-bright)', icon: 'risk' },
  recommended: { label: 'RECOMENDADA', color: 'var(--green)', icon: 'ok' },
  optional: { label: 'OPCIONAL', color: 'var(--yellow)', icon: 'risk' },
  informational: { label: 'INFORMATIVA', color: 'var(--text-dim)', icon: 'scan' },
  advanced: { label: 'AVANÇADA', color: 'var(--orange)', icon: 'system' }
};
const RISK_LABEL = { low: 'RISCO BAIXO', medium: 'RISCO MÉDIO', high: 'RISCO ALTO', info: 'INFORMATIVO' };
const IMPACT_LABEL = { low: 'IMPACTO BAIXO', medium: 'IMPACTO MÉDIO', high: 'IMPACTO ALTO' };

const PAGE_TITLES = {
  home: 'Início',
  progress: 'Analisando...',
  dashboard: 'Sistema',
  recs: 'BIOS',
  optimize: 'Windows',
  gameboost: 'Gaming',
  security: 'Segurança',
  maintenance: 'Limpeza',
  restore: 'Restauração',
  activation: 'Licença',
  history: 'Histórico',
  monitor: 'Monitoramento',
  benchmark: 'Benchmark',
  network: 'Rede',
  startup: 'Inicialização',
  processes: 'Processos',
  settings: 'Configurações',
  support: 'Suporte'
};

const CUSTOM_PROFILE_KEY = 'orion.customProfile';
const APPLIED_KEY = 'orion.appliedIds';
const RISK_SORT = { high: 0, medium: 1, low: 2, info: 3 };

// ---------------- Sidebar Toggle ----------------
function isDesktopNav() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;
  if (isDesktopNav()) {
    sidebar.classList.remove('open', 'collapsed');
    if (backdrop) backdrop.classList.remove('visible');
    return;
  }
  sidebar.classList.toggle('open', open);
  if (backdrop) backdrop.classList.toggle('visible', open);
}

function initSidebarToggle() {
  const toggleBtn = $('#sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => setSidebarOpen(true));
  }
  const closeBtn = $('#sidebarClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => setSidebarOpen(false));
  }
  const backdrop = $('#sidebarBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => setSidebarOpen(false));
  }
  window.addEventListener('resize', () => {
    if (isDesktopNav()) setSidebarOpen(false);
  });
}

const headerProfile = $('#headerProfile');
if (headerProfile) {
  headerProfile.addEventListener('click', () => {
    showView(state.licensed ? 'settings' : 'activation');
  });
}

function toggleSidebar() {
  if (isDesktopNav()) return;
  const sidebar = document.getElementById('sidebar');
  setSidebarOpen(sidebar && !sidebar.classList.contains('open'));
}

// Ctrl+B to toggle sidebar (mobile drawer)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
  }
});

// ---------------- Navegação ----------------
function showView(name) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  const targetEl = $(`#view-${name}`);
  if (targetEl) targetEl.classList.add('active');

  $$('.sidebar-item').forEach((t) => t.classList.toggle('active', t.dataset.view === name));

  const pageTitle = $('#pageTitle');
  if (pageTitle) {
    pageTitle.textContent = PAGE_TITLES[name] || name;
  }

  if (targetEl) targetEl.scrollTop = 0;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const main = document.querySelector('main.content');
  if (main) main.scrollTop = 0;
  setSidebarOpen(false);
}

$$('.sidebar-item').forEach((t) => {
  t.addEventListener('click', () => {
    const target = t.dataset.view;
    if (target === 'dashboard' && !state.result) return;
    if (target === 'recs') {
      renderBiosOptimizations();
      if (state.result) renderRecommendations();
    }
    if (target === 'gameboost' && !state.gameBoost) $('#gbEmpty').classList.remove('hidden');
    if (target === 'gameboost') initGameBoostView();
    if (target === 'security' && !state.security) $('#secEmpty').classList.remove('hidden');
    if (target === 'history') renderHistory();
    if (target === 'optimize') initOptimizeView();
    if (target === 'maintenance') initMaintenanceView();
    if (target === 'restore') renderOperations();
    if (target === 'monitor') startMonitor();
    else stopMonitor();
    if (target === 'benchmark') initBenchmarkView();
    if (target === 'network') initNetworkView();
    if (target === 'startup') refreshStartupList();
    if (target === 'processes') refreshProcessList();
    if (target === 'settings') initSettingsView();
    if (target === 'support') initSupportView();
    showView(target);
  });
});

const sidebarLogo = $('#sidebarLogo') || $('#brand');
if (sidebarLogo) {
  sidebarLogo.addEventListener('click', () => showView('home'));
}

// ---------------- Modo Técnico ----------------
$('#techToggle').addEventListener('change', (e) => {
  state.techMode = e.target.checked;
  document.body.classList.toggle('tech', state.techMode);
  $('#techExportWrap').classList.toggle('hidden', !state.techMode);
  if (state.result) { renderDashboard(); renderRecommendations(); }
  if (state.bios) renderBiosOptimizations();
});

// ---------------- Análise ----------------
$('#analyzeBtn').addEventListener('click', startAnalysis);

async function startAnalysis() {
  $('#analyzeBtn').disabled = true;
  $('#stepList').innerHTML = '';
  showView('progress');
  try {
    const summary = await api().analyze();
    state.result = await api().getLast();
    if (api().biosList) {
      try { state.bios = await api().biosList(); } catch (_) { state.bios = null; }
    }
    renderDashboard();
    renderRecommendations();
    renderBiosOptimizations();
    $('#reportBtn').disabled = false;
    showView('dashboard');
    toast(`✅ Análise concluída — BIOS Optimization Score: <b>${summary.overall}/100</b>`);
  } catch (err) {
    toast(`❌ Falha na análise: ${esc(err.message || err)}<br><br><a data-action="reload">Tentar novamente</a>`);
    showView('home');
  } finally {
    $('#analyzeBtn').disabled = false;
  }
}

api().onStep((step) => {
  const li = document.createElement('li');
  li.textContent = step.label;
  li.id = `step-${step.key}`;
  $$('#stepList li.current').forEach((x) => x.classList.replace('current', 'done'));
  $('#stepList').appendChild(li);
  requestAnimationFrame(() => li.classList.add('current'));
});

// ---------------- Dashboard ----------------
function kv(k, v, tech = false) {
  return `<div class="kv${tech ? ' tech-row' : ''}"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
}
const dash = (s) => (s === null || s === undefined || s === '' ? '<i>não foi possível determinar</i>' : esc(String(s)));

function hwCard(title, sub, body, full = false) {
  return `<div class="hw-card${full ? ' full' : ''}"><h3>${title}<em>${sub}</em></h3>${body}</div>`;
}

function renderDashboard() {
  const p = state.result.profile;

  const cpuBody =
    kv('Modelo', dash(p.cpu.name)) +
    kv('Fabricante', dash(p.cpu.brand)) +
    kv('Núcleos / Threads', p.cpu.cores ? `${p.cpu.cores} / ${p.cpu.threads}` : dash(null)) +
    kv('Clock base', p.cpu.baseClockMhz ? `${p.cpu.baseClockMhz} MHz` : dash(null)) +
    kv('Clock atual', p.cpu.currentClockMhz ? `${p.cpu.currentClockMhz} MHz` : dash(null)) +
    kv('Boost conhecido', p.cpu.boostClockMhz ? `${p.cpu.boostClockMhz} MHz` : dash(null)) +
    kv('Arquitetura', dash(p.cpu.architecture), true) +
    kv('Socket', dash(p.cpu.socket), true) +
    kv('Multiplicador desbloqueado', dash(p.cpu.unlockedLabel), true);

  const boardBody =
    kv('Fabricante', p.motherboard.vendorDisplay || '<i>Fabricante não identificado</i>') +
    kv('Modelo', dash(p.motherboard.boardProduct)) +
    kv('Chipset (provável)', dash(p.motherboard.chipset)) +
    kv('BIOS', dash(p.bios.vendor)) +
    kv('Versão da BIOS', dash(p.bios.version)) +
    kv('Data da BIOS', dash(p.bios.dateISO)) +
    kv('SMBIOS', dash(p.bios.smbiosVersion), true) +
    kv('Fator / Tipo', dash(p.motherboard.formFactor), true) +
    kv('OEM', p.motherboard.isOem ? 'Sim (opções de BIOS podem ser limitadas)' : 'Não', true);

  let ramBody =
    kv('Capacidade total', p.ram.totalGB ? `${p.ram.totalGB} GB` : dash(null)) +
    kv('Módulos', p.ram.count ? `${p.ram.count}${p.ram.slotsTotal ? ` de ${p.ram.slotsTotal} slot(s)` : ''}` : dash(null));
  if (p.ram.modules.length) {
    ramBody += kv('Por módulo', p.ram.modules.map((m) => `${m.sizeGB ?? '?'} GB`).join(', '));
    ramBody += kv('Tipo', dash(p.ram.ddrType));
    ramBody += kv('Frequência atual', p.ram.minConfigMHz ? `${p.ram.minConfigMHz} MHz` : dash(null));
    const profileTxt = p.ram.profile === 'likely_inactive'
      ? `<b style="color:var(--yellow)">provável perfil inativo</b> (módulos anunciados: ${p.ram.maxRatedMHz} MHz)`
      : p.ram.profile === 'active_or_no_profile'
        ? 'operando conforme anunciado'
        : '<i>disponibilidade depende da versão da BIOS</i>';
    ramBody += kv('XMP/EXPO', profileTxt);
  }
  for (const m of p.ram.modules.slice(0, 4)) {
    ramBody += kv(`${m.slot || 'Módulo'}`, `${dash(m.sizeGB && `${m.sizeGB} GB`)} · ${dash(m.type)} · ${m.configMHz ? `${m.configMHz} MHz` : '?'}`, true);
  }
  ramBody += kv('Canal duplo', p.ram.dualChannelLikely === true ? 'Provável (inferido)' : p.ram.dualChannelLikely === false ? 'Não (1 módulo)' : dash(null), true);
  ramBody += kv('Fabricantes dos módulos', dash(p.ram.manufacturers.join(', ')), true);
  ramBody += kv('Part numbers', dash(p.ram.partNumbers.join(', ')), true);

  const g0 = p.gpu[0] || {};
  let gpuBody =
    kv('Modelo', dash(g0.name)) +
    kv('VRAM', g0.vramMB ? `${g0.vramMB} MB` : dash(null)) +
    kv('Driver', dash(g0.driver)) +
    kv('Interface PCIe', g0.pcieGenMax ? `${g0.pcieGenMax} ${g0.linkWidthMax || ''}` : '<i>não exposta pelo Windows</i>');
  gpuBody += kv('Data do driver', dash(g0.driverDate), true);
  gpuBody += kv('Tipo', g0.isIntegrated ? 'Integrada' : 'Dedicada', true);
  if (p.gpu.length > 1) {
    gpuBody += kv('Outras GPUs', p.gpu.slice(1).map((g) => g.name).filter(Boolean).join('; '), true);
  }

  const sysBody =
    kv('Windows', dash(p.os.caption)) +
    kv('Versão', dash(p.os.displayVersion)) +
    kv('Build', dash(p.os.build)) +
    kv('Arquitetura', dash(p.os.arch)) +
    kv('Modo de inicialização', p.boot.mode === 'unknown' ? dash(null) : (p.boot.mode === 'Legacy'
      ? '<b style="color:var(--red-bright)">⚠ Legacy — não está usando UEFI</b>' : 'UEFI')) +
    kv('Disco do sistema', p.disk.partitionStyle === 'unknown' ? dash(null) : p.disk.partitionStyle) +
    kv('Secure Boot', p.secureBoot === 'enabled' ? 'Ativado' : p.secureBoot === 'disabled' ? 'Desativado' : dash(null)) +
    kv('TPM', dash(p.tpm.stateLabel)) +
    kv('Virtualização', dash(p.virtStatusLabel));

  $('#hwCards').innerHTML = `<div class="hw-grid">
      ${hwCard('PROCESSADOR', esc(p.cpu.brand || ''), cpuBody)}
      ${hwCard('PLACA-MÃE & BIOS', '', boardBody)}
      ${hwCard('MEMÓRIA RAM', p.ram.totalGB ? `${p.ram.totalGB} GB` : '', ramBody)}
      ${hwCard('GPU', '', gpuBody)}
      ${hwCard('SISTEMA', esc(p.os.pcType || ''), sysBody)}
    </div>`;

  // ---- Score ----
  const s = state.result.scores;
  $('#scoreValue').textContent = s.overall;
  const color = s.overall >= 80 ? 'var(--green)' : s.overall >= 50 ? 'var(--yellow)' : 'var(--red-bright)';
  const ring = $('#scoreRing');
  ring.style.setProperty('--pct', s.overall);
  ring.style.setProperty('--scoreColor', color);
  $('#scoreCats').innerHTML = Object.entries(s.categories).map(([cat, d]) => {
    const c = d.percent >= 80 ? 'var(--green)' : d.percent >= 50 ? 'var(--yellow)' : 'var(--red-bright)';
    return `<li><span>${cat}</span><span class="bar-wrap"><span class="bar" style="width:${d.percent}%;background:${c}"></span></span><b style="color:${c}">${d.percent}%</b></li>`;
  }).join('');

  // ---- Contagens ----
  const c = state.result.counts;
  $('#recCounts').innerHTML =
    `<div class="count-row"><span>${typeof appIcon === 'function' ? appIcon('ok', { size: 14, className: 'text-success' }) : ''} Recomendadas</span><b style="color:var(--green)">${c.recommended}</b></div>
     <div class="count-row"><span>${typeof appIcon === 'function' ? appIcon('risk', { size: 14, className: 'text-warning' }) : ''} Opcionais</span><b style="color:var(--yellow)">${c.optional}</b></div>
     <div class="count-row"><span>${typeof appIcon === 'function' ? appIcon('risk', { size: 14, className: 'text-destructive' }) : ''} Críticas</span><b style="color:var(--red-bright)">${c.critical}</b></div>` +
    (state.techMode ? `<div class="count-row"><span>⚙️ Avançadas</span><b style="color:var(--orange)">${c.advanced}</b></div>` : '');
}

$('#goRecsBtn').addEventListener('click', () => showView('recs'));

// ---------------- Recomendações ----------------
$$('#recFilters .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    $$('#recFilters .chip').forEach((x) => x.classList.remove('active'));
    chip.classList.add('active');
    state.filter = chip.dataset.f;
    renderRecommendations();
    renderBiosOptimizations();
  });
});

function recCardHtml(r) {
  const meta = LEVEL_META[r.effectiveLevel] || LEVEL_META.informational;
  const paths = r.paths.map(esc).join('\n');
  return `<div class="rec-card" data-id="${esc(r.id)}" style="border-left-color:${meta.color}">
    <div class="rec-head">
      <div>
        <div class="rec-title">${esc(r.name)}</div>
        <div class="rec-status">Status: ${esc(r.statusText.replace(/^Status: /, ''))}</div>
        <div class="rec-status"><b style="color:${meta.color}">${typeof appIcon === 'function' ? appIcon(meta.icon, { size: 14 }) : ''} ${meta.label}</b> Recomendação: <b>${esc(r.recommendation)}</b></div>
      </div>
      <span class="rec-level" style="color:${meta.color}">${meta.label}</span>
    </div>
    <div class="badges">
      <span class="badge risk-${r.risk}">${RISK_LABEL[r.risk]}</span>
      <span class="badge neutral">${IMPACT_LABEL[r.impact]}</span>
      ${r.rebootRequired ? '<span class="badge neutral">REINICIALIZAÇÃO NECESSÁRIA</span>' : ''}
    </div>
    <div class="rec-path">${esc(paths)}</div>
    <button class="btn btn-outline btn-details">VER DETALHES</button>
  </div>`;
}

const GROUP_ORDER = ['critical', 'recommended', 'optional', 'informational'];
const GROUP_TITLES = {
  critical: 'Críticas — atenção imediata',
  recommended: 'Recomendadas',
  optional: 'Opcionais',
  informational: 'Informativas',
  advanced: '⚙️ Avançado — não recomendado para usuários comuns'
};

function renderRecommendations() {
  const r = state.result;
  const listEl = $('#recList');
  if (!r || !listEl) return;
  $('#advancedBanner').classList.toggle('hidden', !state.techMode);

  const groupsToShow = GROUP_ORDER.filter(
    (g) => r.groups[g].length && (state.filter === 'all' || state.filter === g)
  );
  const showAdvanced = state.techMode && r.groups.advanced.length &&
    (state.filter === 'all' || state.filter === 'advanced');

  let html = '';
  for (const g of groupsToShow) {
    html += `<div class="group-title">${GROUP_TITLES[g]} (${r.groups[g].length})</div>`;
    html += r.groups[g].map(recCardHtml).join('');
  }
  if (!groupsToShow.length && !showAdvanced) {
    html += `<p class="empty-note">Nenhuma recomendação nesta categoria.</p>`;
  }
  if (showAdvanced) {
    html += `<div class="group-title" style="color:var(--orange)">${GROUP_TITLES.advanced} (${r.groups.advanced.length})</div>`;
    html += r.groups.advanced.map(recCardHtml).join('');
  }
  listEl.innerHTML = html;

  $$('#recList .btn-details').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.rec-card').dataset.id;
      openDetails(r.recommendations.find((x) => x.id === id));
    });
  });
}

const BIOS_BUTTON_LABEL = {
  available: 'ATIVAR',
  active: 'ATIVO',
  manual: 'CONFIGURAÇÃO MANUAL',
  pending_reboot: 'AGUARDANDO REINICIALIZAÇÃO',
  verifying: 'VERIFICANDO',
  applying: 'APLICANDO',
  success: 'SUCESSO',
  failed: 'FALHOU',
  unavailable: 'INDISPONÍVEL',
  informational: 'VERIFICAR',
  rollback: 'DESFAZER'
};

function biosStatusLabel(item) {
  if (item.status === 'pending_reboot') return 'Aguardando reinicialização';
  if (item.status === 'verifying') return 'Verificando alterações...';
  if (item.status === 'success') return 'ATIVADO';
  if (item.status === 'failed') return 'FALHOU';
  if (item.status === 'active') return 'ATIVADO';
  if (item.status === 'applying') return 'Preparando otimização...';
  return item.state && item.state.label ? item.state.label : 'NÃO DETERMINADO';
}

function biosCardHtml(item) {
  const meta = LEVEL_META[item.level] || LEVEL_META.informational;
  const btn = BIOS_BUTTON_LABEL[item.status] || item.button || 'VERIFICAR';
  const disabled = ['active', 'pending_reboot', 'verifying', 'applying', 'success', 'unavailable'].includes(item.status);
  const mhz = (item.id === 'xmp' || item.id === 'expo' || item.id === 'docp')
    ? `<div class="rec-status">Memória atual: <b>${esc(item.currentMhz || '—')} MT/s</b>${item.ratedMhz ? ` · Perfil disponível: <b>${esc(item.ratedMhz)} MT/s</b>` : ''}</div>`
    : '';
  const rollbackBtn = item.rollbackSupported
    ? `<button class="btn btn-outline btn-bios-rollback" type="button">DESFAZER</button>`
    : (item.rollbackManual && (item.status === 'active' || item.status === 'success')
      ? `<span class="dim-note">Rollback manual</span>` : '');
  return `<div class="rec-card bios-card" data-bios-id="${esc(item.id)}" style="border-left-color:${meta.color}">
    <div class="rec-head">
      <div>
        <div class="rec-title">${esc(item.name)}</div>
        <div class="rec-status">Status: <b>${esc(biosStatusLabel(item))}</b></div>
        <div class="rec-status">${esc(item.description)}</div>
        ${mhz}
      </div>
      <span class="rec-level" style="color:${meta.color}">${meta.label}</span>
    </div>
    <div class="badges">
      <span class="badge risk-${esc(item.risk)}">${RISK_LABEL[item.risk] || item.risk}</span>
      <span class="badge neutral">${IMPACT_LABEL[item.impact] || item.impact}</span>
      ${item.requiresReboot ? '<span class="badge neutral">REINICIALIZAÇÃO NECESSÁRIA</span>' : ''}
      <span class="badge neutral">${esc(item.auto ? 'AUTOMÁTICO' : 'MANUAL')}</span>
    </div>
    <div class="rec-path">${esc((item.paths || []).join(' · '))} · ${esc(item.compatibility || '')}</div>
    <div class="bios-card-actions">
      <button class="btn ${item.status === 'manual' || item.status === 'informational' ? 'btn-outline' : 'btn-primary'} btn-bios-action" type="button" ${disabled ? 'disabled' : ''}>${esc(btn)}</button>
      <button class="btn btn-outline btn-bios-dry" type="button">${esc(item.auto ? 'OTIMIZAR BIOS' : 'Otimizar BIOS')}</button>
      ${rollbackBtn}
    </div>
  </div>`;
}

function renderBiosOptimizations() {
  const box = $('#biosList');
  const label = $('#biosFoundLabel');
  const pendingBanner = $('#biosPendingBanner');
  const logEl = $('#biosLog');
  if (!box) return;
  const bios = state.bios;
  if (!bios || !bios.items) {
    box.innerHTML = '<p class="empty-note">Execute ANALISAR para detectar otimizações de BIOS neste computador.</p>';
    if (label) label.textContent = 'Analise o computador para detectar otimizações de firmware.';
    if (pendingBanner) pendingBanner.classList.add('hidden');
    return;
  }
  const filter = state.filter || 'all';
  const items = bios.items.filter((i) => filter === 'all' || i.level === filter);
  const found = bios.counts && bios.counts.found != null ? bios.counts.found : items.length;
  if (label) label.textContent = `${found} otimização(ões) encontrada(s) · provider ${bios.providerName || bios.provider || '—'}`;
  if (pendingBanner) pendingBanner.classList.toggle('hidden', !(bios.counts && bios.counts.pending));
  box.innerHTML = items.length
    ? items.map(biosCardHtml).join('')
    : '<p class="empty-note">Nenhuma otimização nesta categoria.</p>';
  if (logEl) logEl.textContent = (bios.logs || []).join('\n');

  $$('#biosList .btn-bios-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.bios-card').dataset.biosId;
      handleBiosAction(id);
    });
  });
  $$('#biosList .btn-bios-dry').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.bios-card').dataset.biosId;
      handleBiosDryRun(id);
    });
  });
  $$('#biosList .btn-bios-rollback').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.bios-card').dataset.biosId;
      handleBiosRollback(id);
    });
  });
}

function showPromptDialog({ title, html, okLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const dlg = $('#confirmDialog');
    const body = $('#confirmBody');
    const titleEl = $('#confirmTitle');
    const ok = $('#confirmOk');
    const cancel = $('#confirmCancel');
    if (!dlg || !body) {
      resolve(window.confirm(title || 'Continuar?'));
      return;
    }
    if (titleEl) titleEl.textContent = title || 'Confirmar';
    body.innerHTML = html;
    if (ok) ok.textContent = okLabel || 'Continuar';
    if (cancel) cancel.textContent = cancelLabel || 'Cancelar';
    dlg.classList.remove('hidden');
    const finish = (val) => {
      dlg.classList.add('hidden');
      if (ok) { ok.textContent = 'Aplicar'; ok.removeEventListener('click', onOk); }
      if (cancel) { cancel.textContent = 'Cancelar'; cancel.removeEventListener('click', onCancel); }
      dlg.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (e) => { if (e.target === dlg) finish(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dlg.addEventListener('click', onBackdrop);
  });
}

async function handleBiosDryRun(id) {
  const item = state.bios && state.bios.items && state.bios.items.find((x) => x.id === id);
  const isAuto = !!(item && item.auto);
  try {
    const preview = await api().biosDryRun(id);
    const go = await showPromptDialog({
      title: isAuto ? 'Otimizar BIOS' : 'Otimizar BIOS',
      okLabel: isAuto ? 'OTIMIZAR BIOS' : 'OTIMIZAR BIOS',
      html: `<p>O Orion pretende:</p>
        <p>Alteração: <b>${esc(preview.setting)}</b></p>
        <p>Atual: <b>${esc(preview.current)}</b></p>
        <p>Novo: <b>${esc(preview.next)}</b></p>
        <p>Reboot: <b>${esc(preview.reboot)}</b></p>
        <p>Provider: <b>${esc(preview.provider)}</b></p>
        <p>Modo: <b>${esc(preview.mode)}</b></p>
        <p class="disclaimer">${isAuto
          ? 'A otimização será aplicada automaticamente e verificada após a reinicialização.'
          : 'Esta alteração exige configuração manual na BIOS — o botão acima apenas explica o procedimento.'}</p>`
    });
    if (go) await handleBiosAction(id);
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
}

async function handleBiosAction(id) {
  const item = state.bios && state.bios.items && state.bios.items.find((x) => x.id === id);
  if (!item) return;
  if (item.status === 'manual' || item.status === 'informational') {
    await openBiosGuide(id, item);
    return;
  }
  if (!item.auto) {
    await openBiosGuide(id, item);
    return;
  }
  try {
    const preview = await api().biosDryRun(id);
    const ok = await showPromptDialog({
      title: item.requiresReboot ? 'Esta otimização exige uma reinicialização.' : 'Aplicar otimização',
      okLabel: item.requiresReboot ? 'APLICAR E REINICIAR' : 'APLICAR',
      html: `<p>Configuração: <b>${esc(preview.setting)}</b></p>
        <p>Estado atual: <b>${esc(preview.current)}</b></p>
        <p>Estado esperado: <b>${esc(preview.next)}</b></p>
        <p class="disclaimer">Somente a operação autorizada será executada. Um prompt UAC pode aparecer.</p>`
    });
    if (!ok) return;
    toast('Preparando otimização...');
    const res = await api().biosApply({ id, reboot: !!item.requiresReboot });
    if (res.manual) {
      await openBiosGuide(id, item);
      return;
    }
    if (!res.ok) {
      toast(`❌ ${esc(res.message || 'Falha ao aplicar.')}`);
    } else {
      toast(`✅ ${esc(res.message || 'Operação registrada.')}`);
    }
    state.bios = await api().biosList();
    renderBiosOptimizations();
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
}

async function openBiosGuide(id, item) {
  try {
    const g = await api().biosGuide(id);
    const verify = await showPromptDialog({
      title: 'Configuração manual necessária',
      okLabel: 'Avisar após reiniciar',
      cancelLabel: 'Fechar',
      html: `<p><b>${esc(g.name)}</b></p>
        <p>${esc(g.description)}</p>
        <h4>Valor atual</h4><p>${esc(g.current && g.current.label)}</p>
        <h4>Valor recomendado</h4><p>${esc(g.recommended)}</p>
        <h4>Caminho aproximado</h4><ul class="paths">${(g.paths || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <h4>Como fazer</h4><ol>${(g.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${item && item.compatibility ? `<p class="disclaimer">${esc(item.compatibility)}</p>` : ''}
        <p class="disclaimer">O Orion não afirma que a opção foi aplicada até verificar o hardware de novo.</p>`
    });
    if (verify && api().biosScheduleVerify) {
      await api().biosScheduleVerify(id);
      state.bios = await api().biosList();
      renderBiosOptimizations();
      toast('Operação pendente criada. Após reiniciar, o Orion verifica o resultado.');
    }
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
}

async function handleBiosRollback(id) {
  try {
    const res = await api().biosRollback(id);
    toast(res.ok ? `✅ ${esc(res.message)}` : `⚠ ${esc(res.message || 'Rollback manual')}`);
    state.bios = await api().biosList();
    renderBiosOptimizations();
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
}

if ($('#biosScanBtn')) {
  $('#biosScanBtn').addEventListener('click', async () => {
    const btn = $('#biosScanBtn');
    btn.disabled = true;
    try {
      if (api().biosScan) {
        state.bios = await api().biosScan();
      } else if (!state.result) {
        await startAnalysis();
        return;
      }
      renderBiosOptimizations();
      toast(state.bios && state.bios.counts
        ? `✅ ${state.bios.counts.found} otimização(ões) encontrada(s)`
        : 'Análise de BIOS concluída.');
    } catch (err) {
      toast(`❌ ${esc(err.message || err)}`);
    } finally {
      btn.disabled = false;
    }
  });
}

if (api().onBiosBootVerify) {
  api().onBiosBootVerify((res) => {
    state.bios = res.payload || state.bios;
    renderBiosOptimizations();
    const banner = $('#biosVerifyBanner');
    if (banner && res.checked && res.checked.length) {
      const ok = res.checked.filter((c) => c.status === 'success').length;
      const fail = res.checked.filter((c) => c.status === 'failed').length;
      banner.classList.remove('hidden');
      banner.textContent = `Verificando alterações... ${ok} confirmada(s), ${fail} falha(s).`;
    }
    toast('Verificação pós-reinício da BIOS concluída.');
  });
}

// ---------------- Modal de detalhes ----------------
function openDetails(rec) {
  if (!rec) return;
  const meta = LEVEL_META[rec.effectiveLevel] || LEVEL_META.informational;
  $('#modalBody').innerHTML = `
    <h2>${esc(rec.name)}</h2>
    <div class="m-lvl" style="color:${meta.color}">${typeof appIcon === 'function' ? appIcon(meta.icon, { size: 14 }) : ''} ${meta.label}</div>

    <h4>O que faz</h4>
    <p>${esc(rec.reason)}</p>

    <h4>Status atual</h4>
    <p>${esc(rec.statusText.replace(/^Status: /, ''))}</p>

    <h4>Recomendação</h4>
    <p><b>${esc(rec.recommendation)}</b></p>

    <h4>Benefício esperado</h4>
    <p>${esc(rec.benefit)}</p>

    <h4>Compatibilidade</h4>
    <p>${esc(rec.compatibility)}</p>

    <div class="badges" style="margin-top:12px">
      <span class="badge risk-${rec.risk}">${RISK_LABEL[rec.risk]}</span>
      <span class="badge neutral">${IMPACT_LABEL[rec.impact]}</span>
      ${rec.rebootRequired ? '<span class="badge neutral">REINICIALIZAÇÃO NECESSÁRIA</span>' : ''}
    </div>

    <h4>Como encontrar (caminho provável)</h4>
    <ul class="paths">${rec.paths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

    ${rec.steps.length ? `<h4>Passo a passo</h4><ol>${rec.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}

    ${rec.notes.length ? rec.notes.map((n) => `<p class="note">⚠ ${esc(n)}</p>`).join('') : ''}

    <p class="foot-disclaimer">Os nomes das opções podem variar conforme fabricante e versão da BIOS.
    Esta ferramenta orienta manualmente — nunca aplica alterações automaticamente.</p>`;
  $('#modal').classList.remove('hidden');
}
$('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) $('#modal').classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('#modal').classList.add('hidden');
});

// ---------------- Relatório ----------------
$('#reportBtn').addEventListener('click', async () => {
  try {
    const res = await api().generateReport();
    toast(`📄 Relatório gerado:<br><small style="color:var(--dim)">${esc(res.htmlPath)}</small><br><br><a id="openReportLink">Abrir pasta</a>`, 12000);
    setTimeout(() => {
      const link = $('#openReportLink');
      if (link) link.addEventListener('click', (e) => { e.preventDefault(); api().openPath(res.dir); });
    }, 0);
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
});

// ---------------- Exportação técnica ----------------
$('#exportRawLink').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const file = await api().exportRaw();
    toast(`🗂 Dados brutos exportados:<br><small style="color:var(--dim)">${esc(file)}</small>`);
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
});

// ---------------- Histórico ----------------
async function renderHistory() {
  const list = await api().historyList();
  const tbody = $('#historyTable tbody');
  state.historySelection = [];
  $('#compareBtn').disabled = true;
  $('#compareResult').innerHTML = '';

  tbody.innerHTML = list.length ? list.map((e) => `
    <tr data-id="${esc(e.id)}">
      <td><input type="checkbox" class="hist-check"/></td>
      <td>${new Date(e.date).toLocaleString('pt-BR')}</td>
      <td><b>${e.score}/100</b></td>
      <td title="${esc(e.hardware.cpu)}">${esc(short(e.hardware.cpu, 34))}</td>
      <td>${e.hardware.ramTotalGB ?? '—'} GB @ ${e.hardware.ramConfigMHz ?? '?'} MHz</td>
      <td title="${esc(e.hardware.motherboard)}">${esc(short(e.hardware.motherboard, 28))}</td>
      <td title="${esc(e.hardware.bios)}">${esc(short(e.hardware.bios, 30))}</td>
      <td style="color:var(--green)">${e.counts.recommended}</td>
      <td style="color:var(--yellow)">${e.counts.optional}</td>
      <td style="color:var(--red-bright)">${e.counts.critical}</td>
    </tr>`).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--dim)">Nenhuma análise no histórico ainda.</td></tr>';

  $$('.hist-check').forEach((chk) => {
    chk.addEventListener('change', () => {
      const tr = chk.closest('tr');
      if (chk.checked) {
        state.historySelection.push(tr.dataset.id);
        tr.dataset.sel = '1';
      } else {
        state.historySelection = state.historySelection.filter((x) => x !== tr.dataset.id);
        delete tr.dataset.sel;
      }
      if (state.historySelection.length > 2) {
        const first = document.querySelector(`tr[data-sel]:not([data-id="${tr.dataset.id}"])`);
        if (first && state.historySelection.length > 2) {
          state.historySelection.shift();
          delete first.dataset.sel;
          const fc = first.querySelector('.hist-check');
          if (fc) fc.checked = false;
        }
      }
      $('#compareBtn').disabled = state.historySelection.length !== 2;
    });
  });
}
function short(s, n) {
  if (!s) return '—';
  return String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s);
}

$('#refreshHistoryBtn').addEventListener('click', renderHistory);

$('#compareBtn').addEventListener('click', async () => {
  if (state.historySelection.length !== 2) return;
  const [before, after] = state.historySelection;
  let [a, b] = [before, after];
  const list = await api().historyList();
  const ia = list.findIndex((x) => x.id === before);
  const ib = list.findIndex((x) => x.id === after);
  if (ia > ib) [a, b] = [after, before];

  const cmp = await api().historyCompare(a, b);
  if (!cmp) { toast('❌ Não foi possível comparar.'); return; }

  const deltaCls = (d) => (d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : '');
  const fmtDelta = (d) => (d === null ? '—' : d > 0 ? `+${d}` : String(d));

  $('#compareResult').innerHTML = `
  <div class="compare-block">
    <h3 style="margin-bottom:12px;color:var(--red-bright)">ANTES → DEPOIS</h3>
    <table>
      <tr><th>Métrica</th><th>Antes (${new Date(cmp.before.date).toLocaleString('pt-BR')})</th><th>Depois (${new Date(cmp.after.date).toLocaleString('pt-BR')})</th><th>Δ</th></tr>
      <tr><td><b>Score geral</b></td><td>${cmp.before.score}/100</td><td>${cmp.after.score}/100</td><td class="${deltaCls(cmp.scoreDelta)}">${fmtDelta(cmp.scoreDelta)}</td></tr>
      ${Object.entries(cmp.categoriesDelta).map(([cat, d]) => `
        <tr><td>${esc(cat)}</td><td>${d.before ?? '—'}%</td><td>${d.after ?? '—'}%</td>
        <td class="${deltaCls((d.after ?? 0) - (d.before ?? 0))}">${fmtDelta((d.after ?? 0) - (d.before ?? 0))}</td></tr>`).join('')}
      <tr><td>🟢 Recomendadas</td><td>${cmp.before.counts.recommended}</td><td>${cmp.after.counts.recommended}</td><td class="${deltaCls(cmp.countsDelta.recommended * -1)}">${fmtDelta(cmp.countsDelta.recommended)}</td></tr>
      <tr><td>🟡 Opcionais</td><td>${cmp.before.counts.optional}</td><td>${cmp.after.counts.optional}</td><td>${fmtDelta(cmp.countsDelta.optional)}</td></tr>
      <tr><td>🔴 Críticas</td><td>${cmp.before.counts.critical}</td><td>${cmp.after.counts.critical}</td><td class="${deltaCls(cmp.countsDelta.critical * -1)}">${fmtDelta(cmp.countsDelta.critical)}</td></tr>
    </table>
    <p style="color:var(--dim);font-size:12px;margin-top:8px">Dica: reduções em 🟢/🔴 indicam recomendações resolvidas após ajustes manuais na BIOS.</p>
  </div>`;
});

// ---------------- Licença / Ativação ----------------
function setLicenseBadge(st) {
  const el = $('#licBadge');
  if (!el) return;
  if (!st) { el.textContent = 'LICENÇA: VERIFICANDO…'; el.className = 'lic-badge'; return; }
  if (st.active) {
    const exp = st.expiresAt ? new Date(st.expiresAt).toLocaleDateString('pt-BR') : 'VITALÍCIO';
    const warn = st.daysLeft != null && st.daysLeft <= 7;
    el.textContent = `LICENÇA ${st.offlineGrace ? '(OFFLINE) ' : ''}${st.plan ? st.plan.toUpperCase() + ' · ' : ''}${st.expiresAt ? 'VÁLIDA ATÉ ' + exp : exp}`;
    el.className = 'lic-badge ' + (warn ? 'warn' : 'ok');
  } else {
    const msgs = {
      PRODUCT_NOT_ACTIVATED: 'LICENÇA NÃO ATIVADA',
      VALIDATION_REQUIRED: 'LICENÇA: REVALIDAÇÃO NECESSÁRIA',
      LICENSE_EXPIRED: 'LICENÇA EXPIRADA',
      LICENSE_BLOCKED: 'LICENÇA BLOQUEADA',
      VERSION_NOT_AUTHORIZED: 'VERSÃO NÃO AUTORIZADA'
    };
    el.textContent = msgs[st.reason] || 'LICENÇA INATIVA';
    el.className = 'lic-badge bad';
  }
}

function applyLicenseState(st) {
  state.licensed = Boolean(st && st.active);
  state.licenseInfo = st;
  setLicenseBadge(st);
  $$('.sidebar-item').forEach((t) => { t.disabled = !state.licensed; });
  $('#analyzeBtn').disabled = !state.licensed;
  if (state.licensed) {
    if ($('#view-activation').classList.contains('active')) showView('home');
  } else {
    showView('activation');
    renderActivationDevice();
  }
}

function activationMsg(text, cls) {
  const el = $('#activationMsg');
  el.textContent = text || '';
  el.className = 'activation-msg' + (cls ? ` ${cls}` : '');
}

async function renderActivationDevice() {
  try {
    const st = await api().licenseGetState();
    $('#activationDevice').textContent = st.key
      ? `Chave atual: ${st.key}`
      : 'Sem chave registrada neste computador.';
  } catch (_) { /* silencioso */ }
}

$('#activateBtn').addEventListener('click', async () => {
  const key = $('#licenseKeyInput').value.trim();
  if (!key) { activationMsg('Informe a chave de licença recebida na compra.', 'err'); return; }
  $('#activateBtn').disabled = true;
  activationMsg('Validando licença no servidor…', 'info');
  try {
    await api().licenseActivate(key);
    activationMsg('Licença ativada com sucesso!', 'okmsg');
    toast('✅ Licença ativada — todos os recursos liberados.');
  } catch (err) {
    const map = {
      LICENSE_NOT_FOUND: 'Chave não encontrada. Verifique se digitou corretamente.',
      LICENSE_EXPIRED: 'Esta licença está expirada — renove na Orion Store.',
      LICENSE_BLOCKED: 'Esta licença foi bloqueada.',
      VERSION_NOT_AUTHORIZED: 'Esta versão exige o pacote de atualização. Sua licença vitalícia continua válida para a versão autorizada.',
      DEVICE_LIMIT: 'Limite de dispositivos atingido para esta chave.',
      EMPTY_KEY: 'Informe uma chave de licença.'
    };
    activationMsg(map[err.code] || `Falha ao ativar: ${err.message || err}`, 'err');
  } finally {
    $('#activateBtn').disabled = false;
  }
});

$('#licenseKeyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#activateBtn').click();
});

api().onLicenseChanged((st) => applyLicenseState(st));

// ---------------- Progresso dos serviços (Game Boost / Segurança) ----------------
api().onServiceStep((step) => {
  if (step && step.label) toast(`⏳ ${esc(step.label)}`, 4000);
});

// ---------------- Game Boost ----------------
$('#gbAnalyzeBtn').addEventListener('click', async () => {
  const btn = $('#gbAnalyzeBtn');
  btn.disabled = true;
  $('#gbStatus').classList.remove('hidden');
  try {
    const res = await api().gameBoostAnalyze();
    state.gameBoost = res;
    $('#gbEmpty').classList.add('hidden');
    renderGameBoost();
    toast(`🎮 Game Boost Score: <b>${res.score}/100</b>`);
  } catch (err) {
    toast(`❌ Falha na análise do Game Boost: ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
    $('#gbStatus').classList.add('hidden');
  }
});

function checkRow(c) {
  const dotCls = c.value === true ? 'on' : c.value === false ? 'off' : 'unknown';
  return kv(c.label, `<span class="dot ${dotCls}"></span>${esc(c.text)}`);
}

function renderGameBoost() {
  const r = state.gameBoost;

  const checksBody = r.checks.map(checkRow).join('');
  $('#gbCards').innerHTML = `<div class="hw-grid">
      ${hwCard('RECURSOS DO WINDOWS PARA JOGOS', esc(r.powerScheme || ''), checksBody, true)}
    </div>`;

  // Score
  $('#gbScoreValue').textContent = r.score;
  const color = r.score >= 80 ? 'var(--green)' : r.score >= 50 ? 'var(--yellow)' : 'var(--red-bright)';
  const ring = $('#gbScoreRing');
  ring.style.setProperty('--pct', r.score);
  ring.style.setProperty('--scoreColor', color);

  $('#gbPenalties').innerHTML =
    r.penalties.length
      ? r.penalties.map((p) => `<li><span>${esc(p.why)}</span><b>-${p.pts}</b></li>`).join('')
      : '<li><span>Nenhum ponto negativo detectado 🎉</span></li>';

  $('#gbCounts').innerHTML =
    `<div class="count-row"><span>🟢 Recomendadas</span><b style="color:var(--green)">${r.counts.recommended}</b></div>
     <div class="count-row"><span>🟡 Opcionais</span><b style="color:var(--yellow)">${r.counts.optional}</b></div>
     <div class="count-row"><span>🔴 Críticas</span><b style="color:var(--red-bright)">${r.counts.critical}</b></div>`;

  $('#gbRecList').innerHTML = r.recommendations.length
    ? r.recommendations.map(recCardHtml).join('')
    : '<p class="empty-note">Nada a ajustar — sua configuração gamer está boa.</p>';

  $$('#view-gameboost .btn-details').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.rec-card').dataset.id;
      openDetails(r.recommendations.find((x) => x.id === id));
    });
  });
}

// ---------------- Modo Jogo (Game Booster) ----------------
let gbPicked = null;
let gbList = [];
let gbActive = { running: false, pending: false };

function initGameBoostView(force) {
  loadGbGames();
  if (force || !api().gameBoostSessionStatus) return;
  api().gameBoostSessionStatus()
    .then((st) => {
      if (st) {
        gbActive = { running: !!st.running, pending: !!st.pending };
        if (!st.running && !st.pending) return;
        setGbSession(gbActive, st.running
          ? `🎮 ${esc((st.session && st.session.gameName) || 'Jogo')} em execução — boost ativo.`
          : 'Aguardando confirmação de administrador…');
      }
    })
    .catch(() => { /* ignora */ });
}

async function loadGbGames() {
  try {
    gbList = await api().gameBoostListGames();
  } catch (_) { gbList = []; }
  renderGbGames();
}

function renderGbGames() {
  const list = $('#gbGameList');
  if (!list) return;
  if (!gbList.length) {
    list.innerHTML = '<p class="empty-note" style="text-align:left;margin:0;">Nenhum jogo adicionado ainda.</p>';
    return;
  }
  list.innerHTML = gbList.map((g) => `
    <div class="toolbar" style="border-top:1px solid var(--border);padding:10px 0;align-items:center;">
      <div style="flex:1;min-width:0;">
        <b style="font-size:0.9rem;">${esc(g.name)}</b>
        <div style="font-size:0.72rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(g.path)}</div>
      </div>
      <button class="btn btn-primary" data-gb="start" data-id="${esc(g.id)}" ${gbActive.running ? 'disabled' : ''}>Iniciar boost</button>
      <button class="btn btn-outline" data-gb="remove" data-id="${esc(g.id)}" ${gbActive.running ? 'disabled' : ''}>Remover</button>
    </div>`).join('');
}

function setGbSession(status, text) {
  gbActive = status;
  const box = $('#gbSessionStatus');
  const el = $('#gbSessionText');
  if (!box || !el) return;
  if (text) {
    box.classList.remove('hidden');
    el.innerHTML = text;
  } else {
    box.classList.add('hidden');
    el.textContent = '';
  }
  renderGbGames();
}

function gbDefaultName(p) {
  return p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || p;
}

if ($('#gbPickBtn')) {
  $('#gbPickBtn').addEventListener('click', async () => {
    try {
      const p = await api().gameBoostPickExe();
      if (!p) { toast('Nenhum arquivo selecionado.'); return; }
      gbPicked = p;
      $('#gbGameName').value = gbDefaultName(p);
      toast(`✅ Selecionado: <b>${esc(gbDefaultName(p))}</b>`);
    } catch (err) { toast(`❌ ${esc(err.message || err)}`); }
  });
}

if ($('#gbAddBtn')) {
  $('#gbAddBtn').addEventListener('click', async () => {
    if (!gbPicked) { toast('Primeiro clique em "Escolher jogo/app…".'); return; }
    const name = $('#gbGameName').value.trim() || gbDefaultName(gbPicked);
    try {
      const item = await api().gameBoostAddGame({ path: gbPicked, name });
      gbPicked = null;
      $('#gbGameName').value = '';
      toast(`✅ <b>${esc(item.name)}</b> adicionado.`);
      loadGbGames();
    } catch (err) { toast(`❌ ${esc(err.message || err)}`); }
  });
}

if ($('#gbGameList')) {
  $('#gbGameList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-gb]');
    if (!btn) return;
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      if (btn.dataset.gb === 'start') {
        const res = await api().gameBoostStartSession(id);
        setGbSession({ running: false, pending: true }, res.message || 'Aguardando permissão de administrador...');
        toast(`🎮 <b>${esc(res.gameName || '')}</b> — ${esc(res.message || 'Boost iniciando...')}`);
      } else if (btn.dataset.gb === 'remove') {
        await api().gameBoostRemoveGame(id);
        toast('Removido da lista.');
        loadGbGames();
      }
    } catch (err) {
      setGbSession({ running: false, pending: false }, null);
      toast(`❌ ${esc(err.message || err)}`);
    }
  });
}

if (api().onGameBoostSession) {
  api().onGameBoostSession((s) => {
    const msg = s.message || '';
    if (s.state === 'running') {
      setGbSession({ running: true, pending: false }, `🎮 ${esc((s.session && s.session.gameName) || 'Jogo')} — ${esc(msg || 'boost ativo')}`);
    } else if (s.state === 'ended') {
      setGbSession({ running: false, pending: false }, null);
      toast(`✅ ${esc(msg || 'Sessão encerrada. Plano de energia restaurado.')}`);
      renderGbGames();
    } else if (s.state === 'stopped') {
      setGbSession({ running: false, pending: false }, null);
      toast(`ℹ️ ${esc(msg || 'Sessão encerrada.')}`);
    } else if (s.state === 'cancelled') {
      setGbSession({ running: false, pending: false }, null);
      toast(`❌ ${esc(msg || 'Permissão negada — sessão não iniciada.')}`);
    }
  });
}

// ---------------- Segurança ----------------
$('#secAnalyzeBtn').addEventListener('click', async () => {
  const btn = $('#secAnalyzeBtn');
  btn.disabled = true;
  $('#secStatus').classList.remove('hidden');
  try {
    const res = await api().securityAnalyze();
    state.security = res;
    $('#secEmpty').classList.add('hidden');
    renderSecurity();
    toast(`🛡 Análise concluída — Security Score: <b>${res.score}/100</b>${res.activeThreatCount ? ` · <b>${res.activeThreatCount} ameaça(s) ATIVA(S)</b>` : ''}`);
  } catch (err) {
    toast(`❌ Falha na análise de segurança: ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
    $('#secStatus').classList.add('hidden');
  }
});

$('#secScanBtn').addEventListener('click', async () => {
  if (!confirm('Iniciar a Verificação Rápida nativa do Microsoft Defender?\n\nEla roda em segundo plano e pode levar alguns minutos.')) return;
  const btn = $('#secScanBtn');
  btn.disabled = true;
  try {
    const res = await api().securityQuickScan();
    toast(res.started ? `🔎 ${esc(res.note)}` : `❌ ${esc(res.error || 'Não foi possível iniciar a verificação.')}`, 9000);
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
  }
});

function protRow(label, val, extra = '') {
  const dotCls = val === true ? 'on' : val === false ? 'off' : 'unknown';
  const txt = val === true ? 'Ativado' : val === false ? 'Desativado' : 'não determinado';
  return kv(label, `<span class="dot ${dotCls}"></span>${txt}${extra}`);
}

function renderSecurity() {
  const r = state.security;
  const d = r.defender;

  const defBody =
    protRow('Proteção em tempo real', d.realTimeEnabled) +
    protRow('Antivírus', d.antivirusEnabled) +
    protRow('Proteção contra adulteração', d.tamperProtected) +
    kv('Versão de assinaturas', dash(d.signatureVersion)) +
    kv('Assinaturas atualizadas', d.signatureLastUpdated
      ? `${d.signatureAgeDays ?? '?'} dia(s) atrás`
      : dash(null)) +
    kv('Última verificação rápida', d.lastQuickScan
      ? `${new Date(d.lastQuickScan).toLocaleString('pt-BR')} (${d.lastQuickScanAgeDays ?? '?'} d)`
      : 'nenhuma registrada') +
    kv('PUA / Exclusões', `${r.preferences.puaProtection == null ? '–' : r.preferences.puaProtection >= 1 ? 'PUA on' : 'PUA off'} · ${r.preferences.exclusions ?? '?'} exclusão(ões)`);

  const avBody = r.avProducts.length
    ? r.avProducts.map((a) => protRow(a.name, a.enabled)).join('')
    : kv('Produtos antivírus', 'nenhum registrado no Windows Security Center');

  const fwTxt = (v) => v === true ? 'Ativado' : v === false ? 'DESATIVADO' : 'não determinado';
  const sysBody =
    protRow('Firewall (Domínio)', r.firewall.domain) +
    protRow('Firewall (Privado)', r.firewall.private) +
    protRow('Firewall (Público)', r.firewall.public) +
    protRow('UAC (Controle de Conta)', r.uac.enableLua) +
    protRow('SmartScreen', r.smartscreen.explorer != null ? String(r.smartscreen.explorer).toLowerCase() !== 'off' : null,
      r.smartscreen.explorer ? ` (${esc(String(r.smartscreen.explorer))})` : '');

  $('#secCards').innerHTML = `<div class="hw-grid">
      ${hwCard('MICROSOFT DEFENDER', '', defBody)}
      ${hwCard('ANTIVÍRUS REGISTRADOS', '', avBody)}
      ${hwCard('PROTEÇÕES DO SISTEMA', '', sysBody)}
    </div>`;

  // Score
  $('#secScoreValue').textContent = r.score;
  const color = r.score >= 80 ? 'var(--green)' : r.score >= 50 ? 'var(--yellow)' : 'var(--red-bright)';
  const ring = $('#secScoreRing');
  ring.style.setProperty('--pct', r.score);
  ring.style.setProperty('--scoreColor', color);
  $('#secPenalties').innerHTML =
    r.penalties.length
      ? r.penalties.map((p) => `<li><span>${esc(p.why)}</span><b>-${p.pts}</b></li>`).join('')
      : '<li><span>Sistema protegido 🎉</span></li>';

  // Ameaças
  $('#secThreatCounts').innerHTML =
    `<div class="count-row"><span>Total registrado</span><b>${r.threatCount}</b></div>
     <div class="count-row"><span>Ativas agora</span><b style="color:${r.activeThreatCount ? 'var(--red-bright)' : 'var(--green)'}">${r.activeThreatCount}</b></div>`;
  $('#goThreatsBtn').classList.toggle('hidden', !r.threatCount);

  const tbody = $('#threatTable tbody');
  tbody.innerHTML = r.threats.length
    ? r.threats.map((t) => `
      <tr>
        <td>${t.detectedAt ? new Date(t.detectedAt).toLocaleString('pt-BR') : '—'}</td>
        <td title="${esc(t.resources.join('\n'))}"><b>${esc(t.name)}</b></td>
        <td style="color:${t.severityId >= 4 ? 'var(--red-bright)' : t.severityId >= 1 ? 'var(--yellow)' : 'inherit'}">${esc(t.severityLabel)}</td>
        <td>${t.active ? '<b style=\"color:var(--red-bright)\">ATIVA</b>' : t.executed ? 'Executou antes' : 'Bloqueada/Removida'}</td>
        <td title="${esc(t.process)}">${esc(short(t.process, 30))}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--dim)">Nenhuma ameaça registrada pelo Microsoft Defender.</td></tr>';

  // Recomendações
  $('#secRecList').innerHTML = r.recommendations.length
    ? r.recommendations.map(recCardHtml).join('')
    : '<p class="empty-note">Nenhuma recomendação — proteções em dia.</p>';
  $$('#view-security .btn-details').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.rec-card').dataset.id;
      openDetails(r.recommendations.find((x) => x.id === id));
    });
  });
}

$('#goThreatsBtn').addEventListener('click', () => {
  $('#threatSectionTitle').scrollIntoView({ behavior: 'smooth' });
});

// ---------------- Toast ----------------
let toastTimer = null;
function toast(html, ms = 6000) {
  const stack = $('#toastStack');
  const raw = String(html ?? '');
  let type = 'info';
  if (/✅|sucesso/i.test(raw)) type = 'success';
  if (/❌|falha|erro/i.test(raw)) type = 'error';
  if (/⚠|atenção|aviso/i.test(raw)) type = 'warning';
  const clean = raw.replace(/^[✅❌⚠ℹ🎮🛡📄🗂⏳🧹🔧↩️🏁📏🌐●▶✕🔎]+\s*/, '');
  const iconName = type === 'success' ? 'ok' : type === 'error' ? 'fail' : type === 'warning' ? 'risk' : 'scan';
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `${typeof appIcon === 'function' ? appIcon(iconName, { size: 16 }) : ''}<div>${clean}</div>`;
  if (stack) {
    stack.appendChild(node);
    setTimeout(() => node.remove(), ms);
    return;
  }
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = clean;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// Ações dentro do toast (CSP bloqueia onclick inline).
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[data-action="reload"]');
  if (a) location.reload();
});

// ================= OTIMIZAR =================
let optLoaded = false;
let optToolbarBound = false;
let optApplying = false;
let optApplyTotal = 0;
let optApplyDone = 0;

function persistApplied() {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify([...state.optApplied])); } catch (_) { /* ignore */ }
}

async function initOptimizeView() {
  try {
    const [items, profiles, drivers] = await Promise.all([
      api().engineListItems(),
      api().engineGetProfiles(),
      api().engineGetDrivers()
    ]);
    state.optItems = items;
    state.optProfiles = profiles;
    state.optApplied = new Set(items.filter((i) => i.applied).map((i) => i.id));
    try {
      JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]').forEach((id) => state.optApplied.add(id));
    } catch (_) { /* ignore */ }
    try {
      state.optCustomIds = JSON.parse(localStorage.getItem(CUSTOM_PROFILE_KEY) || '[]');
    } catch (_) { state.optCustomIds = []; }
    optLoaded = true;
    renderProfiles();
    renderDrivers(drivers);
    buildOptFilters();
    bindOptToolbar();
    renderOptItems();
  } catch (err) {
    toast(`❌ Não foi possível carregar o catálogo: ${esc(err.message || err)}`);
  }
}

function riskBadge(risk) {
  const label = { low: 'RISCO BAIXO', medium: 'RISCO MÉDIO', high: 'RISCO ALTO' }[risk] || risk;
  const icon = risk === 'high' ? appIcon('risk', { size: 12 }) : '';
  return `<span class="badge risk-${risk}">${icon}${label}</span>`;
}

function updateSelectedCount() {
  const el = $('#optSelectedCount');
  if (!el) return;
  const n = state.optSelected.size;
  el.textContent = n === 1 ? '1 selecionada' : `${n} selecionadas`;
}

function renderProfiles() {
  const row = $('#profileRow');
  if (!row) return;
  const cards = state.optProfiles.map((p) => {
    const count = p.count != null ? p.count : state.optItems.filter((i) => (i.profiles || []).includes(p.id)).length;
    return `
    <button type="button" class="profile-card${state.optActiveProfile === p.id ? ' active' : ''}" data-profile="${esc(p.id)}">
      <div class="profile-icon">${appIcon(p.icon || 'system', { size: 24, strokeWidth: 1.75 })}</div>
      <div class="profile-name">${esc(p.name)}</div>
      <div class="profile-desc">${esc(p.description)}</div>
      <div class="profile-count">${count} ajuste${count === 1 ? '' : 's'}</div>
    </button>`;
  }).join('');
  const customCount = state.optCustomIds.length;
  row.innerHTML = cards + `
    <button type="button" class="profile-card${state.optActiveProfile === 'custom' ? ' active' : ''}" data-profile="custom">
      <div class="profile-icon">${appIcon('plus', { size: 24, strokeWidth: 1.75 })}</div>
      <div class="profile-name">Personalizado</div>
      <div class="profile-desc">Salva a seleção atual neste computador.</div>
      <div class="profile-count">${customCount ? `${customCount} ajuste${customCount === 1 ? '' : 's'}` : 'Clique para salvar'}</div>
    </button>`;
  $$('#profileRow .profile-card').forEach((el) => {
    el.addEventListener('click', () => onProfileClick(el.dataset.profile));
  });
}

function showProfileDiff(nextSet) {
  const banner = $('#profileDiff');
  if (!banner) return;
  const entering = [...nextSet].filter((id) => !state.optSelected.has(id)).length;
  const leaving = [...state.optSelected].filter((id) => !nextSet.has(id)).length;
  banner.classList.remove('hidden');
  banner.innerHTML = `${appIcon('scan', { size: 16 })} <span><b>${entering}</b> entram na seleção · <b>${leaving}</b> saem</span>`;
}

function onProfileClick(id) {
  if (id === 'custom') {
    if (state.optSelected.size) {
      state.optCustomIds = [...state.optSelected];
      try { localStorage.setItem(CUSTOM_PROFILE_KEY, JSON.stringify(state.optCustomIds)); } catch (_) { /* ignore */ }
      state.optActiveProfile = 'custom';
      renderProfiles();
      toast('✅ Perfil personalizado salvo neste computador.');
      return;
    }
    if (!state.optCustomIds.length) {
      toast('⚠ Selecione otimizações e clique de novo em Personalizado para salvar.');
      return;
    }
    const next = new Set(state.optCustomIds);
    showProfileDiff(next);
    state.optSelected = next;
    state.optActiveProfile = 'custom';
    renderProfiles();
    renderOptItems();
    toast(`Perfil <b>Personalizado</b> selecionado — ${state.optSelected.size} otimização(ões).`);
    return;
  }
  const p = state.optProfiles.find((x) => x.id === id);
  if (!p) return;
  const next = new Set(state.optItems.filter((i) => (i.profiles || []).includes(p.id)).map((i) => i.id));
  showProfileDiff(next);
  state.optSelected = next;
  state.optActiveProfile = p.id;
  renderProfiles();
  renderOptItems();
  toast(`Perfil <b>${esc(p.name)}</b> selecionado — ${state.optSelected.size} otimização(ões). Revise e clique em APLICAR.`);
}

function renderDrivers(drivers) {
  const names = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel' };
  $('#driverCards').innerHTML = drivers.map((d) => `
    <button type="button" class="profile-card" data-driver="${esc(d.id)}">
      <div class="profile-icon">${appIcon('download', { size: 24, strokeWidth: 1.75 })}</div>
      <div class="profile-name">${names[d.vendor] || d.vendor}</div>
      <div class="profile-desc">Abrir página oficial de drivers.</div>
    </button>`).join('');
  $$('#driverCards .profile-card').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.dataset.driver;
      try {
        const res = await api().engineApply({ ids: [id], label: 'Download de driver' });
        toast(res.ok ? 'Página oficial aberta no navegador.' : '❌ Não foi possível abrir a página do fabricante.');
      } catch (err) {
        toast(`❌ ${esc(err.message || err)}`);
      }
    });
  });
}

function catIcon(cat) {
  return { windows: 'windows', cpu: 'cpu', gpu: 'gpu', ram: 'ram', rede: 'network', armazenamento: 'storage', energia: 'power', inicializacao: 'startup', jogos: 'gaming', limpeza: 'cleaning', seguranca: 'security' }[cat] || 'system';
}

function buildOptFilters() {
  const cats = [...new Set(state.optItems.map((i) => i.category))];
  $('#optFilters').innerHTML =
    `<button data-f="all" class="chip${state.optFilter === 'all' ? ' active' : ''}" type="button">Todas (${state.optItems.length})</button>` +
    cats.map((c) => {
      const n = state.optItems.filter((i) => i.category === c).length;
      return `<button data-f="${esc(c)}" class="chip${state.optFilter === c ? ' active' : ''}" type="button">${appIcon(catIcon(c), { size: 14 })} ${CATEGORY_LABEL[c] || c} (${n})</button>`;
    }).join('');
  $$('#optFilters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('#optFilters .chip').forEach((x) => x.classList.remove('active'));
      chip.classList.add('active');
      state.optFilter = chip.dataset.f;
      renderOptItems();
    });
  });
}

function getFilteredOptItems() {
  const q = state.optSearch.trim().toLowerCase();
  let list = state.optItems.filter((i) => {
    if (state.optFilter !== 'all' && i.category !== state.optFilter) return false;
    if (state.optRiskFilter !== 'all' && i.risk !== state.optRiskFilter) return false;
    if (state.optPlanFilter === 'pro' && !i.proOnly) return false;
    if (state.optPlanFilter === 'free' && i.proOnly) return false;
    if (state.optUnappliedOnly && state.optApplied.has(i.id)) return false;
    if (q && !(i.name || '').toLowerCase().includes(q) && !(i.description || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = list.slice();
  if (state.optSort === 'risk') {
    sorted.sort((a, b) => (RISK_SORT[a.risk] ?? 9) - (RISK_SORT[b.risk] ?? 9) || a.name.localeCompare(b.name, 'pt-BR'));
  } else if (state.optSort === 'category') {
    sorted.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name, 'pt-BR'));
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  return sorted;
}

function clearOptFilters() {
  state.optSearch = '';
  state.optRiskFilter = 'all';
  state.optPlanFilter = 'all';
  state.optUnappliedOnly = false;
  state.optSort = 'name';
  state.optFilter = 'all';
  const search = $('#optSearch');
  if (search) search.value = '';
  if ($('#optRiskFilter')) $('#optRiskFilter').value = 'all';
  if ($('#optPlanFilter')) $('#optPlanFilter').value = 'all';
  if ($('#optUnappliedOnly')) $('#optUnappliedOnly').checked = false;
  if ($('#optSort')) $('#optSort').value = 'name';
  buildOptFilters();
  renderOptItems();
}

function toggleOptItem(id, force) {
  const on = force == null ? !state.optSelected.has(id) : force;
  if (on) state.optSelected.add(id); else state.optSelected.delete(id);
  state.optActiveProfile = null;
  const card = $(`.opt-item[data-id="${CSS.escape(id)}"]`);
  if (card) {
    card.classList.toggle('checked', on);
    card.setAttribute('aria-checked', String(on));
    const chk = card.querySelector('.opt-item-check');
    if (chk) chk.checked = on;
  }
  updateSelectedCount();
}

function renderOptItems() {
  const list = getFilteredOptItems();
  const el = $('#optItemList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      ${appIcon('search', { size: 32, strokeWidth: 1.75, className: 'text-muted-foreground' })}
      <h3>Nenhuma otimização encontrada</h3>
      <p>Ajuste a busca ou os filtros para ver resultados.</p>
      <button type="button" class="btn btn-outline" id="optClearFilters">Limpar filtros</button>
    </div>`;
    const btn = $('#optClearFilters');
    if (btn) btn.addEventListener('click', clearOptFilters);
    updateSelectedCount();
    return;
  }
  el.innerHTML = list.map((it) => {
    const selected = state.optSelected.has(it.id);
    const applied = state.optApplied.has(it.id);
    const expanded = state.optExpanded.has(it.id);
    const hint = it.applyHint || (it.registryKeys || []).join('\n') || 'Ajuste de sistema (sem chave de registro declarada).';
    return `
    <div class="opt-item${selected ? ' checked' : ''}" data-id="${esc(it.id)}" role="checkbox" aria-checked="${selected}" tabindex="0">
      <div class="opt-icon-chip">${appIcon(it.icon || catIcon(it.category), { size: 18 })}</div>
      <div class="opt-body">
        <div class="opt-item-head">
          <h3>${esc(it.name)}</h3>
          <span class="badge neutral">${esc(CATEGORY_LABEL[it.category] || it.category)}</span>
          ${it.proOnly
            ? `<span class="badge pro">${appIcon('pro', { size: 12 })} PRO</span>`
            : '<span class="badge free">GRÁTIS</span>'}
          ${applied ? `<span class="badge applied">${appIcon('ok', { size: 12 })} APLICADA</span>` : ''}
          ${it.rebootRequired ? `<span class="badge reboot">${appIcon('restore', { size: 12 })} REQUER REINÍCIO</span>` : ''}
        </div>
        <div class="opt-desc">${esc(it.description)}</div>
        <div class="opt-benefit">${appIcon('ok', { size: 12, className: 'text-success' })} ${esc(it.benefit)}</div>
        <div class="badges">${riskBadge(it.risk)}${it.requiresAdmin ? '<span class="badge neutral">ADMIN</span>' : ''}</div>
        <div class="opt-details${expanded ? '' : ' hidden'}">${esc(hint)}</div>
      </div>
      <div class="opt-item-actions">
        <input class="opt-item-check opt-check-anim" type="checkbox" ${selected ? 'checked' : ''} tabindex="-1" aria-hidden="true"/>
        <button type="button" class="opt-expand" aria-label="Ver chave de registro" aria-expanded="${expanded}">${appIcon('chevron', { size: 16 })}</button>
        ${applied ? `<button type="button" class="btn btn-outline btn-revert" data-revert="${esc(it.id)}">${appIcon('restore', { size: 14 })} Reverter</button>` : ''}
      </div>
    </div>`;
  }).join('');
  bindOptItemEvents();
  updateSelectedCount();
}

function bindOptItemEvents() {
  $$('#optItemList .opt-item').forEach((card) => {
    const id = card.dataset.id;
    const toggle = () => toggleOptItem(id);
    const chk = card.querySelector('.opt-item-check');
    if (chk) {
      chk.addEventListener('click', (e) => e.stopPropagation());
      chk.addEventListener('change', () => toggleOptItem(id, chk.checked));
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('.opt-expand') || e.target.closest('[data-revert]') || e.target.closest('.opt-item-check')) return;
      toggle();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });
    const expand = card.querySelector('.opt-expand');
    if (expand) {
      expand.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.optExpanded.has(id)) state.optExpanded.delete(id); else state.optExpanded.add(id);
        const box = card.querySelector('.opt-details');
        const on = state.optExpanded.has(id);
        if (box) box.classList.toggle('hidden', !on);
        expand.setAttribute('aria-expanded', String(on));
      });
    }
    const revert = card.querySelector('[data-revert]');
    if (revert) {
      revert.addEventListener('click', (e) => {
        e.stopPropagation();
        revertSingleItem(id);
      });
    }
  });
}

async function revertSingleItem(id) {
  try {
    const res = await api().engineUndoItem(id);
    if (res && res.ok) {
      state.optApplied.delete(id);
      persistApplied();
      toast('✅ Otimização revertida.');
      renderOptItems();
    } else {
      toast(`⚠ ${esc((res && res.message) || 'Não foi possível reverter.')}`);
    }
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  }
}

function bindOptToolbar() {
  if (optToolbarBound) return;
  optToolbarBound = true;
  const search = $('#optSearch');
  if (search) {
    let t = null;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.optSearch = search.value || '';
        renderOptItems();
      }, 200);
    });
  }
  const risk = $('#optRiskFilter');
  if (risk) risk.addEventListener('change', () => { state.optRiskFilter = risk.value; renderOptItems(); });
  const plan = $('#optPlanFilter');
  if (plan) plan.addEventListener('change', () => { state.optPlanFilter = plan.value; renderOptItems(); });
  const unapp = $('#optUnappliedOnly');
  if (unapp) unapp.addEventListener('change', () => { state.optUnappliedOnly = unapp.checked; renderOptItems(); });
  const sort = $('#optSort');
  if (sort) sort.addEventListener('change', () => { state.optSort = sort.value; renderOptItems(); });
  const selAll = $('#optSelectAllBtn');
  if (selAll) {
    selAll.addEventListener('click', () => {
      getFilteredOptItems().forEach((i) => state.optSelected.add(i.id));
      state.optActiveProfile = null;
      renderOptItems();
    });
  }
  const clear = $('#optClearBtn');
  if (clear) {
    clear.addEventListener('click', () => {
      state.optSelected.clear();
      state.optActiveProfile = null;
      const diff = $('#profileDiff');
      if (diff) diff.classList.add('hidden');
      renderProfiles();
      renderOptItems();
    });
  }
}

function confirmApplyDialog(chosen, rp) {
  return new Promise((resolve) => {
    const dlg = $('#confirmDialog');
    const body = $('#confirmBody');
    if (!dlg || !body) {
      resolve(window.confirm('Aplicar as otimizações selecionadas?'));
      return;
    }
    const high = chosen.filter((i) => i.risk === 'high' || i.confirm);
    const rest = chosen.filter((i) => i.risk !== 'high' && !i.confirm);
    body.innerHTML = `
      <p>Aplicar <b>${chosen.length}</b> otimização(ões)? Ponto de restauração: <b>${rp ? 'sim' : 'não'}</b>.</p>
      <p class="disclaimer">Um prompt de administrador (UAC) pode ser exibido para aplicar tudo de uma vez.</p>
      ${high.length ? `
        <div class="confirm-high">
          <h3>${appIcon('risk', { size: 16 })} Risco alto — confirmação explícita</h3>
          <ul class="confirm-list">${high.map((i) => `<li>${esc(i.name)} · ${esc(i.riskLabel || i.risk)}</li>`).join('')}</ul>
        </div>` : ''}
      ${rest.length ? `<ul class="confirm-list">${rest.map((i) => `<li>${esc(i.name)}</li>`).join('')}</ul>` : ''}
    `;
    dlg.classList.remove('hidden');
    const ok = $('#confirmOk');
    const cancel = $('#confirmCancel');
    const finish = (val) => {
      dlg.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (e) => { if (e.target === dlg) finish(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dlg.addEventListener('click', onBackdrop);
  });
}

function setApplyProgress(pct, label) {
  const wrap = $('#optProgress');
  const fill = $('#optProgressFill');
  const text = $('#optProgressLabel');
  if (wrap) wrap.classList.toggle('hidden', pct == null);
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct || 0))}%`;
  if (text) text.textContent = label || '';
}

function appendRunLog(status, name, message) {
  const box = $('#optRunLog');
  const list = $('#optRunLogList');
  if (!box || !list) return;
  box.classList.remove('hidden');
  const icon = status === 'ok' ? 'ok' : status === 'fail' ? 'fail' : 'skip';
  const li = document.createElement('li');
  li.className = status;
  li.innerHTML = `${appIcon(icon, { size: 14 })} <span>${esc(name)}${message ? ' — ' + esc(message) : ''}</span>`;
  list.appendChild(li);
}

if ($('#optApplyBtn')) {
  $('#optApplyBtn').addEventListener('click', async () => {
    const ids = [...state.optSelected];
    if (!ids.length) { toast('⚠ Selecione pelo menos uma otimização.'); return; }

    const chosen = state.optItems.filter((i) => ids.includes(i.id));
    const rp = $('#optRestorePoint').checked;
    const okConfirm = await confirmApplyDialog(chosen, rp);
    if (!okConfirm) return;

    const btn = $('#optApplyBtn');
    btn.disabled = true;
    const logList = $('#optRunLogList');
    if (logList) logList.innerHTML = '';
    if ($('#optRunLog')) $('#optRunLog').classList.remove('hidden');
    optApplying = true;
    optApplyDone = 0;
    optApplyTotal = chosen.length + (rp ? 1 : 0);
    setApplyProgress(2, 'Iniciando…');
    try {
      const res = await api().engineApply({
        ids,
        label: `${chosen.length} otimização(ões) manual(is)`,
        createRestorePoint: rp,
        profile: state.optActiveProfile
      });
      const results = res.results || [];
      const liveCount = logList ? logList.children.length : 0;
      results.forEach((r, i) => {
        const item = chosen[i];
        if (r.ok && item) state.optApplied.add(item.id);
        if (!liveCount) {
          const name = (item && item.name) || r.name || 'Item';
          appendRunLog(r.ok ? 'ok' : 'fail', name, r.message || (r.ok ? 'Aplicado' : 'Falha'));
        }
      });
      if (!liveCount && results.length < chosen.length) {
        chosen.slice(results.length).forEach((item) => appendRunLog('skip', item.name, 'Pulado'));
      }
      persistApplied();
      const okCount = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      setApplyProgress(100, 'Concluído');
      if (res.restorePoint && !res.restorePoint.ok) {
        toast(`ℹ ${esc(res.restorePoint.message)}`, 9000);
      }
      if (fail.length) {
        toast(`⚠ Concluído com avisos: ${okCount}/${results.length} OK.`, 12000);
      } else {
        toast(`✅ ${okCount} otimização(ões) aplicada(s) com sucesso.`, 10000);
      }
      state.optSelected.clear();
      renderOptItems();
    } catch (err) {
      toast(`❌ ${esc(err.message || err)}`, 9000);
    } finally {
      optApplying = false;
      btn.disabled = false;
      setTimeout(() => setApplyProgress(null), 2500);
    }
  });
}


// ================= MANUTENÇÃO =================
let maintLoaded = false;
async function initMaintenanceView() {
  if (maintLoaded) return;
  maintLoaded = true;
  try {
    const [targets, repairs] = await Promise.all([api().cleanerTargets(), api().repairOptions()]);
    state.cleanTargets = targets;
    renderCleanList();
    renderRepairs(repairs);
  } catch (err) {
    toast(`❌ Não foi possível carregar a manutenção: ${esc(err.message || err)}`);
  }
}

function renderCleanList() {
  $('#cleanList').innerHTML = state.cleanTargets.map((t) => `
    <label class="clean-row" data-id="${esc(t.id)}">
      <input type="checkbox" ${state.cleanSelected.has(t.id) ? 'checked' : ''}/>
      <div class="opt-body">
        <div class="opt-title">${esc(t.name)}
          ${t.requiresAdmin ? '<span class="badge neutral">ADMIN</span>' : ''}
        </div>
        <div class="opt-desc">${esc(t.description)}</div>
      </div>
      <span class="clean-size" id="size-${esc(t.id)}">— MB</span>
    </label>`).join('');
  $$('#cleanList input').forEach((chk) => {
    chk.addEventListener('change', () => {
      const id = chk.closest('.clean-row').dataset.id;
      if (chk.checked) state.cleanSelected.add(id); else state.cleanSelected.delete(id);
      updateCleanTotal();
    });
  });
}

function updateCleanTotal() {
  const ids = [...state.cleanSelected];
  const total = ids.reduce((acc, id) => acc + (state.cleanSizes[id] || 0), 0);
  const label = total >= 1024 ? (total / 1024).toFixed(1) + ' GB' : Math.round(total) + ' MB';
  $('#cleanTotalSize').textContent = total > 0 && ids.length
    ? `~${label} liberáveis`
    : '';
}

$('#cleanMeasureBtn').addEventListener('click', async () => {
  const btn = $('#cleanMeasureBtn');
  btn.disabled = true;
  btn.textContent = 'MEDINDO…';
  try {
    state.cleanSizes = await api().cleanerMeasure(state.cleanTargets.map((t) => t.id));
    for (const t of state.cleanTargets) {
      const v = state.cleanSizes[t.id];
      const el = $(`#size-${t.id}`);
      if (el) el.textContent = v == null ? '— MB' : v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`;
    }
    updateCleanTotal();
    toast('📏 Tamanhos medidos. Marque o que deseja limpar.');
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'MEDIR TAMANHOS';
  }
});

$('#cleanSelectAllBtn').addEventListener('click', () => {
  const allChecked = state.cleanSelected.size === state.cleanTargets.length;
  state.cleanSelected = allChecked ? new Set() : new Set(state.cleanTargets.map((t) => t.id));
  $$('#cleanList input').forEach((c) => { c.checked = !allChecked; });
  updateCleanTotal();
});

$('#cleanBtn').addEventListener('click', async () => {
  const ids = [...state.cleanSelected];
  if (!ids.length) { toast('⚠ Marque pelo menos um item para limpar.'); return; }
  if (!confirm(`Limpar ${ids.length} destino(s)?\n\nEsta ação não pode ser desfeita (arquivos apagados definitivamente).`)) return;
  const btn = $('#cleanBtn');
  btn.disabled = true;
  btn.textContent = 'LIMPANDO…';
  try {
    const res = await api().cleanerClean(ids);
    const ok = res.results.filter((r) => r.ok).length;
    toast(res.results.length && ok === res.results.length
      ? '🧹 Limpeza concluída!'
      : `⚠ Limpeza concluída com avisos (${ok}/${res.results.length}).`, 8000);
    setTimeout(() => $('#cleanMeasureBtn').click(), 1500);
  } catch (err) {
    toast(`❌ ${esc(err.message || err)}`, 9000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'LIMPAR SELECIONADAS';
  }
});

function renderRepairs(repairs) {
  $('#repairList').innerHTML = repairs.map((r) => `
    <div class="repair-card" data-id="${esc(r.id)}">
      <h4>${esc(r.name)}</h4>
      <p>${esc(r.description)}</p>
      <div class="badges">
        ${r.requiresAdmin ? '<span class="badge neutral">ADMIN</span>' : ''}
        <span class="badge neutral">~${r.estimatedMinutes} min</span>
      </div>
      <button class="btn btn-outline repair-run">EXECUTAR</button>
    </div>`).join('') + `
    <div class="repair-card legacy">
      <h4>Correção rápida (legado)</h4>
      <p>Executa o script clássico "Arrumar Windows" (chkdsk, SFC e DISM em sequência).</p>
      <button class="btn btn-outline" id="quickFixBtn">EXECUTAR CORREÇÃO RÁPIDA</button>
    </div>`;

  $$('.repair-run').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.repair-card');
      const rep = repairs.find((x) => x.id === card.dataset.id);
      if (!rep) return;
      if (!confirm(`Executar "${rep.name}"?\n\nPode levar ~${rep.estimatedMinutes} minutos. O PC continua utilizável, mas fique sem fazer tarefas pesadas.`)) return;
      btn.disabled = true; btn.textContent = 'EXECUTANDO…';
      try {
        const res = await api().repairRun(rep.id);
        toast(res.ok ? '🔧 Reparo concluído! Reinicie o PC se algum problema persistia.' : '⚠ Reparo finalizado com avisos — veja os detalhes no toast anterior.', 10000);
      } catch (err) {
        toast(`❌ ${esc(err.message || err)}`, 9000);
      } finally {
        btn.disabled = false; btn.textContent = 'EXECUTAR';
      }
    });
  });

  const qf = $('#quickFixBtn');
  if (qf) qf.addEventListener('click', async () => {
    if (!confirm('Executar a correção rápida legada? (pode levar vários minutos)')) return;
    qf.disabled = true; qf.textContent = 'EXECUTANDO…';
    try {
      const res = await api().repairQuickFix();
      toast(res.ok ? '🔧 Correção concluída!' : '⚠ Correção finalizada com avisos.', 8000);
    } catch (err) {
      toast(`❌ ${esc(err.message || err)}`, 9000);
    } finally {
      qf.disabled = false; qf.textContent = 'EXECUTAR CORREÇÃO RÁPIDA';
    }
  });
}

// ================= RESTAURAÇÃO =================
async function renderOperations() {
  let ops = [];
  try { ops = await api().engineListOperations(); } catch (_) { /* ignora */ }
  const tbody = $('#operationsTable tbody');
  tbody.innerHTML = ops.length ? ops.map((op) => `
    <tr data-op="${esc(op.id)}">
      <td>${new Date(op.ts).toLocaleString('pt-BR')}</td>
      <td>${esc(op.label)}${op.profile ? ` <span class="badge neutral">${esc(op.profile)}</span>` : ''}</td>
      <td>${op.itemCount}</td>
      <td style="color:${op.successCount === op.itemCount ? 'var(--green)' : 'var(--yellow)'}">${op.successCount}/${op.itemCount}</td>
      <td>
        <button class="btn btn-outline op-details">DETALHES</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--dim)">Nenhuma operação registrada ainda.</td></tr>';

  $$('.op-details').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const opId = btn.closest('tr').dataset.op;
      const op = await api().engineGetOperation(opId);
      if (!op) { toast('❌ Operação não encontrada.'); return; }
      openOperationDetails(op);
    });
  });
}

function openOperationDetails(op) {
  $('#modalBody').innerHTML = `
    <h2>Operação de ${new Date(op.ts).toLocaleString('pt-BR')}</h2>
    <p><b>${esc(op.label)}</b> — ${(op.results || []).filter((r) => r.ok).length}/${(op.results || []).length} passos OK.</p>
    <ul class="paths">
      ${(op.items || []).map((it) => `
        <li style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>${esc(it.name)} ${it.hasBackup ? '<small style="color:var(--dim)">(backup ✓)</small>' : ''}</span>
          ${it.hasBackup ? `<button class="btn btn-outline undo-one" data-id="${esc(it.id)}" style="padding:2px 10px;font-size:11px">DESFAZER</button>` : ''}
        </li>`).join('')}
    </ul>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn btn-primary" id="undoOpBtn">DESFAZER OPERAÇÃO COMPLETA</button>
      <button class="btn btn-outline" data-action="close-modal">FECHAR</button>
    </div>
    <p class="foot-disclaimer">Desfazer restaura as chaves do registro salvas antes da aplicação e executa as ações de reversão de cada item. Alguns itens (limpezas) não podem ser revertidos.</p>`;

  $$('#modalBody .undo-one').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '…';
      try {
        const r = await api().engineUndoItem(btn.dataset.id);
        toast(r.ok ? `↩️ ${esc(r.message)}` : `⚠ ${esc(r.message)}`, 7000);
        btn.textContent = r.ok ? 'REVERTIDO' : 'FALHOU';
      } catch (err) {
        toast(`❌ ${esc(err.message || err)}`);
        btn.textContent = 'DESFAZER';
      }
    });
  });

  $$('#modalBody [data-action="close-modal"]').forEach((btn) => {
    btn.addEventListener('click', () => $('#modalClose').click());
  });

  const fullBtn = $('#undoOpBtn');
  fullBtn.addEventListener('click', async () => {
    if (!confirm('Desfazer TODOS os itens reversíveis desta operação?')) return;
    fullBtn.disabled = true; fullBtn.textContent = 'DESFAZENDO…';
    try {
      const r = await api().engineUndoOperation(op.id);
      toast(r.ok ? '↩️ Operação revertida por completo.' : '⚠ Reversão concluída com avisos.', 9000);
      fullBtn.textContent = 'CONCLUÍDO';
      renderOperations();
    } catch (err) {
      toast(`❌ ${esc(err.message || err)}`, 9000);
      fullBtn.textContent = 'DESFAZER OPERAÇÃO COMPLETA';
    }
  });

  $('#modal').classList.remove('hidden');
}

// Passos do motor chegam como progresso na ActionBar (ou toast fora da tela).
api().onEngineStep((step) => {
  if (!step || !step.name) return;
  if (optApplying) {
    optApplyDone += 1;
    const total = Math.max(optApplyTotal, optApplyDone);
    const pct = Math.min(100, Math.round((optApplyDone / total) * 100));
    setApplyProgress(pct, step.name);
    appendRunLog(step.ok ? 'ok' : 'fail', step.name, step.message || '');
    return;
  }
  toast(`${step.ok ? '✅' : '❌'} ${esc(step.name)}`, 3500);
});

// ================= MONITOR EM TEMPO REAL =================
const MONITOR_DEFS = [
  { key: 'cpu', title: 'CPU', unit: '%', color: 'var(--red)' },
  { key: 'gpu', title: 'GPU', unit: '%', color: 'var(--orange)' },
  { key: 'ram', title: 'RAM', unit: '%', color: 'var(--yellow)' },
  { key: 'disk', title: 'DISCO', unit: '%', color: 'var(--green)' },
  { key: 'net', title: 'REDE', unit: '', color: '#7dd3fc' },
  { key: 'temp', title: 'TEMPERATURA', unit: '°C', color: 'var(--red-bright)' }
];

const monitor = {
  timer: null,
  paused: false,
  history: {},
  snapshotCount: 0
};

function monValueColor(pct) {
  return pct >= 90 ? 'var(--red-bright)' : pct >= 70 ? 'var(--yellow)' : pct >= 0 ? 'var(--green)' : 'var(--dim)';
}

function buildMonitorCards() {
  $('#monitorCards').innerHTML = MONITOR_DEFS.map((d) => `
    <div class="mon-card" id="mon-${d.key}">
      <div class="mon-head">
        <span class="mon-title">${d.title}</span>
        <span class="mon-value" id="monv-${d.key}"><i>—</i></span>
      </div>
      <div class="mon-bar" id="monb-${d.key}" ${['net', 'temp'].includes(d.key) ? 'style="display:none"' : ''}>
        <span id="monf-${d.key}"></span>
      </div>
      <div class="sparkline" id="mons-${d.key}"></div>
      <div class="mon-sub" id="monx-${d.key}"></div>
    </div>`).join('');
}

async function pollMonitor() {
  if (monitor.paused || !$('#view-monitor').classList.contains('active')) return;
  let snap;
  try { snap = await api().monitorSnapshot(); } catch (_) { return; }
  if (!snap) return;
  monitor.snapshotCount++;

  const push = (k, v) => {
    const h = (monitor.history[k] = monitor.history[k] || []);
    h.push(v);
    if (h.length > 40) h.shift();
    return v;
  };

  const setCard = (key, display, pct, subHtml) => {
    const valEl = $(`#monv-${key}`);
    const fill = $(`#monf-${key}`);
    if (!valEl) return;
    if (display === null || display === undefined) {
      valEl.innerHTML = '<i>indisponível</i>';
      valEl.classList.add('na');
      if (fill) fill.style.width = '0%';
    } else {
      valEl.textContent = display;
      valEl.classList.remove('na');
      if (fill) {
        fill.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`;
        fill.style.background = monValueColor(pct ?? -1);
      }
    }
    const spark = $(`#mons-${key}`);
    if (spark) {
      const hist = monitor.history[key].filter((x) => x !== null);
      spark.innerHTML = hist.length
        ? hist.slice(-30).map((v) => `<span style="height:${Math.max(4, Math.min(100, v))}%"></span>`).join('')
        : '';
    }
    const sub = $(`#monx-${key}`);
    if (sub && subHtml !== undefined) sub.innerHTML = subHtml;
  };

  setCard('cpu', snap.cpu != null ? `${snap.cpu}%` : null, snap.cpu,
    `Processos ativos: <b>${snap.processCount ?? '—'}</b>`);

  const gpuOk = snap.gpu && snap.gpu.percent != null;
  setCard('gpu', gpuOk ? `${snap.gpu.percent}%` : (snap.gpu ? 'sem sensor' : 'NVIDIA não detectada'), gpuOk ? snap.gpu.percent : null,
    gpuOk
      ? `VRAM: <b>${snap.gpu.vramUsedMB ?? '?'} / ${snap.gpu.vramTotalMB ?? '?'} MB</b>${snap.gpu.clockMhz ? ` · ${snap.gpu.clockMhz} MHz` : ''}`
      : 'Uso de GPU exposto apenas por drivers dedicados (nvidia-smi).');

  setCard('ram', snap.ramPercent != null ? `${snap.ramPercent}%` : null, snap.ramPercent,
    `Em uso: <b>${snap.ramUsedMB != null ? (snap.ramUsedMB / 1024).toFixed(1) + ' GB' : '—'}</b> de ${snap.ramTotalMB != null ? (snap.ramTotalMB / 1024).toFixed(1) + ' GB' : '—'}`);

  setCard('disk', snap.diskPercent != null ? `${snap.diskPercent}%` : null, snap.diskPercent,
    'Atividade total dos discos físicos.');

  push('cpu', snap.cpu);
  push('gpu', gpuOk ? snap.gpu.percent : null);
  push('ram', snap.ramPercent);
  push('disk', snap.diskPercent);
  push('temp', snap.tempC);

  const rx = snap.netRxKbps, tx = snap.netTxKbps;
  push('net', rx != null ? rx + tx : null);
  const netVal = $(`#monv-net`);
  if (netVal) {
    if (rx == null && tx == null) { netVal.innerHTML = '<i>indisponível</i>'; netVal.classList.add('na'); }
    else {
      netVal.classList.remove('na');
      netVal.innerHTML =
        `<span style="color:var(--green)">▼${fmtKbps(rx)}</span> ` +
        `<span style="color:var(--red-bright);margin-left:10px">▲${fmtKbps(tx)}</span>`;
    }
  }

  setCard('temp', snap.tempC != null ? `${snap.tempC}°C` : null, snap.tempC != null ? snap.tempC : null,
    snap.tempC == null
      ? 'Sensor térmico não exposto pelo fabricante (ACPI).'
      : 'Zona térmica ACPI (valor máximo reportado).');
}

function fmtKbps(kbps) {
  if (kbps == null) return '—';
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${Math.round(kbps)} KB/s`;
}

async function startMonitor() {
  if (!$('#monitorCards').children.length) buildMonitorCards();
  $('#monitorPauseBtn').textContent = 'PAUSAR';
  monitor.paused = false;
  if (monitor.timer) clearInterval(monitor.timer);
  try {
    const s = await api().settingsGet();
    const ms = Math.max(1000, Number(s.monitoring.intervalSec || 2) * 1000);
    monitor.timer = setInterval(pollMonitor, ms);
  } catch (_) {
    monitor.timer = setInterval(pollMonitor, 2000);
  }
  pollMonitor();
}

function stopMonitor() {
  if (monitor.timer) { clearInterval(monitor.timer); monitor.timer = null; }
}

$('#monitorPauseBtn').addEventListener('click', () => {
  monitor.paused = !monitor.paused;
  $('#monitorPauseBtn').textContent = monitor.paused ? 'RETOMAR' : 'PAUSAR';
});

// ================= BENCHMARK =================
let benchLoaded = false;

async function initBenchmarkView() {
  await renderBenchTable();
}

async function renderBenchTable() {
  let list = [];
  try { list = await api().benchmarkList(); } catch (_) { /* ignora */ }
  list.reverse();
  $('#benchTable tbody').innerHTML = list.length
    ? list.map((b) => `
      <tr>
        <td>${new Date(b.date).toLocaleString('pt-BR')}</td>
        <td>${b.cpu ? `<b>${b.cpu.singleScore}</b> pts` : '—'}</td>
        <td>${b.cpu && b.cpu.multiScore ? `<b>${b.cpu.multiScore}</b> pts` : '—'}</td>
        <td>${b.cpu && b.cpu.speedup ? `×${b.cpu.speedup}` : '—'}</td>
        <td>${b.ram ? `<b>${b.ram.gbPerSec}</b> GB/s` : '—'}</td>
        <td>${b.disk ? `${b.disk.readMBps} MB/s` : '—'}</td>
        <td>${b.disk ? `${b.disk.writeMBps} MB/s` : '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--dim)">Nenhum benchmark executado ainda.</td></tr>';
}

$('#benchRunBtn').addEventListener('click', async () => {
  if (!confirm(
    'Executar o benchmark completo?\n\n' +
    '• CPU single/multi-thread (~15 s)\n• Banda de memória (~2 s)\n• Disco: grava e lê 512 MB temporários (~5–20 s)\n\n' +
    'Feche jogos e programas pesados para um resultado mais estável.')) return;
  const btn = $('#benchRunBtn');
  btn.disabled = true;
  $('#benchStatus').classList.remove('hidden');
  $('#benchStatusText').textContent = 'Medindo CPU, memória e disco… isso pode levar até 40 segundos.';
  try {
    const res = await api().benchmarkRun({});
    state.lastBench = res;
    renderBenchResult(res);
    await renderBenchTable();
    toast(`🏁 Benchmark concluído — CPU multi: <b>${res.cpu.multiScore}</b> pts · RAM: <b>${res.ram.gbPerSec} GB/s</b>`, 9000);
  } catch (err) {
    toast(`❌ Falha no benchmark: ${esc(err.message || err)}`, 9000);
  } finally {
    btn.disabled = false;
    $('#benchStatus').classList.add('hidden');
  }
});

function renderBenchResult(b) {
  const cmpNote = b.cpu.speedup
    ? `O ganho multi-thread medido foi de <b>×${b.cpu.speedup}</b> sobre single-thread.`
    : '';
  $('#benchResults').innerHTML = `
    <div class="compare-block">
      <h3 style="margin-bottom:12px;color:var(--red-bright)">RESULTADO MEDIDO (${new Date(b.date).toLocaleTimeString('pt-BR')})</h3>
      <table>
        <tr><th>Componente</th><th>Métrica</th><th>Valor medido</th></tr>
        <tr><td><b>CPU</b></td><td>Single-thread</td><td><b>${b.cpu.singleScore}</b> pts</td></tr>
        <tr><td></td><td>Multi-thread (${b.cpu.threads} threads)</td><td><b>${b.cpu.multiScore ?? '—'}</b> pts</td></tr>
        <tr><td></td><td>Escala multi/single</td><td>${b.cpu.speedup ? `×${b.cpu.speedup}` : '—'}</td></tr>
        <tr><td><b>RAM</b></td><td>Banda de cópia</td><td><b>${b.ram.gbPerSec}</b> GB/s</td></tr>
        <tr><td><b>Disco</b></td><td>Leitura sequencial</td><td><b>${b.disk.readMBps}</b> MB/s</td></tr>
        <tr><td></td><td>Gravação sequencial</td><td><b>${b.disk.writeMBps}</b> MB/s</td></tr>
      </table>
      <p style="color:var(--dim);font-size:12px;margin-top:8px">
        Valores medidos agora nesta máquina. Índices de CPU são internos deste aplicativo
        (comparáveis apenas entre execuções aqui) — ${cmpNote}
      </p>
    </div>`;
}

// ================= NETWORK OPTIMIZER =================
let netLoaded = false;

async function initNetworkView() {
  if (!netLoaded) {
    netLoaded = true;
    renderNetworkOpts();
  }
  try {
    const info = await api().networkInfo();
    renderAdapters(info);
  } catch (err) {
    toast(`❌ Não foi possível ler os adaptadores: ${esc(err.message || err)}`);
  }
}

function renderAdapters(info) {
  const cards = (info.adapters || []).map((a) => `
    <div class="hw-card full">
      <h3>${esc(a.name)}<em>${esc(a.type || '')}</em></h3>
      ${kv('Descrição', dash(a.description))}
      ${kv('IP (IPv4)', dash(a.ip))}
      ${kv('Velocidade do enlace', a.speedMbps ? `${a.speedMbps} Mbps` : dash(null))}
      ${kv('MAC', dash(a.mac), true)}
    </div>`).join('');
  const dns = info.dnsServers || [];
  $('#netAdapterCards').innerHTML = (cards ||
    '<p class="empty-note">Nenhum adaptador ativo encontrado.</p>') +
    (dns.length ? `<div class="hw-card full"><h3>SERVIDORES DNS EM USO<em>configuração atual</em></h3>${dns.map((d) => kv('', `<span style="font-family:Consolas,monospace">${esc(d)}</span>`)).join('')}</div>` : '');
}

function netMetricRow(k, v) {
  return `<div class="net-metric-row"><span class="k">${esc(k)}</span><span>${v}</span></div>`;
}

$('#netPingBtn').addEventListener('click', async () => {
  const btn = $('#netPingBtn');
  btn.disabled = true;
  btn.textContent = 'MEDINDO…';
  try {
    const r = await api().networkPingTest({ host: '1.1.1.1', count: 10 });
    if (!r.ok) throw new Error(r.error || 'Falha no teste.');
    const lossCls = r.lossPercent === 0 ? 'var(--green)' : r.lossPercent <= 5 ? 'var(--yellow)' : 'var(--red-bright)';
    const latCls = r.avgMs <= 30 ? 'var(--green)' : r.avgMs <= 80 ? 'var(--yellow)' : 'var(--red-bright)';
    $('#netPingResult').innerHTML = `
      <div class="net-result">
        <h4>Ping test — ${esc(r.host)} · 10 pacotes ICMP reais</h4>
        ${netMetricRow('Latência média', `<b style="color:${latCls}">${r.avgMs ?? '—'} ms</b>`)}
        ${netMetricRow('Mínima / máxima', `${r.minMs ?? '—'} ms / ${r.maxMs ?? '—'} ms`)}
        ${netMetricRow('Jitter (variação)', r.jitterMs != null ? `<b>${r.jitterMs} ms</b>` : '—')}
        ${netMetricRow('Pacotes perdidos', `<b style="color:${lossCls}">${r.lossPercent}%</b> (${r.received}/${r.sent} recebidos)`)}
      </div>`;
  } catch (err) {
    toast(`❌ Ping test falhou: ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'PING TEST';
  }
});

$('#netDnsBtn').addEventListener('click', async () => {
  const btn = $('#netDnsBtn');
  btn.disabled = true;
  btn.textContent = 'TESTANDO…';
  try {
    const r = await api().networkDnsTest('google.com');
    $('#netDnsResult').innerHTML = `
      <div class="net-result">
        <h4>DNS test — resolução de ${esc(r.domain)}</h4>
        ${r.results.map((x) => netMetricRow(x.server,
          x.ok && x.ms != null
            ? `<b style="color:${x.ms <= 50 ? 'var(--green)' : x.ms <= 150 ? 'var(--yellow)' : 'var(--red-bright)'}">${x.ms} ms</b>`
            : '<i style="color:var(--dim)">falhou</i>')).join('')}
        <p class="empty-note">Tempos medidos localmente nesta máquina — variam conforme sua conexão.</p>
      </div>`;
  } catch (err) {
    toast(`❌ DNS test falhou: ${esc(err.message || err)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'DNS TEST';
  }
});

async function renderNetworkOpts() {
  try {
    const items = (await api().engineListItems()).filter((i) => i.category === 'rede');
    $('#netOptList').innerHTML = items.length
      ? items.map((it) => `
        <div class="opt-item">
          <div class="opt-icon-chip">${appIcon(it.icon || 'network', { size: 18 })}</div>
          <div class="opt-body">
            <div class="opt-item-head">
              <h3>${esc(it.name)}</h3>
              ${it.proOnly ? `<span class="badge pro">${appIcon('pro', { size: 12 })} PRO</span>` : '<span class="badge free">GRÁTIS</span>'}
            </div>
            <div class="opt-desc">${esc(it.description)}</div>
            <div class="badges">${riskBadge(it.risk)}</div>
          </div>
          <button type="button" class="btn btn-outline net-apply" data-id="${esc(it.id)}">${appIcon('run', { size: 14 })} APLICAR</button>
        </div>`).join('')
      : '<p class="empty-note">Nenhuma otimização de rede catalogada.</p>';

    $$('.net-apply').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        if ((item.confirm || item.risk === 'high') &&
          !(await confirmApplyDialog([item], false))) return;
        btn.disabled = true;
        btn.innerHTML = `${appIcon('loading', { size: 14, className: 'animate-spin text-muted-foreground' })} APLICANDO…`;
        try {
          const res = await api().engineApply({ ids: [item.id], label: `Rede: ${item.name}` });
          const ok = res.results[0] && res.results[0].ok;
          toast(ok ? `✅ ${esc(item.name)} aplicada.` : `⚠ ${esc(res.results[0] && res.results[0].message || 'Falha ao aplicar.')}`, 8000);
        } catch (err) {
          toast(`❌ ${esc(err.message || err)}`, 9000);
        } finally {
          btn.disabled = false;
          btn.innerHTML = `${appIcon('run', { size: 14 })} APLICAR`;
        }
      });
    });
  } catch (err) {
    $('#netOptList').innerHTML = `<p class="empty-note">Catálogo indisponível: ${esc(err.message || err)}</p>`;
  }
}

// ================= STARTUP MANAGER =================
const IMPACT_COLOR = {
  Alto: 'var(--red-bright)',
  Médio: 'var(--yellow)',
  Baixo: 'var(--green)',
  Protegido: 'var(--dim)',
  Desconhecido: 'var(--dim)'
};

async function refreshStartupList() {
  const tbody = $('#startupTable tbody');
  let entries = [];
  try { entries = await api().startupList(); } catch (_) { /* ignora */ }
  tbody.innerHTML = entries.length
    ? entries.map((s) => `
      <tr data-name="${esc(s.name)}">
        <td><b>${esc(s.name)}</b>${s.protected ? ' <span class="badge neutral">PROTEGIDO</span>' : ''}</td>
        <td>${esc(s.source)}</td>
        <td>${esc(s.scope)}</td>
        <td style="color:${IMPACT_COLOR[s.impact] || 'inherit'}">${esc(s.impact)}${['Alto', 'Médio'].includes(s.impact) ? ' <small style="color:var(--dim)">(estimativa)</small>' : ''}</td>
        <td title="${esc(s.command)}" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim);font-size:11.5px">${esc(short(s.command, 60))}</td>
        <td>
          <label class="switch" title="${s.protected ? 'Item essencial — não pode ser desativado' : 'Ativa/desativa sem apagar a entrada'}">
            <input type="checkbox" class="su-toggle" data-id="${esc(s.id)}" ${s.enabled ? 'checked' : ''} ${s.protected ? 'disabled' : ''}/>
            <span class="slider"></span>
            <span class="switch-label">${s.enabled ? 'Ativo' : 'Desativado'}</span>
          </label>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--dim)">Nenhum programa de inicialização detectado.</td></tr>';

  $$('.su-toggle').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const tr = chk.closest('tr');
      const entry = entries.find((x) => x.id === chk.dataset.id);
      if (!entry) return;
      const enable = chk.checked;
      try {
        await api().startupSetEnabled({ entry, enabled: enable });
        tr.querySelector('.switch-label').textContent = enable ? 'Ativo' : 'Desativado';
        toast(enable ? `✅ <b>${esc(entry.name)}</b> voltará a iniciar com o Windows.` : `⛔ <b>${esc(entry.name)}</b> não iniciará mais com o Windows.`);
      } catch (err) {
        chk.checked = !enable;
        toast(`❌ ${esc(err.message || err)}`, 8000);
      }
    });
  });
}

$('#startupRefreshBtn').addEventListener('click', refreshStartupList);

// ================= PROCESS MANAGER =================
let procEntries = [];

async function refreshProcessList() {
  const filter = ($('#procSearch') && $('#procSearch').value || '').toLowerCase();
  try { procEntries = await api().processList(); } catch (_) { procEntries = []; }
  const tbody = $('#processTable tbody');
  const list = procEntries.filter((p) =>
    !filter || p.name.toLowerCase().includes(filter) || String(p.id).includes(filter));
  tbody.innerHTML = list.length
    ? list.slice(0, 300).map((p) => `
      <tr data-pid="${p.id}" data-name="${esc(p.name)}">
        <td><b>${esc(p.name)}</b>${p.critical ? ' <span class="badge neutral">SISTEMA</span>' : ''}${p.windowed ? ' <span class="badge free">JANELA</span>' : ''}</td>
        <td>${p.id}</td>
        <td title="${esc(p.company)}">${esc(short(p.company, 24) || '—')}</td>
        <td>${p.cpuSec.toLocaleString('pt-BR')}</td>
        <td>${p.memMB} MB</td>
        <td>
          ${p.critical ? esc(p.priorityLabel) : `
          <select class="prio-select" data-id="${p.id}" data-name="${esc(p.name)}">
            ${[['Idle', 'Baixa'], ['BelowNormal', 'Abaixo normal'], ['Normal', 'Normal'], ['AboveNormal', 'Acima normal'], ['High', 'Alta']]
              .map(([v, lbl]) => `<option value="${v}" ${p.priority === v ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>`}
        </td>
        <td>
          <div class="table-actions">
            ${p.path ? `<button class="btn btn-outline proc-open" data-path="${esc(p.path)}" style="padding:3px 9px;font-size:10.5px">LOCAL</button>` : ''}
            ${p.critical ? '' : `<button class="btn btn-outline proc-kill" data-id="${p.id}" data-name="${esc(p.name)}" style="padding:3px 9px;font-size:10.5px;border-color:rgba(255,92,95,.45);color:var(--red-bright)">ENCERRAR</button>`}
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--dim)">Nenhum processo corresponde ao filtro.</td></tr>';

  $$('.proc-kill').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (!confirm(`Encerrar "${name}"?\n\nDados não salvos nesse programa serão perdidos.`)) return;
      btn.disabled = true;
      try {
        await api().processKill({ pid: Number(btn.dataset.id), name });
        setTimeout(refreshProcessList, 400);
      } catch (err) {
        toast(`❌ ${esc(err.message || err)}`, 8000);
        btn.disabled = false;
      }
    });
  });

  $$('.proc-open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dir = btn.dataset.path.replace(/[\\/][^\\/]+$/, '');
      try { await api().openPath(dir); } catch (_) { /* ignora */ }
    });
  });

  $$('.prio-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const level = sel.value;
      const pid = Number(sel.dataset.id);
      const name = sel.dataset.name;
      const original = sel.dataset.original;
      try {
        await api().processSetPriority({ pid, name, level });
        toast(`✅ Prioridade de <b>${esc(name)}</b> alterada para ${level}.`);
      } catch (err) {
        toast(`❌ ${esc(err.message || err)}`, 8000);
        if (original !== undefined) sel.value = original;
        setTimeout(refreshProcessList, 600);
      }
    });
    sel.dataset.original = sel.value;
  });
}

$('#procRefreshBtn').addEventListener('click', refreshProcessList);
if ($('#procSearch')) {
  $('#procSearch').addEventListener('input', () => {
    clearTimeout(window.__procDebounce);
    window.__procDebounce = setTimeout(refreshProcessList, 350);
  });
}

// ================= CONFIGURAÇÕES =================
let settingsLoadedOnce = false;

async function initSettingsView() {
  let s;
  try { s = await api().settingsGet(); } catch (_) { s = null; }
  if (s) {
    $('#setStartWin').checked = !!s.general.startWithWindows;
    $('#setTray').checked = !!s.general.minimizeToTray;
    $('#setNotif').checked = !!s.general.notifications;
    $('#setRestorePoint').checked = !!s.optimization.createRestorePoint;
    $('#setConfirm').checked = !!s.optimization.confirmChanges;
    $('#setDefaultProfile').value = s.optimization.defaultProfile || 'balanced';
    $('#setInterval').value = String(s.monitoring.intervalSec || 2);
    $('#setAutoUpdate').checked = !!s.updates.autoCheck;
  }
  if (!settingsLoadedOnce) {
    settingsLoadedOnce = true;
    bindSetting('#setStartWin', 'general.startWithWindows');
    bindSetting('#setTray', 'general.minimizeToTray');
    bindSetting('#setNotif', 'general.notifications');
    bindSetting('#setRestorePoint', 'optimization.createRestorePoint');
    bindSetting('#setConfirm', 'optimization.confirmChanges');
    bindSelect('#setDefaultProfile', 'optimization.defaultProfile');
    bindNumberSelect('#setInterval', 'monitoring.intervalSec');
    bindSetting('#setAutoUpdate', 'updates.autoCheck');

    $('#checkUpdateBtn').addEventListener('click', checkUpdatesManual);
  }
  loadLicenseInfoSettings();
}

function bindSetting(sel, path) {
  $(sel).addEventListener('change', async (e) => {
    const keys = path.split('.');
    await saveSetting({ [keys[0]]: { [keys[1]]: e.target.checked } });
  });
}
function bindSelect(sel, path) {
  $(sel).addEventListener('change', async (e) => {
    const keys = path.split('.');
    await saveSetting({ [keys[0]]: { [keys[1]]: e.target.value } });
  });
}
function bindNumberSelect(sel, path) {
  $(sel).addEventListener('change', async (e) => {
    const keys = path.split('.');
    await saveSetting({ [keys[0]]: { [keys[1]]: Number(e.target.value) } });
  });
}

async function saveSetting(patch) {
  try {
    await api().settingsSet(patch);
    toast('⚙️ Configuração salva.');
  } catch (err) {
    toast(`❌ Não foi possível salvar: ${esc(err.message || err)}`);
  }
}

async function loadLicenseInfoSettings() {
  let st;
  try { st = await api().licenseGetState(); } catch (_) { st = null; }
  const el = $('#settingsLicenseInfo');
  if (!el) return;
  if (st && st.active) {
    el.innerHTML =
      kv('Situação', `<b style="color:var(--green)">ATIVA</b>`) +
      kv('Plano', esc((st.plan || '—').toUpperCase())) +
      kv('Chave', `<span style="font-family:Consolas,monospace">${esc(st.key || '—')}</span>`) +
      kv('Válida até', st.expiresAt ? new Date(st.expiresAt).toLocaleDateString('pt-BR') : 'Nunca (vitalícia)') +
      (st.authorizedVersion ? kv('Versão autorizada', 'v' + esc(st.authorizedVersion)) : '') +
      kv('Dispositivo registrado', st.deviceName || 'Este computador');
  } else if (st && st.key) {
    el.innerHTML =
      kv('Situação', '<b style="color:var(--red-bright)">INATIVA</b>') +
      kv('Chave', `<span style="font-family:Consolas,monospace">${esc(st.key)}</span>`);
  } else {
    el.innerHTML = kv('Situação', '<i>Nenhuma licença ativada neste computador.</i>');
  }
}

async function checkUpdatesManual() {
  const msg = $('#updateCheckMsg');
  const panel = $('#updatePanel');
  const progressPanel = $('#updateProgressPanel');
  const installingPanel = $('#updateInstallingPanel');

  msg.textContent = 'Consultando servidor...';
  msg.style.color = 'var(--text-dim)';
  panel.classList.add('hidden');
  progressPanel.classList.add('hidden');
  installingPanel.classList.add('hidden');

  try {
    const res = await api().updateCheck();
    if (res.available && res.requiresPurchase) {
      const u = res.update;
      const price = u.price != null ? `R$ ${Number(u.price).toFixed(0)}` : 'R$ 15';
      msg.innerHTML = `Atualização <b>v${esc(u.version)}</b> disponível para licença vitalícia (${esc(price)}). Compre o pacote na sua conta da loja.`;
      msg.style.color = 'var(--yellow)';
      panel.classList.add('hidden');
      toast(
        `<b>ATUALIZAÇÃO DISPONÍVEL</b><br>v${esc(u.version)} · ${esc(price)}<br>` +
        `Licença vitalícia: compre o pacote de atualização na Orion Store.`,
        12000
      );
    } else if (res.available) {
      const u = res.update;
      msg.innerHTML = `Nova versão disponível: <b style="color:var(--green)">v${esc(u.version)}</b>`;
      msg.style.color = 'var(--green)';

      // Mostra o painel de atualização
      $('#updateCurrentVer').textContent = res.currentVersion;
      $('#updateNewVer').textContent = u.version;
      $('#updateChangelog').textContent = u.changelog || 'Sem changelog disponível.';
      $('#updateReleasedAt').textContent = u.releasedAt
        ? `Liberada em: ${new Date(u.releasedAt).toLocaleDateString('pt-BR')}`
        : '';
      panel.classList.remove('hidden');

      // Mostra toast também
      showUpdateToast(res);
    } else {
      msg.textContent = 'Você já está na versão mais recente.';
      msg.style.color = 'var(--green)';
      panel.classList.add('hidden');
    }
  } catch (err) {
    msg.textContent = `Não foi possível verificar agora (${esc(err.code || 'erro de rede')}).`;
    msg.style.color = 'var(--red-bright)';
    panel.classList.add('hidden');
  }
}

let pendingUpdateUrl = null;
let pendingUpdateVersion = null;

function showUpdateToast(res) {
  const u = res.update;
  if (res.requiresPurchase) {
    const price = u.price != null ? `R$ ${Number(u.price).toFixed(0)}` : 'R$ 15';
    toast(
      `<b>ATUALIZAÇÃO DISPONÍVEL</b><br>` +
      `Instalada: v${esc(res.currentVersion)} · Nova: <b>v${esc(u.version)}</b> · ${esc(price)}<br>` +
      `Licença vitalícia: compre o pacote na Orion Store.`,
      15000
    );
    return;
  }
  toast(
    `<b>NOVA ATUALIZAÇÃO DISPONÍVEL</b><br>` +
    `Instalada: v${esc(res.currentVersion)} · Nova: <b>v${esc(u.version)}</b><br>` +
    (u.changelog ? `<small style="color:var(--text-dim)">${esc(u.changelog)}</small><br>` : '') +
    `<a id="updateNowLink">ATUALIZAR AGORA</a> &nbsp;·&nbsp; <a id="updateLaterLink">MAIS TARDE</a>`,
    u.mandatory ? 30000 : 15000
  );
  setTimeout(() => {
    const now = $('#updateNowLink');
    const later = $('#updateLaterLink');
    if (now) now.addEventListener('click', (e) => {
      e.preventDefault();
      $('#toast').classList.add('hidden');
      startUpdateDownload(u.url, u.version);
    });
    if (later) later.addEventListener('click', (e) => {
      e.preventDefault();
      $('#toast').classList.add('hidden');
    });
  }, 0);
}

async function startUpdateDownload(url, version) {
  const panel = $('#updatePanel');
  const progressPanel = $('#updateProgressPanel');
  const installingPanel = $('#updateInstallingPanel');

  pendingUpdateUrl = url;
  pendingUpdateVersion = version;

  panel.classList.add('hidden');
  progressPanel.classList.remove('hidden');
  installingPanel.classList.add('hidden');

  $('#updateProgressLabel').textContent = 'Baixando atualização...';
  $('#updateProgressBar').style.width = '0%';
  $('#updateProgressPercent').textContent = '0%';
  $('#updateProgressSize').textContent = 'Iniciando...';

  try {
    const result = await api().updateDownload(url);
    if (result && result.ok) {
      // Download concluído — instala
      progressPanel.classList.add('hidden');
      installingPanel.classList.remove('hidden');
      $('#updateInstallingLabel').textContent = 'Instalando atualização...';

      try {
        await api().updateInstall(result.filePath);
        // Se chegou aqui, o app vai reiniciar
      } catch (installErr) {
        installingPanel.classList.add('hidden');
        toast(`❌ Erro na instalação: ${esc(installErr.message || installErr)}`);
      }
    }
  } catch (err) {
    progressPanel.classList.add('hidden');
    if (err.message && err.message.includes('cancel')) {
      toast('Download cancelado.');
    } else {
      toast(`❌ Falha ao baixar: ${esc(err.message || err)}`);
    }
  }
}

function bindUpdateButtons() {
  const downloadBtn = $('#updateDownloadBtn');
  const laterBtn = $('#updateLaterBtn');
  const cancelBtn = $('#updateCancelBtn');

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (pendingUpdateUrl) {
        startUpdateDownload(pendingUpdateUrl, pendingUpdateVersion);
      }
    });
  }

  if (laterBtn) {
    laterBtn.addEventListener('click', () => {
      $('#updatePanel').classList.add('hidden');
      $('#updateCheckMsg').textContent = '';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      api().updateCancel().catch(() => {});
      $('#updateProgressPanel').classList.add('hidden');
      toast('Download cancelado.');
    });
  }
}

// ================= SUPORTE =================
let appMeta = null;

async function initSupportView() {
  if (!appMeta) {
    try { appMeta = await api().getAppMeta(); } catch (_) { appMeta = null; }
  }
  const vi = $('#supportVersionInfo');
  if (vi) {
    vi.innerHTML =
      kv('Aplicativo', esc(appMeta ? appMeta.appName : 'ORION OPTIMIZER')) +
      kv('Versão instalada', appMeta ? `v${esc(appMeta.version)}` : '—') +
      kv('Modo de análise', 'Somente leitura (BIOS) · reversível (Windows)');
  }
  checkServiceHealth();
}

async function checkServiceHealth() {
  const el = $('#svcStatus');
  if (!el) return;
  el.innerHTML = '<span class="dot unknown"></span>Verificando…';
  try {
    const r = await api().appHealth();
    el.innerHTML = r.online
      ? '<span class="dot on"></span>Online'
      : '<span class="dot off"></span>Offline';
  } catch (_) {
    el.innerHTML = '<span class="dot off"></span>Offline';
  }
}

$('#svcRetryBtn').addEventListener('click', checkServiceHealth);

$('#contactSupportBtn').addEventListener('click', async () => {
  const url = appMeta && appMeta.officialUrl;
  if (!url) { toast('❌ URL de suporte ainda não configurada.'); return; }
  try { await api().openExternal(url); } catch (err) { toast(`❌ ${esc(err.message || err)}`); }
});

// ================= ATUALIZAÇÕES (notificação) =================
api().onUpdateAvailable((res) => {
  if (res && res.available) showUpdateToast(res);
});

// Progresso do download (em tempo real)
api().onDownloadProgress((progress) => {
  const bar = $('#updateProgressBar');
  const percent = $('#updateProgressPercent');
  const size = $('#updateProgressSize');
  const label = $('#updateProgressLabel');

  if (progress.percent >= 0) {
    bar.style.width = `${progress.percent}%`;
    percent.textContent = `${progress.percent}%`;
  }
  if (progress.total > 0) {
    const receivedMB = (progress.received / (1024 * 1024)).toFixed(1);
    const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
    size.textContent = `${receivedMB} MB / ${totalMB} MB`;
  }
  if (label) label.textContent = 'Baixando atualização...';
});

// Notificação de instalação em andamento
api().onInstalling((info) => {
  const label = $('#updateInstallingLabel');
  if (label) label.textContent = info.message || 'Instalando...';
});

// ---------------- Sidebar Version Display ----------------
async function updateSidebarVersion() {
  const versionEl = $('#sidebarVersion');
  if (!versionEl) return;
  try {
    const meta = await api().getAppMeta();
    if (meta && meta.version) {
      versionEl.textContent = `v${meta.version}`;
    }
  } catch (_) { /* silencioso */ }
}

// ---------------- Init ----------------
(async function init() {
  if (typeof hydrateIcons === 'function') hydrateIcons(document);
  initSidebarToggle();
  showView('home');

  updateSidebarVersion();
  bindUpdateButtons();

  // Mostra versão atual na seção de atualizações
  try {
    const meta = await api().getAppMeta();
    const verLabel = $('#currentVersionLabel');
    if (verLabel && meta && meta.version) {
      verLabel.textContent = `v${meta.version}`;
    }
  } catch (_) { /* silencioso */ }

  // Licença: bloqueia o app na tela de ativação quando não ativado.
  try {
    const st = await api().licenseGetState();
    applyLicenseState(st);
  } catch (_) {
    applyLicenseState({ active: false, reason: 'PRODUCT_NOT_ACTIVATED' });
  }
  // Revalida em segundo plano (renova tolerância offline).
  api().licenseRefresh().catch(() => {});
})();
