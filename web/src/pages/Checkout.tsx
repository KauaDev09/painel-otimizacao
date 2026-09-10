import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../components/Toast';
import { API, isAuthed, type Coupon, type Payment, type Plan } from '../lib/api';
import { brl } from '../lib/format';

type CheckoutResponse = {
  payment?: Payment;
  order?: { amount?: number };
  message?: string;
};

export default function Checkout() {
  const [params] = useSearchParams();
  const planSlug = params.get('plan') || 'pro';
  const navigate = useNavigate();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [couponMsgColor, setCouponMsgColor] = useState('');
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [paying, setPaying] = useState(false);
  const [pixView, setPixView] = useState<CheckoutResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      navigate(`/login?next=${encodeURIComponent(`/checkout?plan=${planSlug}`)}`, { replace: true });
      return;
    }
    API.get<{ plans: Plan[] }>('/api/v1/public/plans')
      .then(({ plans }) => {
        const p = plans.find((x) => x.slug === planSlug);
        if (!p) throw new Error('Plano não encontrado.');
        setPlan(p);
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Erro ao carregar plano.', 'err'));
  }, [planSlug, navigate]);

  function discounted() {
    if (!plan) return 0;
    const base = Number(plan.price || 0);
    const pct = appliedCoupon ? appliedCoupon.discountPercent : 0;
    return Math.round(base * (1 - pct / 100) * 100) / 100;
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    setCouponMsg('Validando...');
    setCouponMsgColor('');
    if (!code) {
      setCouponMsg('Informe um código de cupom.');
      setCouponMsgColor('var(--yellow)');
      return;
    }
    try {
      const res = await API.post<{ coupon: Coupon; message: string }>(
        '/api/v1/public/validate-coupon',
        { coupon: code },
      );
      setAppliedCoupon({ code: res.coupon.code, discountPercent: res.coupon.discountPercent });
      setCouponMsg(res.message);
      setCouponMsgColor('var(--green)');
    } catch (err) {
      setCouponMsg(err instanceof Error ? err.message : 'Cupom inválido.');
      setCouponMsgColor('var(--yellow)');
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg('');
  }

  async function startCheckout() {
    if (!plan) return;
    setPaying(true);
    try {
      const res = await API.post<CheckoutResponse>(
        '/api/v1/store/checkout',
        { plan: plan.slug, method, coupon: appliedCoupon?.code },
        true,
      );
      if (res.payment?.qr_code) {
        setPixView(res);
      } else if (res.payment?.external_link || res.payment?.checkoutUrl) {
        window.location.href = (res.payment.external_link || res.payment.checkoutUrl)!;
      } else {
        toast('Pagamento gerado. Acompanhe em Minha conta.', 'ok');
        setTimeout(() => navigate('/conta'), 1200);
      }
    } catch (err) {
      const apiErr = err as { message?: string; code?: string };
      if (apiErr.code === 'PAYMENT_NOT_CONFIGURED') {
        setUnavailable(true);
      } else if (apiErr.code === 'RATE_LIMITED') {
        toast('Muitas tentativas. Aguarde um instante antes de tentar novamente.', 'err');
      } else {
        toast(apiErr.message || 'Não foi possível gerar o pagamento.', 'err');
      }
    } finally {
      setPaying(false);
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

  if (unavailable) {
    return (
      <div className="page-wrap">
        <div className="container auth-wrap" style={{ maxWidth: 760 }}>
          <div className="text-center muted" style={{ padding: '20px 0' }}>
            <h3 style={{ color: 'var(--yellow)' }}>Pagamento temporariamente indisponível</h3>
            <p style={{ marginTop: 8 }}>
              Estamos configurando o sistema de pagamento. Tente novamente mais tarde.
            </p>
            <Link to="/planos" className="btn mt-2">
              Voltar aos planos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (pixView?.payment?.qr_code) {
    const p = pixView.payment;
    const amount = pixView.order?.amount ?? discounted();
    return (
      <div className="page-wrap">
        <div className="container auth-wrap" style={{ maxWidth: 760 }}>
          <div className="text-center">
            <h3>Pague com PIX</h3>
            <p className="dim">
              Escaneie o QR Code ou copie o código abaixo. Sua chave será liberada automaticamente.
            </p>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 14,
                margin: '20px auto',
                maxWidth: 260,
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
              Valor: {brl(amount)}
            </div>
            <p className="muted mt-2" style={{ fontSize: 13 }}>
              Pode demorar alguns segundos para confirmar. <Link to="/conta">Acompanhe aqui</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="container auth-wrap" style={{ maxWidth: 760 }}>
        <h2>Finalizar compra</h2>
        <p className="sub">Revise seu pedido e escolha como pagar.</p>

        {!plan ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : (
          <>
            <div className="summary">
              <div className="row">
                <span className="k">Plano</span>
                <span>{plan.name}</span>
              </div>
              <div className="row">
                <span className="k">Faturamento</span>
                <span>Mensal</span>
              </div>
              <div className="row">
                <span className="k">Total</span>
                <span id="sum-total">
                  {appliedCoupon ? (
                    <>
                      <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>
                        {brl(plan.price)}
                      </span>{' '}
                      <b style={{ color: 'var(--green)' }}>{brl(discounted())}</b>
                    </>
                  ) : (
                    brl(plan.price)
                  )}
                </span>
              </div>
              {appliedCoupon && (
                <div className="row">
                  <span className="k">Cupom</span>
                  <span className="muted" style={{ color: 'var(--green)' }}>
                    {appliedCoupon.code} (−{appliedCoupon.discountPercent}%)
                  </span>
                </div>
              )}
            </div>

            <div className="coupon-box" style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                Tem um cupom de desconto?
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  id="coupon-input"
                  type="text"
                  placeholder="Ex.: BEMVINDO10"
                  value={appliedCoupon ? appliedCoupon.code : couponInput}
                  disabled={!!appliedCoupon}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                  style={{ flex: 1, maxWidth: 'none' }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!!appliedCoupon}
                  onClick={applyCoupon}
                >
                  {appliedCoupon ? 'Aplicado' : 'Aplicar'}
                </button>
                {appliedCoupon && (
                  <button type="button" className="btn btn-outline" onClick={clearCoupon}>
                    Remover
                  </button>
                )}
              </div>
              {couponMsg && (
                <div className="muted" style={{ fontSize: 13, marginTop: 8, color: couponMsgColor }}>
                  {couponMsg}
                </div>
              )}
            </div>

            <div className="methods">
              <label className="method">
                <input
                  type="radio"
                  name="method"
                  value="pix"
                  checked={method === 'pix'}
                  onChange={() => setMethod('pix')}
                />
                <div>
                  <div className="lbl">PIX</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Pagamento instantâneo via QR Code
                  </div>
                </div>
              </label>
              <label className="method">
                <input
                  type="radio"
                  name="method"
                  value="card"
                  checked={method === 'card'}
                  onChange={() => setMethod('card')}
                />
                <div>
                  <div className="lbl">Cartão de crédito</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Você será redirecionado para o gateway
                  </div>
                </div>
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg btn-block mt-2"
              disabled={paying}
              onClick={startCheckout}
            >
              {paying ? (
                <>
                  <span className="spinner" /> Gerando pagamento...
                </>
              ) : appliedCoupon ? (
                'Gerar pagamento com desconto'
              ) : (
                'Gerar pagamento'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
