import { useCallback, useEffect, useState } from 'react';
import { adminCall } from '../api';
import { PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { Ico } from '../icons';
import { fmtDate } from '../utils';

type Update = {
  id: number;
  versao: string;
  ativa?: boolean;
  obrigatoria?: boolean;
  exige_pagamento?: boolean;
  preco?: number;
  liberada_em?: string;
  changelog?: string;
  url_download?: string;
};

export default function UpdatesView() {
  const [rows, setRows] = useState<Update[] | null>(null);
  const [versao, setVersao] = useState('');
  const [url, setUrl] = useState('');
  const [changelog, setChangelog] = useState('');
  const [obri, setObri] = useState('0');
  const [paga, setPaga] = useState('0');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'ok' | 'err' | ''>('');

  const load = useCallback(async () => {
    setRows(null);
    const j = await adminCall<{ updates: Update[] }>('/api/v1/admin/updates');
    setRows(j.updates || []);
  }, []);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  function genUrl() {
    setMsg('');
    setMsgKind('');
    if (!/^\d+\.\d+\.\d+$/.test(versao.trim())) {
      setMsg('Informe a versão no formato X.Y.Z antes de gerar a URL.');
      setMsgKind('err');
      return;
    }
    const v = versao.trim();
    setUrl(
      `https://github.com/KauaDev09/painel-otimizacao/releases/download/v${v}/ORION-OPTIMIZER-Setup-${v}.exe`,
    );
    setMsg(
      'URL gerada. Confira o nome exato do asset na release (o script npm run release imprime a URL correta).',
    );
    setMsgKind('ok');
  }

  async function publish() {
    setMsg('Publicando…');
    setMsgKind('');
    try {
      await adminCall('/api/v1/admin/updates', {
        method: 'POST',
        body: {
          versao: versao.trim(),
          url: url.trim(),
          changelog: changelog.trim() || undefined,
          obrigatoria: obri === '1',
          exigePagamento: paga === '1',
        },
      });
      setMsg('Versão publicada! Os apps receberão o aviso de atualização na próxima verificação. Os usuários podem atualizar em Configurações → Atualizações.');
      setMsgKind('ok');
      setVersao('');
      setUrl('');
      setChangelog('');
      await load();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
      setMsgKind('err');
    }
  }

  async function toggle(id: number) {
    try {
      await adminCall(`/api/v1/admin/updates/${id}/toggle`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Atualizações" desc="Publique novas versões do aplicativo" />
      <div className="card">
        <h2>Publicar nova versão do aplicativo</h2>
        <p className="hint" style={{ margin: '0 0 12px' }}>
          Ao publicar, a versão anterior é desativada e todos os apps instalados recebem o aviso de
          atualização na próxima verificação.
        </p>
        <div
          style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 18px',
            marginBottom: 18,
          }}
        >
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px', fontWeight: 600 }}>
            Como publicar uma atualização:
          </p>
          <ol style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>
              Rode <code style={{ color: 'var(--primary-3)', background: 'var(--primary-bg)', padding: '1px 6px', borderRadius: 4 }}>npm run release</code> na pasta <b>desktop/</b>
            </li>
            <li>Confira que o repositório está <b>público</b></li>
            <li>Preencha a versão, clique <b>Gerar URL</b> e clique Publicar</li>
          </ol>
        </div>
        <div className="toolbar">
          <div>
            <label>Versão (X.Y.Z)</label>
            <input value={versao} placeholder="2.1.0" onChange={(e) => setVersao(e.target.value)} />
          </div>
          <div style={{ minWidth: 340 }}>
            <label>URL de download do .exe</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div style={{ marginBottom: 1 }}>
            <button type="button" className="btn btn-outline" onClick={genUrl}>
              Gerar URL GitHub
            </button>
          </div>
          <div>
            <label>Obrigatória</label>
            <select value={obri} onChange={(e) => setObri(e.target.value)}>
              <option value="0">Não</option>
              <option value="1">Sim</option>
            </select>
          </div>
          <div>
            <label>Atualização paga (vitalício)</label>
            <select value={paga} onChange={(e) => setPaga(e.target.value)}>
              <option value="0">Não</option>
              <option value="1">Sim (R$ 15)</option>
            </select>
          </div>
          <div style={{ marginBottom: 1 }}>
            <button type="button" className="btn btn-primary" onClick={() => void publish()}>
              Publicar
            </button>
          </div>
        </div>
        <label style={{ maxWidth: 640 }}>Changelog / notas da versão (opcional)</label>
        <textarea
          rows={3}
          style={{ maxWidth: 640 }}
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="Ex.: Corrigido crash ao analisar BIOS..."
        />
        <div className={`msg${msgKind ? ` ${msgKind}` : ''}`}>
          {msgKind === 'ok' && msg.startsWith('Versão') ? (
            <>
              <Ico name="check-circle" /> {msg}
            </>
          ) : (
            msg
          )}
        </div>
      </div>
      <SectionTitle>Histórico de versões</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Versão</th>
              <th>Situação</th>
              <th>Obrigatória</th>
              <th>Paga</th>
              <th>Liberada em</th>
              <th>Changelog</th>
              <th>URL</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <TableLoading cols={8} title="Carregando versões…" />
            ) : rows.length === 0 ? (
              <TableEmpty cols={8} title="Nenhuma versão publicada." />
            ) : (
              rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>v{u.versao}</b>
                  </td>
                  <td>
                    {u.ativa ? (
                      <span className="badge badge-ativa">Ativa</span>
                    ) : (
                      <span className="badge badge-inativa">Inativa</span>
                    )}
                  </td>
                  <td>{u.obrigatoria ? 'Sim' : 'Não'}</td>
                  <td>
                    {u.exige_pagamento ? `Sim · R$ ${Number(u.preco || 15).toFixed(0)}` : 'Não'}
                  </td>
                  <td>{fmtDate(u.liberada_em)}</td>
                  <td style={{ maxWidth: 260 }}>
                    <code style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.changelog || '—'}</code>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {u.url_download ? (
                      <a
                        href={u.url_download}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary-3)', fontSize: '0.75rem', textDecoration: 'none', wordBreak: 'break-all' }}
                      >
                        {u.url_download.slice(0, 50)}
                        {u.url_download.length > 50 ? '...' : ''}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-outline" onClick={() => void toggle(u.id)}>
                        {u.ativa ? 'Desativar' : 'Reativar'}
                      </button>
                      {u.url_download ? (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={(e) => {
                            void navigator.clipboard.writeText(u.url_download!);
                            const btn = e.currentTarget;
                            btn.textContent = 'Copiado!';
                            setTimeout(() => {
                              btn.textContent = 'Copiar URL';
                            }, 1200);
                          }}
                        >
                          Copiar URL
                        </button>
                      ) : null}
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
