import { useCallback, useEffect, useState } from 'react';
import './admin.css';
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  setAdminUnauthorizedHandler,
  adminCall,
} from './api';
import { Ico } from './icons';
import CouponsView from './views/CouponsView';
import DispositivosView from './views/DispositivosView';
import DownloadsView from './views/DownloadsView';
import HistoricoView from './views/HistoricoView';
import LicencasView from './views/LicencasView';
import LogsView from './views/LogsView';
import OrdersView from './views/OrdersView';
import PainelView from './views/PainelView';
import PaymentsView from './views/PaymentsView';
import PlansView from './views/PlansView';
import UpdatesView from './views/UpdatesView';
import UsuariosView from './views/UsuariosView';

export type AdminView =
  | 'painel'
  | 'licencas'
  | 'usuarios'
  | 'dispositivos'
  | 'historico'
  | 'updates'
  | 'plans'
  | 'orders'
  | 'payments'
  | 'downloads'
  | 'coupons'
  | 'logs';

const NAV: { id: AdminView; icon: string; label: string }[] = [
  { id: 'painel', icon: 'layout-dashboard', label: 'Painel' },
  { id: 'licencas', icon: 'key-round', label: 'Licenças' },
  { id: 'usuarios', icon: 'users', label: 'Usuários' },
  { id: 'dispositivos', icon: 'laptop', label: 'Dispositivos' },
  { id: 'historico', icon: 'line-chart', label: 'Histórico' },
  { id: 'updates', icon: 'refresh-cw', label: 'Atualizações' },
  { id: 'plans', icon: 'gem', label: 'Planos' },
  { id: 'orders', icon: 'receipt', label: 'Pedidos' },
  { id: 'payments', icon: 'credit-card', label: 'Pagamentos' },
  { id: 'downloads', icon: 'download', label: 'Downloads' },
  { id: 'coupons', icon: 'tag', label: 'Cupons' },
  { id: 'logs', icon: 'file-text', label: 'Logs' },
];

