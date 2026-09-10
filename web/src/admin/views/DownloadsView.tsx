import { useCallback, useEffect, useState } from 'react';
import { adminCall } from '../api';
import { PageHeading, SectionTitle, TableEmpty, TableLoading } from '../components';
import { Ico } from '../icons';
import { fmtDate } from '../utils';

type Dl = {
  id: number;
  version: string;
  filename?: string;
  url?: string;
  is_latest?: boolean;
  active?: boolean;
  created_at?: string;
};

export default function DownloadsView() {
  const [rows, setRows] = useState<Dl[] | null>(null);
  const [version, setVersion] = useState('');
  const [filename, setFilename] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [latest, setLatest] = useState('1');
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'ok' | 'err' | ''>('');

  const load = useCallback(async () => {
    setRows(null);
    const j = await adminCall<{ downloads: Dl[] }>('/api/v1/admin/downloads');
    setRows(j.downloads || []);
  }, []);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  async function save() {
    setMsg('Salvando…');
    setMsgKind('');
    try {
      await adminCall('/api/v1/admin/downloads', {
        method: 'POST',
        body: {
          version: version.trim(),
          filename: filename.trim() || undefined,
          url: url.trim(),
          releaseNotes: notes.trim() || undefined,
          isLatest: latest === '1',
        },
      });
      setMsg('Versão salva.');
      setMsgKind('ok');
      setVersion('');
      setFilename('');
      setUrl('');
      setNotes('');
      await load();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
      setMsgKind('err');
    }
  }

  async function toggle(id: number) {
    try {
      await adminCall(`/api/v1/admin/downloads/${id}/toggle`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <PageHeading title="Downloads" desc="Versões disponíveis para download na página do produto" />
      <div className="card">
        <h2>Cadastrar / atualizar versão</h2>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Versão (X.Y.Z)</label>
            <input value={version} placeholder="2.1.0" onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div>
            <label>Arquivo</label>
            <input value={filename} placeholder="ORION-OPTIMIZER-Setup-2.1.0.exe" onChange={(e) => setFilename(e.target.value)} />
          </div>
          <div style={{ minWidth: 320 }}>
            <label>URL do download</label>
            <input type="url" value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div style={{ marginBottom: 1 }}>
            <label>Última versão</label>
            <select value={latest} onChange={(e) => setLatest(e.target.value)}>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div style={{ marginBottom: 1, alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              Salvar
            </button>
          </div>
        </div>
        <label style={{ maxWidth: 640 }}>Notas da versão (changelog)</label>
        <textarea rows={3} style={{ maxWidth: 640 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Liste as novidades desta versão..." />
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
      <SectionTitle>Versões publicadas</SectionTitle>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Versão</th>
              <th>Arquivo</th>
              <th>Última</th>
              <th>Ativo</th>
              <th>Criado em</th>
              <th>URL</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <TableLoading cols={7} title="Carregando downloads…" />
            ) : rows.length === 0 ? (
              <TableEmpty cols={7} title="Nenhuma versão cadastrada." />
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>v{d.version}</b>
                  </td>
                  <td>{d.filename || '—'}</td>
                  <td>{d.is_latest ? <span className="badge badge-ativa">Última</span> : '—'}</td>
                  <td>
                    {d.active ? (
                      <span className="badge badge-ativa">Ativo</span>
                    ) : (
                      <span className="badge badge-inativa">Inativo</span>
                    )}
                  </td>
                  <td>{fmtDate(d.created_at)}</td>
                  <td style={{ maxWidth: 220 }}>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary-3)', fontSize: '0.75rem', textDecoration: 'none', wordBreak: 'break-all' }}
                      >
                        {d.url.slice(0, 40)}
                        {d.url.length > 40 ? '...' : ''}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-outline" onClick={() => void toggle(d.id)}>
                        {d.active ? 'Desativar' : 'Reativar'}
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
