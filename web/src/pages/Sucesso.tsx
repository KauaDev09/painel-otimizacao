import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API, isAuthed, type License, type Order } from '../lib/api';

type View = 'loading' | 'key' | 'pending' | 'error';

export default function Sucesso() {
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('loading');
  const [licenseKey, setLicenseKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkStyle, setCheckStyle] = useState<CSSProperties>({});

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      let key = params.get('key');
      const order =
        params.get('order') || params.get('order_id') || params.get('preference_id');
      let foundOrder: Order | null = null;

      if (isAuthed()) {
        try {
          const me = await API.get<{ licenses: License[]; orders: Order[] }>(
            '/api/v1/store/account/me',
            true,
          );
          const orders = me.orders || [];
          foundOrder = order
            ? orders.find((o) => String(o.uuid || o.order_id) === String(order)) || null
            : null;
          if (key) {
            const lic = (me.licenses || []).find((l) => l.key === key);
            if (lic) key = lic.key!;
          } else if (foundOrder && foundOrder.status === 'paid') {
            const lic =
              (me.licenses || []).find((l) => String(l.order_id) === String(order)) ||
              (me.licenses || [])[0];
            if (lic) key = lic.key || lic.chave || '';
          }
        } catch {
          /* segue abaixo */
        }
      }

      if (cancelled) return;

      setTimeout(() => {
        if (cancelled) return;
        if (key) {
          setLicenseKey(key);
          setView('key');
          const saved = localStorage.getItem('orion_last_key');
          if (saved !== key) {
            try {
              localStorage.setItem('orion_last_key', key);
            } catch {
              /* ignore */
            }
          }
        } else if (
          foundOrder &&
          (foundOrder.status === 'pending' || foundOrder.status === 'pending_payment')
        ) {
          setView('pending');
          setCheckStyle({ background: 'linear-gradient(135deg, var(--yellow), #d97706)' });
        } else {
          setView('error');
          setErrorMsg('O pagamento ainda não foi confirmado pelo servidor.');
          setCheckStyle({ background: 'linear-gradient(135deg, var(--red), #b91c1c)' });
        }
      }, 600);
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [params]);

  function copyKey(btn: HTMLButtonElement) {
    navigator.clipboard.writeText(licenseKey).then(() => {
      btn.textContent = 'Copiado!';
      setTimeout(() => {
        btn.textContent = 'Copiar chave';
      }, 1500);
    });
  }

  const titles: Record<View, string> = {
    loading: 'Verificando pagamento...',
    key: 'Pagamento confirmado!',
    pending: 'Pagamento pendente',
    error: 'Não foi possível confirmar',
  };

  const subtitles: Record<View, string> = {
    loading: 'Consultando o servidor para confirmarmos sua compra.',
    key: 'Sua licença foi gerada automaticamente. Use a chave abaixo no aplicativo ORION OPTIMIZER.',
    pending: 'Estamos aguardando a confirmação do gateway.',
    error: errorMsg || 'Ocorreu um erro ao buscar seu pagamento.',
  };

  return (
    <div className="success-wrap" id="success-wrap">
      <div className="check-big" id="check-icon" style={checkStyle}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2>{titles[view]}</h2>
      <p className="dim">{subtitles[view]}</p>

      {view === 'key' && (
        <div>
          <div className="success-key">{licenseKey}</div>
          <button type="button" className="btn" onClick={(e) => copyKey(e.currentTarget)}>
            Copiar chave
          </button>
        </div>
      )}

      {view === 'pending' && (
        <div>
          <div className="muted" style={{ lineHeight: 1.7, marginTop: 8 }}>
            Seu pagamento ainda está sendo processado. Assim que o gateway confirmar, sua chave
            aparece aqui automaticamente.
            <br />
            Você pode acompanhar em{' '}
            <Link to="/conta" style={{ color: 'var(--accent-text)' }}>
              Minha conta
            </Link>
            .
          </div>
          <div className="mt-3 flex center" style={{ justifyContent: 'center' }}>
            <Link to="/conta" className="btn">
              Minha conta
            </Link>
          </div>
        </div>
      )}

      {view === 'error' && (
        <div>
          <div className="muted" style={{ lineHeight: 1.7, marginTop: 8 }}>
            Não foi possível confirmar seu pagamento agora. Verifique em{' '}
            <Link to="/conta" style={{ color: 'var(--accent-text)' }}>
              Minha conta
            </Link>{' '}
            ou tente novamente.
          </div>
          <div className="mt-3 flex center" style={{ justifyContent: 'center' }}>
            <Link to="/planos" className="btn">
              Planos
            </Link>
            <Link to="/conta" className="btn btn-primary">
              Minha conta
            </Link>
          </div>
        </div>
      )}

      {view === 'key' && (
        <div className="mt-3 flex center" style={{ justifyContent: 'center' }}>
          <Link to="/conta" className="btn">
            Minha conta
          </Link>
          <Link to="/" className="btn btn-primary">
            Voltar ao início
          </Link>
        </div>
      )}
    </div>
  );
}
