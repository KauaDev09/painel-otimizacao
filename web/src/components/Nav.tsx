import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken, isAuthed } from '../lib/api';

type NavProps = {
  showMenu?: boolean;
};

export default function Nav({ showMenu = true }: NavProps) {
  const [authed, setAuthed] = useState(isAuthed());
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const lastY = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setAuthed(isAuthed());
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const apply = () => {
      const y = window.scrollY || 0;
      nav.classList.toggle('scrolled', y > 16);
      const inner = nav.querySelector('.nav-inner');
      const open = inner?.classList.contains('nav-open');
      if (!open && y > lastY.current + 4 && y > 72) nav.classList.add('is-hidden');
      else if (y < lastY.current - 2 || y < 48) nav.classList.remove('is-hidden');
      lastY.current = y;
    };

    window.addEventListener('scroll', apply, { passive: true });
    apply();
    return () => window.removeEventListener('scroll', apply);
  }, []);

  function handleLogout() {
    clearToken();
    setAuthed(false);
    navigate('/');
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <nav className="nav" ref={navRef}>
      <div className={`nav-inner${menuOpen ? ' nav-open' : ''}`}>
        <Link to="/" className="brand" aria-label="Orion Optimizer — Início" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            <img src="/assets/icon.jpeg" alt="" />
          </span>
          ORION<span className="accent">OPTIMIZER</span>
        </Link>

        {showMenu && (
          <div className="nav-menu">
            <Link to="/#produto" onClick={closeMenu}>
              Produto
            </Link>
            <Link to="/#recursos" onClick={closeMenu}>
              Recursos
            </Link>
            <Link to="/#como-funciona" onClick={closeMenu}>
              Como funciona
            </Link>
            <Link to="/planos" onClick={closeMenu}>
              Planos
            </Link>
            <Link to="/download" onClick={closeMenu}>
              Download
            </Link>
            <Link to="/suporte" onClick={closeMenu}>
              Suporte
            </Link>
          </div>
        )}

        <div className="nav-actions">
          {authed ? (
            <>
              <Link to="/conta" className="btn btn-ghost">
                Minha conta
              </Link>
              <button type="button" className="btn" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Entrar
              </Link>
              <Link to="/planos" className="btn btn-primary" data-magnet="16">
                Ver planos
              </Link>
            </>
          )}
        </div>

        {showMenu && (
          <button
            type="button"
            className="nav-toggle"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        )}
      </div>
    </nav>
  );
}
