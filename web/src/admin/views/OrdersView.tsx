import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, StatusBadge, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type Order = {
  id: number;
  order_uuid?: string;
  plan_name?: string;
  amount?: number;
  status?: string;
  user_email?: string;
  user_name?: string;
  created_at?: string;
  payment_provider?: string;
};

type Payment = {
  provedor?: string;
  ref_externa?: string;
  valor?: number;
  status?: string;
  pago_em?: string;
  criado_em?: string;
};

type License = {
  chave?: string;
  status?: string;
  plan_slug?: string;
  plano?: string;
};

export default function OrdersView() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [detail, setDetail] = useState<{
    order: Order;
    payments: Payment[];
    license?: License | null;
  } | null>(null);

  useEffect(() => {
    adminCall<{ orders: Order[] }>('/api/v1/admin/orders')
      .then((j) => setOrders(j.orders || []))
      .catch(() => setOrders([]));
  }, []);

  async function showDetail(id: number) {
    try {
      const j = await adminCall<{ order: Order; payments: Payment[]; license?: License }>(
        `/api/v1/admin/orders/${id}`,
      );
      setDetail({ order: j.order, payments: j.payments || [], license: j.license });
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Pedidos" desc="Compras realizadas na loja" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pedido</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders === null ? (
              <TableLoading cols={8} title="Carregando pedidos…" />
            ) : orders.length === 0 ? (
              <TableEmpty cols={8} title="Nenhum pedido ainda." />
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>
                    <KeyMono value={o.order_uuid || ''} />
                  </td>
                  <td>{o.plan_name}</td>
                  <td>R$ {Number(o.amount).toFixed(2)}</td>
                  <td>
                    <StatusBadge st={o.status || ''} />
                  </td>
                  <td>{o.user_email || o.user_name || '—'}</td>
                  <td>{fmtDate(o.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-outline" onClick={() => void showDetail(o.id)}>
                        Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {detail ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Pedido #{detail.order.order_uuid}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Plano</div>
              <b>{detail.order.plan_name}</b>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Valor</div>
              <b>R$ {Number(detail.order.amount).toFixed(2)}</b>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Status</div>
              <StatusBadge st={detail.order.status || ''} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Provedor</div>
              {detail.order.payment_provider || '—'}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Data</div>
              {fmtDate(detail.order.created_at)}
            </div>
          </div>
          {detail.license ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Licença gerada</div>
              <KeyMono value={detail.license.chave || ''} />{' '}
              <span className={`badge badge-${detail.license.status}`}>{detail.license.status}</span> · plano{' '}
              <b>{detail.license.plan_slug || detail.license.plano}</b>
            </div>
          ) : null}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
            Pagamentos / transações
          </div>
          <table className="mini">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Ref.</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.length ? (
                detail.payments.map((p, i) => (
                  <tr key={i}>
                    <td>{p.provedor}</td>
                    <td>
                      <KeyMono value={p.ref_externa || '—'} />
                    </td>
                    <td>R$ {Number(p.valor).toFixed(2)}</td>
                    <td>
                      <StatusBadge st={p.status || ''} />
                    </td>
                    <td>{fmtDate(p.pago_em || p.criado_em)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-dim)' }}>
                    Nenhuma transação registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
