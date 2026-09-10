import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, TableEmpty, TableLoading } from '../components';
import { fmtDate } from '../utils';

type Log = {
  criado_em?: string;
  evento?: string;
  chave?: string;
  detalhe?: string;
};

type Access = {
  created_at?: string;
  event?: string;
  method?: string;
  path?: string;
  ip?: string;
  user_id?: number | string;
  user_agent?: string;
};

export default function LogsView() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [access, setAccess] = useState<Access[]>([]);

  useEffect(() => {
    adminCall<{ logs: Log[]; access?: Access[] }>('/api/v1/admin/logs?limit=200')
      .then((j) => {
        setLogs(j.logs || []);
        setAccess(j.access || []);
      })
      .catch(() => {
        setLogs([]);
        setAccess([]);
      });
  }, []);

  return (
    <>
      <PageHeading title="Logs" desc="Registro de eventos do sistema" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Evento</th>
              <th>Licença</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {logs === null ? (
              <TableLoading cols={4} title="Carregando logs…" />
            ) : logs.length === 0 ? (
              <TableEmpty cols={4} title="Nenhum log registrado." />
            ) : (
              logs.map((l, i) => (
                <tr key={i}>
                  <td>{fmtDate(l.criado_em)}</td>
                  <td>{l.evento}</td>
                  <td>{l.chave ? <KeyMono value={l.chave} /> : '—'}</td>
                  <td>
                    <code style={{ fontSize: 11, color: 'var(--text-dim)' }}>{l.detalhe}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="page-heading" style={{ marginTop: 28 }}>
        <h2>Log de acesso</h2>
        <p>IP, rota, método e user-agent — visitas após cookie e chamadas de API</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Evento</th>
              <th>Método</th>
              <th>Rota</th>
              <th>IP</th>
              <th>User</th>
              <th>Navegador</th>
            </tr>
          </thead>
          <tbody>
            {logs === null ? (
              <TableLoading cols={7} title="Carregando…" />
            ) : access.length === 0 ? (
              <TableEmpty cols={7} title="Nenhum acesso registrado." />
            ) : (
              access.map((a, i) => (
                <tr key={i}>
                  <td>{fmtDate(a.created_at)}</td>
                  <td>{a.event}</td>
                  <td>{a.method}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{a.path}</code>
                  </td>
                  <td>{a.ip || '—'}</td>
                  <td>{a.user_id || '—'}</td>
                  <td title={a.user_agent || ''}>{String(a.user_agent || '—').slice(0, 48)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
