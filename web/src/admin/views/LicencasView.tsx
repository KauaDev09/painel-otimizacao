import { useCallback, useEffect, useState } from 'react';
import { adminCall } from '../api';
import { Badge, ExpBadge, KeyMono, PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { planLabel } from '../utils';

type License = {
  id: number;
  chave: string;
  plan_slug?: string;
  plano?: string;
  status: string;
  expira_em?: string | null;
  versao_autorizada?: string | null;
  dispositivos_ativos?: number;
  max_dispositivos?: number;
  maquina?: string;
  usuario_nome?: string;
  usuario_email?: string;
};

type PlanOpt = { slug: string; name?: string; active?: boolean };

export default function LicencasView() {
  const [licenses, setLicenses] = useState<License[] | null>(null);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [plano, setPlano] = useState('starter');
  const [dias, setDias] = useState('30');
  const [disp, setDisp] = useState('2');
  const [qtd, setQtd] = useState('1');
  const [cliente, setCliente] = useState('');
  const [msg, setMsg] = useState('');
  const [msgErr, setMsgErr] = useState(false);
  const [created, setCreated] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLicenses(null);
    try {
      const pj = await adminCall<{ plans: PlanOpt[] }>('/api/v1/admin/plans');
      const active = (pj.plans || []).filter((p) => p.active);
      if (active.length) {
        setPlans(active);
        setPlano((cur) => (active.some((p) => p.slug === cur) ? cur : active[0].slug));
      }
    } catch {
      setPlans([
        { slug: 'starter', name: 'STARTER' },
        { slug: 'pro', name: 'PRO' },
        { slug: 'ultra', name: 'ULTRA' },
      ]);
    }
    const j = await adminCall<{ licenses: License[] }>('/api/v1/admin/licenses');
    setLicenses(j.licenses || []);
  }, []);

  useEffect(() => {
    load().catch(() => setLicenses([]));
  }, [load]);

  async function generate() {
    setMsg('Gerando…');
    setMsgErr(false);
    setCreated([]);
    try {
      const j = await adminCall<{ created: string[] }>('/api/v1/admin/licenses', {
        method: 'POST',
        body: {
          plano,
          dias: dias === '' ? 30 : Number(dias),
          maxDispositivos: disp === '' ? 2 : Number(disp),
          quantidade: qtd === '' ? 1 : Number(qtd),
          nome: cliente.trim() || undefined,
        },
      });
      setCreated(j.created || []);
      setMsg('Chaves geradas:');
      await load();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
      setMsgErr(true);
    }
  }

  async function action(id: number, chave: string, act: string) {
    if (act === 'delete') {
      const ok = confirm(
        `Excluir PERMANENTEMENTE a licença ${chave}?\n\nO dispositivo vinculado perde o acesso imediatamente. Esta ação não pode ser desfeita.`,
      );
      if (!ok) return;
    }
    try {
      await adminCall(`/api/v1/admin/licenses/${id}/action`, {
        method: 'POST',
        body: act === 'renew' ? { action: act, dias: 30 } : { action: act },
      });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Licenças" desc="Gerencie e emita chaves de licença" />
      <div className="card">
        <h2>Gerar licenças</h2>
        <p className="hint" style={{ margin: '0 0 12px' }}>
          Os planos vêm da aba Planos (Starter, Pro, Ultra). Validade padrão: 30 dias — altere dias,
          dispositivos, quantidade ou nome quando quiser.
        </p>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Plano</label>
            <select value={plano} onChange={(e) => setPlano(e.target.value)}>
              {(plans.length
                ? plans
                : [
                    { slug: 'starter', name: 'STARTER' },
                    { slug: 'pro', name: 'PRO' },
                    { slug: 'ultra', name: 'ULTRA' },
                  ]
              ).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name || p.slug}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Dias de validade</label>
            <input type="number" value={dias} min={0} style={{ maxWidth: 120 }} onChange={(e) => setDias(e.target.value)} />
          </div>
          <div>
            <label>Máx. dispositivos</label>
            <input type="number" value={disp} min={1} style={{ maxWidth: 100 }} onChange={(e) => setDisp(e.target.value)} />
          </div>
          <div>
            <label>Quantidade</label>
            <input type="number" value={qtd} min={1} max={50} style={{ maxWidth: 100 }} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div>
            <label>Nome do cliente</label>
            <input
              type="text"
              value={cliente}
              maxLength={120}
              placeholder="Opcional — ex.: João Silva"
              onChange={(e) => setCliente(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 1, alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void generate()}>
              Gerar
            </button>
          </div>
        </div>
        <div className={`msg${msgErr ? ' err' : ''}`}>
          {msg}
          {created.length > 0 && (
            <>
              <br />
              {created.map((c) => (
                <span key={c}>
                  <KeyMono value={c} />
                  <br />
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <SectionTitle>Licenças emitidas</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Chave</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Vence em</th>
              <th>Versão</th>
              <th>Dispositivos</th>
              <th>Máquina</th>
              <th>Cliente</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {licenses === null ? (
              <TableLoading cols={9} title="Carregando licenças…" desc="O Orion está buscando as chaves emitidas." />
            ) : licenses.length === 0 ? (
              <TableEmpty cols={9} title="Nenhuma licença emitida" desc="Use o formulário acima para gerar a primeira chave." />
            ) : (
              licenses.map((l) => (
                <tr key={l.id}>
                  <td>
                    <KeyMono value={l.chave} />
                  </td>
                  <td>{planLabel(l)}</td>
                  <td>
                    <Badge status={l.status} />
                  </td>
                  <td>
                    <ExpBadge exp={l.expira_em} />
                  </td>
                  <td>{l.versao_autorizada ? `v${l.versao_autorizada}` : '—'}</td>
                  <td>
                    {l.dispositivos_ativos}/{l.max_dispositivos}
                  </td>
                  <td>{l.maquina || ''}</td>
                  <td>{l.usuario_nome || l.usuario_email || ''}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-outline" onClick={() => void action(l.id, l.chave, 'block')}>
                        Bloquear
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => void action(l.id, l.chave, 'unblock')}>
                        Reativar
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => void action(l.id, l.chave, 'renew')}>
                        +30 dias
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => void action(l.id, l.chave, 'delete')}>
                        Excluir
                      </button>
                    </div>
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
