import { useEffect, useState } from 'react';
import { API, PUBLIC_INSTALLER, type DownloadInfo } from '../lib/api';

type DownloadPanelProps = {
  className?: string;
};

export default function DownloadPanel({ className = '' }: DownloadPanelProps) {
  const [download, setDownload] = useState<DownloadInfo | null>(null);

  useEffect(() => {
    API.get<{ download?: DownloadInfo }>('/api/v1/public/download')
      .then((data) => {
        const d = data?.download;
        setDownload(d?.url ? d : PUBLIC_INSTALLER);
      })
      .catch(() => setDownload(PUBLIC_INSTALLER));
  }, []);

  if (!download) {
    return (
      <div className={`download-panel ${className}`.trim()}>
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div className={`download-panel ${className}`.trim()} data-spotlight>
      <div className="ver">v{download.version}</div>
      <h3>ORION OPTIMIZER</h3>
      <p>Windows 10 / 11 · 64 bits</p>
      <p className="dl-free">Download grátis · chave de licença necessária</p>
      <div className="dl-meta">
        <div>
          <div className="k">Versão</div>
          <div className="v">{download.version}</div>
        </div>
        <div>
          <div className="k">Tamanho</div>
          <div className="v">{download.size || '~78 MB'}</div>
        </div>
        <div>
          <div className="k">Plataforma</div>
          <div className="v">Windows</div>
        </div>
      </div>
      <div className="dl-reqs">
        <h4>Requisitos mínimos</h4>
        <ul>
          <li>Windows 10 ou 11 (64 bits)</li>
          <li>2 GB de RAM livre</li>
          <li>150 MB de espaço em disco</li>
          <li>Internet necessária para ativar e validar a chave de licença</li>
        </ul>
      </div>
      <a className="btn btn-primary btn-lg" href={download.url} download data-magnet="12">
        Baixar instalador
      </a>
      {download.releaseNotes && (
        <div className="changelog">
          <h4>Novidades</h4>
          <pre>{download.releaseNotes}</pre>
        </div>
      )}
    </div>
  );
}
