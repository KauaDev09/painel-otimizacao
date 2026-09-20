import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, clearToken, isAuthed, type License, type Order, type Payment, type User } from '../lib/api';
import { brl, statusBadgeClass, statusHint } from '../lib/format';
import { toast } from '../components/Toast';

type AccountData = {
  user: User;
  licenses: License[];
  orders: Order[];
};

type SeveniaUsage = {
  plan: 'free' | 'pro';
  activatedAt: string | null;
  date: string;
  used: number;
  limit: number;
  remaining: number;
};

type SeveniaProPlan = {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billingType: string;
};

type ActivateResponse = {
  payment?: Payment;
  order?: { amount?: number };
  message?: string;
};

export default function Conta() {
  const navigate = useNavigate();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState<{ status?: number } | null>(null);
  const [eraseConfirm, setEraseConfirm] = useState('');
  const [eraseMsg, setEraseMsg] = useState('');

  const [siaUsage, setSiaUsage] = useState<SeveniaUsage | null>(null);
  const [siaPlan, setSiaPlan] = useState<SeveniaProPlan | null>(null);
  const [siaErr, setSiaErr] = useState('');
  const [siaMethod, setSiaMethod] = useState<'pix' | 'card'>('card');
  const [siaPaying, setSiaPaying] = useState(false);
  const [siaPix, setSiaPix] = useState<ActivateResponse | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      navigate('/login?next=/conta', { replace: true });
      return;
    }
    API.get<AccountData>('/api/v1/store/account/me', true)
      .then(setData)
      .catch((e) => setError({ status: (e as { status?: number }).status }));
  }, [navigate]);

  useEffect(() => {
    if (!isAuthed()) return;
    API.get<{ usage: SeveniaUsage }>('/api/v1/sevenia/uso-hoje', true)
      .then((r) => setSiaUsage(r.usage))
      .catch(() => setSiaErr('Não foi possível carregar o status da SevenIA.'));
    API.get<{ plan: SeveniaProPlan }>('/api/v1/sevenia/ativar-pro', true)
      .then((r) => setSiaPlan(r.plan))
      .catch(() => setSiaErr('Não foi possível carregar o SevenIA Pro.'));
  }, []);

  async function handleActivatePro() {
    setSiaPaying(true);
    setSiaErr('');
    try {
      const res = await API.post<ActivateResponse>(
        '/api/v1/sevenia/ativar-pro',
        { method: siaMethod },
        true,
      );
      if (res.payment?.qr_code) {
        setSiaPix(res);
      } else if (res.payment?.external_link || res.payment?.checkoutUrl) {
        window.location.href = (res.payment.external_link || res.payment.checkoutUrl)!;
      } else {
        toast('Pagamento gerado. Acompanhe em Meus pedidos.', 'ok');
      }
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      setSiaErr(apiErr.message || 'Não foi possível gerar o pagamento.');
    } finally {
      setSiaPaying(false);
    }
  }

  function copyPix(text: string, btn: HTMLButtonElement) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'Copiado!';
      setTimeout(() => {
        btn.textContent = 'Copiar código PIX';
      }, 1500);
    });
  }

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
  const siaIsPro = siaUsage?.plan === 'pro';
  const siaQr = siaPix?.payment?.qr_code;

  function renderSevenia() {
    if (siaQr) {
      const p = siaPix!.payment!;
      return (
        <div className="summary" style={{ marginTop: 14 }}>
          <div className="text-center">
            <h3 style={{ marginBottom: 6 }}>Pague com PIX</h3>
            <p className="dim" style={{ fontSize: 13 }}>
              Escaneie o QR Code ou copie o código. Seu acesso Pro será liberado automaticamente.
            </p>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 14,
                margin: '16px auto',
                maxWidth: 220,
              }}
            >
              <img src={p.qr_code} style={{ width: '100%', display: 'block' }} alt="QR Code PIX" />
            </div>
            <button
              type="button"
              className="btn"
              onClick={(e) => copyPix(p.qr_code_text || '', e.currentTarget)}
            >
              Copiar código PIX
            </button>
            <div className="muted mt-1" style={{ fontSize: 13 }}>
              Valor: {brl(siaPix?.order?.amount ?? siaPlan?.price ?? 0)}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="summary" style={{ marginTop: 14 }}>
          <div className="row">
            <span className="k">Plano atual</span>
            <span>
              <span className={`badge ${siaIsPro ? 'ativo' : 'pending'}`}>
                {siaUsage ? (siaIsPro ? 'PRO' : 'FREE') : '—'}
              </span>
            </span>
          </div>
          {siaIsPro && siaUsage?.activatedAt && (
            <div className="row">
              <span className="k">Ativado em</span>
              <span>{new Date(siaUsage.activatedAt).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          <div className="row">
            <span className="k">Mensagens hoje</span>
            <span>
              {siaUsage ? `${siaUsage.used} de ${siaUsage.limit}` : '—'}
            </span>
          </div>
        </div>

        {!siaUsage ? (
          <div className="skeleton" style={{ height: 120, marginTop: 14 }} />
        ) : siaIsPro ? (
          <p className="dim" style={{ marginTop: 12 }}>
            Sua SevenIA Pro está ativa com cota diária ampliada. Converse pela aba SevenIA no app.
          </p>
        ) : (
          <div className="summary sevenia-upsell" style={{ marginTop: 14 }}>
            <div>
              <span className="kicker" style={{ color: 'var(--accent)' }}>
                {siaPlan ? siaPlan.name : 'SEVENIA PRO'}
              </span>
              <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
                {siaPlan
                  ? siaPlan.description
                  : 'Assistente de IA com análise do seu sistema em conversa natural.'}
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="k">Valor único</span>
                <span>
                  <b>{siaPlan ? brl(siaPlan.price) : '—'}</b>
                </span>
              </div>
            </div>

            <div className="methods" style={{ marginTop: 14 }}>
              <label className="method">
                <input
                  type="radio"
                  name="sia-method"
                  value="credit_card"
                  checked={siaMethod === 'card'}
                  onChange={() => setSiaMethod('card')}
                />
                <div>
                  <div className="lbl">Cartão de crédito</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Redirecionamento seguro para o gateway
                  </div>
                </div>
              </label>
              <label className="method">
                <input
                  type="radio"
                  name="sia-method"
                  value="pix"
                  checked={siaMethod === 'pix'}
                  onChange={() => setSiaMethod('pix')}
                />
                <div>
                  <div className="lbl">PIX</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Ativação instantânea via QR Code
                  </div>
                </div>
              </label>
            </div>

            {siaErr && (
              <p className="muted" style={{ marginTop: 10, color: 'var(--yellow)' }}>
                {siaErr}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary btn-lg btn-block mt-2"
              disabled={siaPaying}
              onClick={handleActivatePro}
            >
              {siaPaying ? (
                <>
                  <span className="spinner" /> Gerando pagamento...
                </>
              ) : (
                'Ativar SevenIA Pro'
              )}
            </button>
          </div>
        )}
      </>
    );
  }

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

      <h3 className="mt-3">SevenIA — assistente de IA</h3>
      {renderSevenia()}

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
