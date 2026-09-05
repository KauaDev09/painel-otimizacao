/* ============================================================
   ORION OPTIMIZER — helpers do frontend SaaS
   ============================================================ */

const API = {
  async get(path, auth = false) {
    return this._req('GET', path, null, auth);
  },
  async post(path, body, auth = false) {
    return this._req('POST', path, body, auth);
  },
  async _req(method, path, body, auth) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (auth && token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.ok && data.status) {
      const err = new Error(data.message || 'Erro na requisição');
      err.code = data.code;
      err.status = data.status;
      throw err;
    }
    return data;
  },
};

const TOKEN_KEY = 'orion_token';

function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }
function getToken() { return localStorage.getItem(TOKEN_KEY) || null; }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function isAuthed() { return !!getToken(); }

function decodeToken(token) {
  try {
    const parts = token.split('.');
    return JSON.parse(atob(parts[1]));
  } catch (e) { return null; }
}

/* ---------- Toast ---------- */
function toast(message, type = 'info') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

/* ---------- Reveal on scroll ---------- */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Formatação ---------- */
function brl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
}

const PUBLIC_INSTALLER = {
  version: '2.1.0',
  filename: 'ORION.OPTIMIZER.Setup-2.1.0.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.1.0/ORION.OPTIMIZER.Setup-2.1.0.exe',
  releaseNotes: 'Nova interface (React/shadcn), núcleo reativo Orion, predefinição Avançado com os 3 scripts Windows (Balanced, Full, Extreme) e endurecimento de segurança.',
  size: '~78 MB'
};

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

async function loadDownloadPanel(el) {
  if (!el) return;
  let download = null;
  try {
    const data = await API.get('/api/v1/public/download');
    download = data && data.download;
  } catch (_) { /* usa o instalador público */ }
  if (!download || !download.url) download = PUBLIC_INSTALLER;
  const notes = download.releaseNotes ? `<div class="changelog"><h4>Novidades</h4><pre>${escapeHtml(download.releaseNotes)}</pre></div>` : '';
  el.innerHTML = `
    <div class="ver">v${escapeHtml(download.version)}</div>
    <h3>ORION OPTIMIZER</h3>
    <p>Windows 10 / 11 · 64 bits</p>
    <p class="dl-free">Download grátis · chave de licença necessária</p>
    <div class="dl-meta">
      <div><div class="k">Versão</div><div class="v">${escapeHtml(download.version)}</div></div>
      <div><div class="k">Tamanho</div><div class="v">${escapeHtml(download.size || '~78 MB')}</div></div>
      <div><div class="k">Plataforma</div><div class="v">Windows</div></div>
    </div>
    <div class="dl-reqs">
      <h4>Requisitos mínimos</h4>
      <ul>
        <li>Windows 10 ou 11 (64 bits)</li>
        <li>2 GB de RAM livre</li>
        <li>150 MB de espaço em disco</li>
        <li>Internet necessária para ativar e validar a chave de licença</li>
      </ul>
    </div>
    <a class="btn btn-primary btn-lg" href="${escapeHtml(download.url)}" download>Baixar instalador</a>
    ${notes}`;
}

/* ---------- Navbar state ---------- */
function renderNav() {
  const menu = document.querySelector('[data-nav-menu]');
  const actions = document.querySelector('[data-nav-actions]');
  const navInner = document.querySelector('.nav-inner');
  if (!actions) return;

  if (isAuthed()) {
    actions.innerHTML = '<a href="/conta" class="btn btn-ghost">Minha conta</a><button class="btn" data-logout>Sair</button>';
    const logout = actions.querySelector('[data-logout]');
    if (logout) logout.addEventListener('click', () => { clearToken(); location.href = '/'; });
  } else {
    actions.innerHTML = '<a href="/login" class="btn btn-ghost">Entrar</a><a href="/planos" class="btn btn-primary">Comprar licença</a>';
  }

  if (menu) {
    menu.innerHTML =
      '<a href="/#produto">Produto</a>' +
      '<a href="/#recursos">Recursos</a>' +
      '<a href="/#como-funciona">Como funciona</a>' +
      '<a href="/planos">Planos</a>' +
      '<a href="/download">Download</a>';

    let toggle = navInner.querySelector('.nav-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'nav-toggle';
      toggle.setAttribute('aria-label', 'Menu');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span></span><span></span><span></span>';
      navInner.appendChild(toggle);
    }
    toggle.addEventListener('click', () => {
      const expanded = navInner.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', expanded);
    });
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navInner.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Navbar com superfície translúcida ao rolar
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', (window.scrollY || 0) > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}

document.addEventListener('DOMContentLoaded', renderNav);
