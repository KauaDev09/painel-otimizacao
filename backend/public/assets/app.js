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

/* ---------- Navbar state ---------- */
function renderNav() {
  const menu = document.querySelector('[data-nav-menu]');
  const actions = document.querySelector('[data-nav-actions]');
  const navInner = document.querySelector('.nav-inner');
  if (!actions) return;

  let toggle = navInner.querySelector('.nav-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    navInner.appendChild(toggle);
  }

  if (isAuthed()) {
    actions.innerHTML = '<a href="/conta" class="btn">Minha conta</a><button class="btn btn-ghost" data-logout>Sair</button>';
    const logout = actions.querySelector('[data-logout]');
    if (logout) logout.addEventListener('click', () => { clearToken(); location.href = '/'; });
  } else {
    actions.innerHTML = '<a href="/login" class="btn">Entrar</a><a href="/planos" class="btn btn-primary">Adquirir</a>';
  }
  if (menu) {
    menu.innerHTML =
      '<a href="/#recursos">Recursos</a>' +
      '<a href="/planos">Planos</a>' +
      '<a href="/#download">Download</a>' +
      '<a href="/suporte">Suporte</a>';
  }

  toggle.addEventListener('click', () => {
    const expanded = navInner.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', expanded);
  });

  if (menu) {
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navInner.classList.remove('nav-open'));
    });
  }
}

document.addEventListener('DOMContentLoaded', renderNav);
