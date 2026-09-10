import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../lib/api';

type FooterProps = {
  variant?: 'full' | 'minimal';
};

export default function Footer({ variant = 'full' }: FooterProps) {
  const year = new Date().getFullYear();
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (variant !== 'full') return;
    API.get<{ download?: { version?: string } }>('/api/v1/public/download')
      .then((d) => {
        const v = d?.download?.version ? `v${d.download.version}` : '';
        setVersion(v);
      })
      .catch(() => {});
  }, [variant]);

  if (variant === 'minimal') {
    return (
      <footer className="footer">
        <div className="container">
          <div className="footer-bottom">
            <span>© {year} ORION OPTIMIZER.</span>
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
            <Link to="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                <img src="/assets/icon.jpeg" alt="" />
              </span>
              ORION<span className="accent">OPTIMIZER</span>
            </Link>
            <p>
              Otimização profissional para Windows — análise real, ajustes reversíveis e licença por
              key.
            </p>
          </div>
          <div className="footer-col">
            <h4>Produto</h4>
            <Link to="/#produto">Painel</Link>
            <Link to="/#como-funciona">Como funciona</Link>
            <Link to="/#faq">Perguntas</Link>
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
          <span>© {year} ORION OPTIMIZER.</span>
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