function applyTheme(mode: 'light' | 'dark') {
  document.body.classList.toggle('light-mode', mode === 'light');
  localStorage.setItem('orionAdminTheme', mode);
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(!!getAdminToken());
  const [view, setView] = useState<AdminView>('licencas');
  const [tokenInput, setTokenInput] = useState('');
  const [loginMsg, setLoginMsg] = useState('');
  const [loginErr, setLoginErr] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('orionAdminTheme') === 'light' ? 'light' : 'dark'),
  );

  const logout = useCallback(() => {
    clearAdminToken();
    setAuthed(false);
    setBooting(false);
    setView('licencas');
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('admin-mode');
    document.body.classList.add('admin-mode');
    applyTheme(theme);
    return () => {
      document.documentElement.classList.remove('admin-mode');
      document.body.classList.remove('admin-mode', 'light-mode');
    };
  }, [theme]);

  useEffect(() => {
    setAdminUnauthorizedHandler(logout);
    return () => setAdminUnauthorizedHandler(() => {});
  }, [logout]);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setBooting(false);
      return;
    }
    adminCall('/api/v1/admin/licenses')
      .then(() => setAuthed(true))
      .catch(() => {
        clearAdminToken();
        setAuthed(false);
      })
      .finally(() => setBooting(false));
  }, []);

  async function handleLogin() {
    setLoginMsg('');
    setLoginErr(false);
    const token = tokenInput.trim();
    if (!token) {
      setLoginMsg('Informe o token de acesso.');
      setLoginErr(true);
      return;
    }
    setAdminToken(token);
    try {
      await adminCall('/api/v1/admin/licenses');
      setAuthed(true);
      setLoginMsg('');
    } catch {
      setLoginMsg('Token inválido.');
      setLoginErr(true);
      clearAdminToken();
    }
  }

  function go(id: AdminView) {
    setView(id);
    if (window.innerWidth <= 860) setSidebarOpen(false);
  }

  function toggleSidebar() {
    if (window.innerWidth <= 860) setSidebarOpen((o) => !o);
    else setSidebarCollapsed((c) => !c);
  }

  if (booting) {
    return (
      <div className="admin-root" style={{ padding: 48, color: 'var(--text)' }}>
        Carregando painel…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-root">
        <div id="loginWrap">
          <div className="login-orb" />
          <div className="login-header">
            <div className="login-brand">
              <img
                src="/admin/logo.jpeg"
                alt="Orion"
                className="login-logo-icon"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="login-logo-text">
                ORION<span className="login-logo-sub">PAINEL ADMINISTRATIVO</span>
              </span>
            </div>
          </div>
          <div className="login-welcome">
            <h1>Painel Administrativo</h1>
            <p>Insira o token de acesso para continuar.</p>
          </div>
          <div className="card">
            <h2>Acessar painel</h2>
            <div className="login-field">
              <Ico name="key" />
              <input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLogin();
                }}
                autoComplete="off"
                placeholder="Token de acesso"
              />
            </div>
            <label>Token mestre</label>
            <div style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={() => void handleLogin()}>
                <Ico name="log-in" /> Entrar
              </button>
            </div>
            <div className={`msg${loginErr ? ' err' : ''}`}>{loginMsg}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-root">
      <div id="appWrap">
        <div className="app-shell">
          <aside
            className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}${sidebarOpen ? ' open' : ''}`}
            id="sidebar"
          >
            <div className="sidebar-brand">
              <img
                src="/admin/logo.jpeg"
                alt="Orion"
                className="sidebar-logo"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="sidebar-brand-text">
                <h1>ORION</h1>
                <p>OPTIMIZER</p>
              </div>
            </div>

            <div className="sidebar-nav">
              <p className="sidebar-nav-label">Menu</p>
              <nav id="nav">
                {NAV.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`tab${view === item.id ? ' active' : ''}`}
                    onClick={() => go(item.id)}
                  >
                    <span className="tab-ico">
                      <Ico name={item.icon} />
                    </span>
                    <span className="tab-label">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="sidebar-plan">
              <p className="sidebar-plan-label">Plano atual</p>
              <p className="sidebar-plan-name">Pro Anual</p>
              <p className="sidebar-plan-exp">Painel administrativo Orion</p>
              <button type="button" className="sidebar-plan-btn">
                Gerenciar plano
              </button>
            </div>

            <button type="button" className="sidebar-logout" onClick={logout}>
              <span className="tab-ico">
                <Ico name="log-out" />
              </span>
              <span>Sair</span>
            </button>
          </aside>

          <div
            className={`site-overlay${sidebarOpen ? ' show' : ''}`}
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />

          <div className="app-main">
            <header className="topbar">
              <button
                type="button"
                className="sidebar-toggle"
                title="Recolher menu"
                onClick={toggleSidebar}
              >
                <Ico name="panel-left" />
              </button>
              <div className="global-search">
                <Ico name="search" />
                <input placeholder="Buscar..." />
                <kbd>Ctrl K</kbd>
              </div>
              <div className="topbar-right">
                <button type="button" className="icon-btn" title="Notificações">
                  <Ico name="bell" />
                  <span className="dot" />
                </button>
                <div
                  className="theme-toggle"
                  title="Alternar tema"
                  onClick={() => {
                    const next = theme === 'light' ? 'dark' : 'light';
                    setTheme(next);
                    applyTheme(next);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const next = theme === 'light' ? 'dark' : 'light';
                      setTheme(next);
                      applyTheme(next);
                    }
                  }}
                >
                  <span className={`th-opt${theme === 'dark' ? ' on' : ''}`}>
                    <Ico name="moon" />
                  </span>
                  <span className={`th-opt${theme === 'light' ? ' on' : ''}`}>
                    <Ico name="sun" />
                  </span>
                </div>
                <div className="profile">
                  <div className="profile-avatar">A</div>
                  <div className="profile-info">
                    <p className="profile-name">Administrador</p>
                    <p className="profile-badge">ADMIN</p>
                  </div>
                </div>
              </div>
            </header>

            <main className="content">
              <section className={`view${view === 'painel' ? ' active' : ''}`}>
                {view === 'painel' && <PainelView />}
              </section>
              <section className={`view${view === 'licencas' ? ' active' : ''}`}>
                {view === 'licencas' && <LicencasView />}
              </section>
              <section className={`view${view === 'usuarios' ? ' active' : ''}`}>
                {view === 'usuarios' && <UsuariosView />}
              </section>
              <section className={`view${view === 'dispositivos' ? ' active' : ''}`}>
                {view === 'dispositivos' && <DispositivosView />}
              </section>
              <section className={`view${view === 'historico' ? ' active' : ''}`}>
                {view === 'historico' && <HistoricoView />}
              </section>
              <section className={`view${view === 'updates' ? ' active' : ''}`}>
                {view === 'updates' && <UpdatesView />}
              </section>
              <section className={`view${view === 'plans' ? ' active' : ''}`}>
                {view === 'plans' && <PlansView />}
              </section>
              <section className={`view${view === 'orders' ? ' active' : ''}`}>
                {view === 'orders' && <OrdersView />}
              </section>
              <section className={`view${view === 'payments' ? ' active' : ''}`}>
                {view === 'payments' && <PaymentsView />}
              </section>
              <section className={`view${view === 'downloads' ? ' active' : ''}`}>
                {view === 'downloads' && <DownloadsView />}
              </section>
              <section className={`view${view === 'coupons' ? ' active' : ''}`}>
                {view === 'coupons' && <CouponsView />}
              </section>
              <section className={`view${view === 'logs' ? ' active' : ''}`}>
                {view === 'logs' && <LogsView />}
              </section>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
