import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type OptRow = {
  analisado_em?: string;
  hostname?: string;
  chave?: string;
  score?: number;
  boot_mode?: string;
};

type SegRow = OptRow & {
  ameacas_total?: number;
  ameacas_ativas?: number;
};

export default function HistoricoView() {
  const [otim, setOtim] = useState<OptRow[] | null>(null);
  const [seg, setSeg] = useState<SegRow[]>([]);

  useEffect(() => {
    adminCall<{ otimizacoes: OptRow[]; seguranca: SegRow[] }>('/api/v1/admin/history?limit=100')
      .then((j) => {
        setOtim(j.otimizacoes || []);
        setSeg(j.seguranca || []);
      })
      .catch(() => {
        setOtim([]);
        setSeg([]);
      });
  }, []);

  return (
    <>
      <PageHeading title="Histórico" desc="Análises de otimização e segurança" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hostname</th>
              <th>Licença</th>
              <th>Score</th>
              <th>Boot</th>
            </tr>
          </thead>
          <tbody>
            {otim === null ? (
              <TableLoading cols={5} title="Carregando histórico…" />
            ) : otim.length === 0 ? (
              <TableEmpty cols={5} title="Nenhuma análise sincronizada." desc="Aguardando dados do aplicativo." />
            ) : (
              otim.map((h, i) => (
                <tr key={i}>
                  <td>{fmtDate(h.analisado_em)}</td>
                  <td>{h.hostname || '—'}</td>
                  <td>{h.chave ? <KeyMono value={h.chave} /> : '—'}</td>
                  <td>
                    <b>{h.score ?? '—'}/100</b>
                  </td>
                  <td>{h.boot_mode || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <SectionTitle>Análises de segurança</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hostname</th>
              <th>Licença</th>
              <th>Score</th>
              <th>Ameaças</th>
              <th>Ativas</th>
            </tr>
          </thead>
          <tbody>
            {otim === null ? (
              <TableLoading cols={6} title="Carregando…" />
            ) : seg.length === 0 ? (
              <TableEmpty cols={6} title="Nenhuma análise de segurança." />
            ) : (
              seg.map((s, i) => (
                <tr key={i}>
                  <td>{fmtDate(s.analisado_em)}</td>
                  <td>{s.hostname || '—'}</td>
                  <td>{s.chave ? <KeyMono value={s.chave} /> : '—'}</td>
                  <td>
                    <b>{s.score ?? '—'}/100</b>
                  </td>
                  <td>{s.ameacas_total ?? '—'}</td>
                  <td style={{ color: s.ameacas_ativas ? 'var(--red-bright)' : 'var(--green)' }}>
                    {s.ameacas_ativas ?? 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
