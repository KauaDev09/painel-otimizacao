import { useEffect, useState } from 'react';
import { adminCall } from '../api';
import { PageHeading } from '../components';
import StateBox from '../StateBox';

type Stats = {
  licencas?: { total?: number; ativas?: number; bloqueadas?: number; expiradas?: number };
  dispositivosAtivos?: number;
  usuarios?: number;
  latestUpdate?: { versao?: string; obrigatoria?: boolean };
  porPlano?: { plano: string; n: number }[];
  versoes?: { versao: string; n: number }[];
};

function StatCard({ n, label, color }: { n: string | number; label: string; color?: string }) {
  return (
    <div className="stat">
      <div className="n" style={color ? { color } : undefined}>
        {n}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

export default function PainelView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminCall<{ stats: Stats }>('/api/v1/admin/stats')
      .then((j) => setStats(j.stats))
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <StateBox type="error" title="Erro ao carregar" desc={err} />;
  if (!stats) {
    return (
      <>
        <PageHeading title="Painel" desc="Visão geral da sua plataforma" />
        <div className="cards">
          <div className="stat" style={{ gridColumn: '1 / -1' }}>
            <StateBox type="loading" title="Sintetizando dados…" desc="O Orion está calculando suas estatísticas." />
          </div>
        </div>
      </>
    );
  }

  const lic = stats.licencas || {};
  const upd = stats.latestUpdate;

  return (
    <>
      <PageHeading title="Painel" desc="Visão geral da sua plataforma" />
      <div id="statsCards" className="cards">
        <StatCard n={lic.total || 0} label="Licenças emitidas" />
        <StatCard n={lic.ativas || 0} label="Ativas" color="var(--green)" />
        <StatCard n={lic.bloqueadas || 0} label="Bloqueadas" color="var(--red-bright)" />
        <StatCard n={lic.expiradas || 0} label="Expiradas" color="var(--yellow)" />
        <StatCard n={stats.dispositivosAtivos ?? 0} label="Dispositivos ativos" />
        <StatCard n={stats.usuarios ?? 0} label="Usuários cadastrados" />
        {upd ? (
          <StatCard
            n={`v${upd.versao}`}
            label={`Versão publicada${upd.obrigatoria ? ' (obrigatória)' : ''}`}
            color="var(--primary-3)"
          />
        ) : null}
      </div>
      <div className="split">
        <div className="card">
          <h2>Licenças por plano</h2>
          <div className="table-wrap" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Chaves</th>
                </tr>
              </thead>
              <tbody>
                {(stats.porPlano || []).length ? (
                  stats.porPlano!.map((p) => (
                    <tr key={p.plano}>
                      <td>
                        <b>{p.plano}</b>
                      </td>
                      <td>{p.n}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--text-dim)' }}>
                      Sem dados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Versões do app (últimas análises)</h2>
          <div className="table-wrap" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Análises</th>
                </tr>
              </thead>
              <tbody>
                {(stats.versoes || []).length ? (
                  stats.versoes!.map((v) => (
                    <tr key={v.versao}>
                      <td>v{v.versao}</td>
                      <td>{v.n}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--text-dim)' }}>
                      Nenhuma análise sincronizada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
