import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptConsent, hasConsent, injectFonts, pingAccess } from '../lib/consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasConsent()) {
      document.documentElement.classList.remove('cookie-wait');
      return;
    }
    document.documentElement.classList.add('cookie-wait');
    setVisible(true);
  }, []);

  function handleAccept() {
    acceptConsent();
    injectFonts();
    pingAccess();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div id="orion-cookie" role="dialog" aria-label="Aceitar cookies">
      <div className="ck-box">
        <img className="ck-logo" src="/assets/icon.jpeg" alt="Orion" />
        <div className="ck-copy">
          <strong>Aceitar cookies</strong>
          <p>
            Usamos cookies e armazenamento local para sessão da conta, segurança (log de acesso) e
            preferência deste aviso. Sem o aceite, scripts da interface, fontes externas e o
            registro de visita ficam bloqueados.
          </p>
          <p className="ck-mit">
            Este aviso é <em>open source</em>, licença <strong>MIT</strong>.{' '}
            <Link to="/privacidade">Política de privacidade</Link> ·{' '}
            <Link to="/termos">Termos de uso</Link>
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleAccept}>
          Aceitar cookies
        </button>
      </div>
    </div>
  );
}
