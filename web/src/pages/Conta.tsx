import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, clearToken, isAuthed, type License, type Order, type User } from '../lib/api';
import { brl, statusBadgeClass, statusHint } from '../lib/format';

type AccountData = {
  user: User;
  licenses: License[];
  orders: Order[];
};

export default function Conta() {
  const navigate = useNavigate();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState<{ status?: number } | null>(null);
  const [eraseConfirm, setEraseConfirm] = useState('');
  const [eraseMsg, setEraseMsg] = useState('');

  useEffect(() => {
    if (!isAuthed()) {
      navigate('/login?next=/conta', { replace: true });
      return;
    }
    API.get<AccountData>('/api/v1/store/account/me', true)
      .then(setData)
      .catch((e) => setError({ status: (e as { status?: number }).status }));
  }, [navigate]);

  async function handleErase() {
    if (eraseConfirm.trim() !== 'APAGAR') {
      setEraseMsg('Digite APAGAR para confirmar.');
      return;
    }
    if (!window.confirm('Isso apaga conta, keys, dispositivos e histórico. Não tem volta.')) return;
    try {
      await API.post('/api/v1/store/account/erase', { confirm: 'APAGAR' }, true);
      clearToken();
      navigate('/?erased=1');
    } catch (err) {
      setEraseMsg(err instanceof Error ? err.message : 'Não foi possível apagar agora.');
    }
  }

  const u = data?.user;
  const lics = data?.licenses || [];
  const ord = data?.orders || [];

  return (
    <div className="account-layout">
      <div className="account-head">
        <div className="flex center">
          <div className="avatar" id="avatar">
            {(u?.name || u?.email || '?')[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 style={{ marginBottom: 2 }}>{u?.name || 'Carregando...'}</h2>
            <div className="muted" style={{ fontSize: 14 }}>
              {u?.email || '\u00a0'}
            </div>
          </div>
        </div>
        <Link to="/planos" className="btn">
          Adquirir outro plano
        </Link>
      </div>

      <h3 className="mt-3">Minhas licenças</h3>
      <div style={{ marginTop: 14 }}>
        {!data && !error ? (
          <div className="skeleton" style={{ height: 90 }} />
        ) : error?.status === 401 ? (
          <div className="muted">
            Sua sessão expirou.{' '}
            <Link to="/login" style={{ color: 'var(--accent-text)' }}>
              Entrar novamente
            </Link>
            .
          </div>
        ) : error ? (
          <div className="muted">
            Não foi possível conectar ao servidor. Tente novamente em instantes.
          </div>
        ) : lics.length ? (
          lics.map((l) => (
            <div className="license-row" key={l.key || l.chave}>
              <div>
                <div className="key">{l.key || l.chave}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Plano: <strong>{(l.plan || '').toUpperCase()}</strong>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {statusHint(l.status)}
                </div>
              </div>
              <div className="meta-grid">
                <div className="m">
                  <div className="k">Status</div>
                  <span className="v">
                    <span className={`badge ${statusBadgeClass(l.status)}`}>{l.status}</span>
                  </span>
                </div>
                <div className="m">
                  <div className="k">Ativações</div>
                  <div className="v">
                    {l.activations || 0} / {l.maxActivations == null ? '∞' : l.maxActivations}
                  </div>
                </div>
                {l.expiresAt && (
                  <div className="m">
                    <div className="k">Validade</div>
                    <div className="v">{new Date(l.expiresAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="muted">
            Você ainda não possui licenças.{' '}
            <Link to="/planos" style={{ color: 'var(--accent-text)' }}>
              Adquirir agora
            </Link>
            .
          </div>
        )}
      </div>

      <h3 className="mt-3">Meus pedidos</h3>
      <div style={{ marginTop: 14 }}>
        {!data && !error ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : ord.length ? (
          ord.map((o) => (
            <div className="license-row" key={o.uuid || o.order_uuid}>
              <div>
                <div className="key" style={{ fontSize: 14 }}>
                  #{o.uuid || o.order_uuid}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {o.plan || o.plan_name} · {brl(o.amount || 0)}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {statusHint(o.status)}
                </div>
              </div>
              <div className="meta-grid">
                <div className="m">
                  <div className="k">Status</div>
                  <span className="v">
                    <span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span>
                  </span>
                </div>
                <div className="m">
                  <div className="k">Data</div>
                  <div className="v">
                    {new Date(o.createdAt || o.created_at || '').toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="muted">Nenhum pedido ainda.</div>
        )}
      </div>

      <div className="danger-zone">
        <h3>Apagar todos os meus dados</h3>
        <p className="dim">
          Não desativa só a conta. Apaga licenças, dispositivos, pedidos, histórico e logs ligados a
          você. Digite <strong>APAGAR</strong> para confirmar.
        </p>
        <div className="field" style={{ marginTop: 14, maxWidth: 280 }}>
          <label htmlFor="erase-confirm">Confirmação</label>
          <input
            id="erase-confirm"
            placeholder="APAGAR"
            autoComplete="off"
            value={eraseConfirm}
            onChange={(e) => setEraseConfirm(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-danger" onClick={handleErase}>
          Excluir dados por completo
        </button>
        {eraseMsg && (
          <p className="muted" style={{ marginTop: 10 }}>
            {eraseMsg}
          </p>
        )}
      </div>
    </div>
  );
}
