import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { API } from '../lib/api';
import { scrollToHash } from '../lib/scroll';
import BrandMark from './BrandMark';

type FooterProps = {
  variant?: 'full' | 'minimal';
};

export default function Footer({ variant = 'full' }: FooterProps) {
  const year = new Date().getFullYear();
  const [version, setVersion] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (variant !== 'full') return;
    API.get<{ download?: { version?: string } }>('/api/v1/public/download')
      .then((d) => {
        const v = d?.download?.version ? `v${d.download.version}` : '';
        setVersion(v);
      })
      .catch(() => {});
  }, [variant]);

  function handleHashClick(e: MouseEvent<HTMLAnchorElement>, hash: string) {
    e.preventDefault();
    if (location.pathname === '/') {
      if (location.hash !== `#${hash}`) {
        navigate({ pathname: '/', hash: `#${hash}` });
      }
      requestAnimationFrame(() => scrollToHash(hash));
    } else {
      navigate({ pathname: '/', hash: `#${hash}` });
    }
  }

  if (variant === 'minimal') {
    return (
      <footer className="footer">
        <div className="container">
          <div className="footer-bottom">
            <span>© {year} SevenOptimizer.</span>
            <span>
              <Link to="/privacidade">Privacidade</Link> · <Link to="/termos">Termos</Link>
            </span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/">
              <BrandMark variant="wordmark" />
            </Link>
            <p>
              Diagnóstico e otimização para Windows — leitura de hardware, ajustes sob sua escolha e
              histórico para desfazer.
            </p>
          </div>
          <div className="footer-col">
            <h4>Produto</h4>
            <Link to="/#produto" onClick={(e) => handleHashClick(e, 'produto')}>
              Painel
            </Link>
            <Link to="/#como-funciona" onClick={(e) => handleHashClick(e, 'como-funciona')}>
              Como funciona
            </Link>
            <Link to="/#faq" onClick={(e) => handleHashClick(e, 'faq')}>
              Perguntas
            </Link>
          </div>
          <div className="footer-col">
            <h4>Comprar</h4>
            <Link to="/planos">Planos</Link>
            <Link to="/login">Entrar</Link>
            <Link to="/conta">Minha conta</Link>
          </div>
          <div className="footer-col">
            <h4>Suporte</h4>
            <Link to="/download">Download</Link>
            <Link to="/suporte">Suporte</Link>
            <a href="https://discord.gg/e3jHfF7ANp" target="_blank" rel="noopener noreferrer">
              Discord
            </a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <Link to="/termos">Termos de uso</Link>
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/privacidade#exclusao">Exclusão de dados</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} SevenOptimizer (S4).</span>
          {version && (
            <span className="mono" style={{ color: 'var(--text-muted)' }}>
              {version}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
