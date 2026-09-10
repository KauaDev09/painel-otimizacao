import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, StatusBadge, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type Payment = {
  id: number;
  order_uuid?: string;
  provedor?: string;
  valor?: number;
  status?: string;
  raw_status?: string;
  provider_payment_id?: string;
  ref_externa?: string;
  criado_em?: string;
};

export default function PaymentsView() {
  const [rows, setRows] = useState<Payment[] | null>(null);

  useEffect(() => {
    adminCall<{ payments: Payment[] }>('/api/v1/admin/payments')
      .then((j) => setRows(j.payments || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <>
      <PageHeading title="Pagamentos" desc="Transações registradas via gateway" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pedido</th>
              <th>Provedor</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ref. externa</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <TableLoading cols={7} title="Carregando pagamentos…" />
            ) : rows.length === 0 ? (
              <TableEmpty cols={7} title="Nenhum pagamento registrado." />
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.order_uuid ? <KeyMono value={p.order_uuid} /> : '—'}</td>
                  <td>{p.provedor || '—'}</td>
                  <td>R$ {Number(p.valor).toFixed(2)}</td>
                  <td>
                    <StatusBadge st={p.status || ''} />
                    {p.raw_status && p.raw_status !== p.status ? (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{p.raw_status}</div>
                    ) : null}
                  </td>
                  <td>
                    <KeyMono value={p.provider_payment_id || p.ref_externa || '—'} />
                  </td>
                  <td>{fmtDate(p.criado_em)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
