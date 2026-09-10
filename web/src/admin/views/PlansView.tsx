import { useCallback, useEffect, useState } from 'react';
import { adminCall } from '../api';
import { KeyMono, PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { Ico } from '../icons';
import { featLabel, parseFeats, parseFeatures } from '../utils';

type Plan = {
  id: number;
  name: string;
  slug: string;
  price: number;
  description?: string;
  features?: unknown;
  active?: boolean;
  sort_order?: number;
};

export default function PlansView() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [editId, setEditId] = useState<number | undefined>();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState('19.99');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState('1');
  const [desc, setDesc] = useState('');
  const [feats, setFeats] = useState('');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'ok' | 'err' | ''>('');

  const load = useCallback(async () => {
    setPlans(null);
    const j = await adminCall<{ plans: Plan[] }>('/api/v1/admin/plans');
    setPlans(j.plans || []);
  }, []);

  useEffect(() => {
    load().catch(() => setPlans([]));
  }, [load]);

  function resetForm() {
    setEditId(undefined);
    setName('');
    setSlug('');
    setDesc('');
    setFeats('');
    setPrice('19.99');
    setOrder('0');
    setActive('1');
  }

  async function save() {
    const s = slug.trim().toLowerCase();
    if (!name.trim()) {
      setMsg('Informe o nome do plano.');
      setMsgKind('err');
      return;
    }
    if (!s) {
      setMsg('Informe o slug do plano.');
      setMsgKind('err');
      return;
    }
    setMsg(editId ? 'Salvando…' : 'Criando…');
    setMsgKind('');
    const body = {
      id: editId,
      name: name.trim(),
      slug: s,
      price: Number(price || 0),
      description: desc.trim() || undefined,
      features: parseFeats(feats),
      active: active === '1',
      sortOrder: Number(order || 0),
    };
    try {
      if (editId) await adminCall(`/api/v1/admin/plans/${editId}`, { method: 'POST', body });
      else await adminCall('/api/v1/admin/plans', { method: 'POST', body });
      setMsg('Plano salvo.');
      setMsgKind('ok');
      resetForm();
      await load();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
      setMsgKind('err');
    }
  }

  function edit(p: Plan) {
    const features = parseFeatures(p.features);
    setEditId(p.id);
    setName(p.name);
    setSlug(p.slug);
    setDesc(p.description || '');
    setFeats(features.join(', '));
    setPrice(String(p.price));
    setOrder(String(p.sort_order ?? 0));
    setActive(p.active ? '1' : '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggle(id: number, currentlyActive: boolean) {
    try {
      await adminCall(`/api/v1/admin/plans/${id}`, {
        method: 'POST',
        body: { active: !currentlyActive },
      });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Planos" desc="Planos de venda do SaaS e seus recursos" />
      <div className="card">
        <h2>Criar / editar plano</h2>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Nome</label>
            <input value={name} placeholder="Ex.: Pro" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Slug</label>
            <input value={slug} placeholder="pro" onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div>
            <label>Preço (R$)</label>
            <input type="number" step="0.01" min={0} value={price} style={{ maxWidth: 110 }} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label>Ordem</label>
            <input type="number" value={order} style={{ maxWidth: 80 }} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <div style={{ marginBottom: 1 }}>
            <label>Ativo</label>
            <select value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div style={{ marginBottom: 1, alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              {editId ? `Salvar alterações (#${editId})` : 'Salvar plano'}
            </button>
          </div>
        </div>
        <label style={{ maxWidth: 640 }}>Descrição</label>
        <textarea rows={2} style={{ maxWidth: 640 }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Breve descrição exibida na página de planos." />
        <label style={{ maxWidth: 640 }}>Recursos (feats) — separados por vírgula</label>
        <textarea rows={3} style={{ maxWidth: 640 }} value={feats} onChange={(e) => setFeats(e.target.value)} placeholder="system_monitoring, basic_cleanup, fps_boost" />
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
      <SectionTitle>Planos cadastrados</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Plano</th>
              <th>Slug</th>
              <th>Preço</th>
              <th>Recursos</th>
              <th>Ativo</th>
              <th>Ordem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans === null ? (
              <TableLoading cols={8} title="Carregando planos…" />
            ) : plans.length === 0 ? (
              <TableEmpty cols={8} title="Nenhum plano cadastrado." />
            ) : (
              plans.map((p) => {
                const features = parseFeatures(p.features);
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td>
                      <KeyMono value={p.slug} />
                    </td>
                    <td>R$ {Number(p.price).toFixed(2)}</td>
                    <td style={{ maxWidth: 320 }}>
                      {features.length
                        ? features.map((f) => (
                            <span key={f} className="badge badge-ativa" style={{ margin: 1 }}>
                              {featLabel(f)}
                            </span>
                          ))
                        : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                    </td>
                    <td>
                      {p.active ? (
                        <span className="badge badge-ativa">Ativo</span>
                      ) : (
                        <span className="badge badge-inativa">Inativo</span>
                      )}
                    </td>
                    <td>{p.sort_order ?? 0}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn-outline" onClick={() => edit(p)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => void toggle(p.id, !!p.active)}
                        >
                          {p.active ? 'Desativar' : 'Ativar'}
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
