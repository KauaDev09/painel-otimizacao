import { useCallback, useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { Ico } from '../icons';

type Coupon = {
  id: number;
  code: string;
  discount_value: number;
  used_count?: number;
  max_uses?: number | null;
  expires_at?: string | null;
  active?: boolean;
  orders_count?: number;
};

function cpnExp(exp?: string | null) {
  if (!exp) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const d = new Date(exp);
  const expired = d.getTime() < Date.now();
  return (
    <>
      {d.toLocaleDateString('pt-BR')}
      {expired ? (
        <>
          {' '}
          <span className="badge badge-bloqueada">venceu</span>
        </>
      ) : null}
    </>
  );
}

export default function CouponsView() {
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expires, setExpires] = useState('');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'ok' | 'err' | ''>('');

  const load = useCallback(async () => {
    setRows(null);
    const j = await adminCall<{ coupons: Coupon[] }>('/api/v1/admin/coupons');
    setRows(j.coupons || []);
  }, []);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  async function create() {
    setMsg('Criando…');
    setMsgKind('');
    const c = code.trim().toUpperCase();
    const discountValue = Number(percent);
    if (!c) {
      setMsg('Informe o nome/código do cupom.');
      setMsgKind('err');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
      setMsg('Informe a porcentagem de desconto (1 a 100).');
      setMsgKind('err');
      return;
    }
    try {
      const res = await adminCall<{ code: string }>('/api/v1/admin/coupons', {
        method: 'POST',
        body: {
          code: c,
          discountValue,
          description: desc.trim() || undefined,
          maxUses: maxUses.trim() ? Number(maxUses) : null,
          expiresAt: expires
            ? new Date(`${expires}T23:59:59`).toISOString().slice(0, 19).replace('T', ' ')
            : null,
        },
      });
      setMsg(`Cupom ${res.code} criado (${discountValue.toFixed(0)}% de desconto).`);
      setMsgKind('ok');
      setCode('');
      setPercent('');
      setMaxUses('');
      setExpires('');
      setDesc('');
      await load();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
      setMsgKind('err');
    }
  }

  async function toggle(id: number) {
    try {
      await adminCall(`/api/v1/admin/coupons/${id}/toggle`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  async function remove(id: number, c: string) {
    if (!confirm(`Excluir PERMANENTEMENTE o cupom ${c}?`)) return;
    try {
      await adminCall(`/api/v1/admin/coupons/${id}/delete`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Cupons de desconto" desc="Crie e gerencie cupons de desconto percentual para a loja" />
      <div className="card">
        <h2>Criar cupom</h2>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Nome / código do cupom</label>
            <input
              value={code}
              placeholder="Ex.: BEMVINDO10"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label>Desconto (%)</label>
            <input type="number" min={1} max={100} step={1} style={{ maxWidth: 110 }} value={percent} placeholder="10" onChange={(e) => setPercent(e.target.value)} />
          </div>
          <div>
            <label>Limite de usos (opcional)</label>
            <input type="number" min={1} step={1} style={{ maxWidth: 120 }} value={maxUses} placeholder="Ilimitado" onChange={(e) => setMaxUses(e.target.value)} />
          </div>
          <div>
            <label>Válido até (opcional)</label>
            <input type="date" style={{ maxWidth: 170 }} value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <div style={{ marginBottom: 1, alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Criar cupom
            </button>
          </div>
        </div>
        <label style={{ maxWidth: 520 }}>Descrição (opcional)</label>
        <input type="text" style={{ maxWidth: 520 }} value={desc} placeholder="Ex.: 10% de boas-vindas" onChange={(e) => setDesc(e.target.value)} />
        <div className={`msg${msgKind ? ` ${msgKind}` : ''}`}>
          {msgKind === 'ok' ? (
            <>
              <Ico name="check-circle" /> {msg}
            </>
          ) : (
            msg
          )}
        </div>
      </div>
      <SectionTitle>Cupons cadastrados</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Desconto</th>
              <th>Usos</th>
              <th>Limite</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Pedidos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <TableLoading cols={9} title="Carregando cupons…" />
            ) : rows.length === 0 ? (
              <TableEmpty cols={9} title="Nenhum cupom cadastrado." />
            ) : (
              rows.map((c) => {
                const reachedLimit = c.max_uses != null && Number(c.used_count) >= Number(c.max_uses);
                const active = c.active && !reachedLimit;
                return (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
                      <KeyMono value={c.code} />
                    </td>
                    <td>
                      <b>{Number(c.discount_value).toFixed(0)}%</b>
                    </td>
                    <td>{Number(c.used_count)}</td>
                    <td>{c.max_uses != null ? c.max_uses : '∞'}</td>
                    <td>{cpnExp(c.expires_at)}</td>
                    <td>
                      {active ? (
                        <span className="badge badge-ativa">Ativo</span>
                      ) : reachedLimit ? (
                        <span className="badge badge-bloqueada">Limite atingido</span>
                      ) : (
                        <span className="badge badge-inativa">Inativo</span>
                      )}
                    </td>
                    <td>{Number(c.orders_count || 0)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn-outline" onClick={() => void toggle(c.id)}>
                          {c.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => void remove(c.id, c.code)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
