import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken, isAuthed } from '../lib/api';
import { scrollToHash } from '../lib/scroll';
import BrandMark from './BrandMark';

type NavProps = {
  showMenu?: boolean;
};

const HASH_LINKS = [
  { to: '/#produto', label: 'Produto', hash: 'produto' },
  { to: '/#recursos', label: 'Recursos', hash: 'recursos' },
  { to: '/#como-funciona', label: 'Como funciona', hash: 'como-funciona' },
] as const;

const PAGE_LINKS = [
  { to: '/planos', label: 'Planos' },
  { to: '/download', label: 'Download' },
  { to: '/suporte', label: 'Suporte' },
] as const;

export default function Nav({ showMenu = true }: NavProps) {
  const [authed, setAuthed] = useState(isAuthed());
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setAuthed(isAuthed());
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const apply = () => {
      const y = window.scrollY || 0;
      nav.classList.toggle('scrolled', y > 16);
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

  function handleHashClick(e: MouseEvent<HTMLAnchorElement>, hash: string) {
    e.preventDefault();
    closeMenu();

    const go = () => {
      scrollToHash(hash);
    };

    if (location.pathname === '/') {
      if (location.hash === `#${hash}`) {
        go();
      } else {
        navigate({ pathname: '/', hash: `#${hash}` }, { replace: false });
        // Layout also scrolls; this covers same-tick / already-mounted Home.
        requestAnimationFrame(go);
      }
    } else {
      navigate({ pathname: '/', hash: `#${hash}` });
    }
  }

  return (
    <nav className="nav" ref={navRef}>
      <div className={`nav-inner${menuOpen ? ' nav-open' : ''}`}>
        <Link to="/" aria-label="SevenOptimizer — Início" onClick={closeMenu}>
          <BrandMark variant="wordmark" />
        </Link>

        {showMenu && (
          <div className="nav-menu">
            {HASH_LINKS.map((item) => (
              <Link
                key={item.hash}
                to={item.to}
                onClick={(e) => handleHashClick(e, item.hash)}
              >
                {item.label}
              </Link>
            ))}
            {PAGE_LINKS.map((item) => (
              <Link key={item.to} to={item.to} onClick={closeMenu}>
                {item.label}
              </Link>
            ))}
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
