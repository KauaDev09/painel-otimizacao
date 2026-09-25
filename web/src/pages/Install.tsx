import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  API,
  INSTALLER_DOWNLOAD_URL,
  PUBLIC_INSTALLER,
  type DownloadInfo,
} from '../lib/api';

const AUTO_DOWNLOAD_KEY = 's4_installer_auto_download';

type DownloadState = 'loading' | 'started' | 'ready' | 'unsupported';

function triggerDownload() {
  const link = document.createElement('a');
  link.href = INSTALLER_DOWNLOAD_URL;
  link.download = '';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function hasAutoDownloaded() {
  try {
    return sessionStorage.getItem(AUTO_DOWNLOAD_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAutoDownload() {
  try {
    sessionStorage.setItem(AUTO_DOWNLOAD_KEY, '1');
  } catch {
    return;
  }
}

function initialDownloadState(): DownloadState {
  if (!/Win/i.test(navigator.userAgent)) return 'unsupported';
  return hasAutoDownloaded() ? 'ready' : 'loading';
}

export default function Install() {
  const [download, setDownload] = useState<DownloadInfo>(PUBLIC_INSTALLER);
  const [downloadState, setDownloadState] = useState<DownloadState>(initialDownloadState);
  const autoStartPending = useRef(downloadState === 'loading');

  useEffect(() => {
    let active = true;
    API.get<{ download?: DownloadInfo }>('/api/v1/public/download')
      .then((data) => {
        if (!active) return;
        const current = data?.download;
        setDownload(current?.url ? current : PUBLIC_INSTALLER);
      })
      .catch(() => {
        if (active) setDownload(PUBLIC_INSTALLER);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoStartPending.current) return;
    autoStartPending.current = false;
    rememberAutoDownload();
    triggerDownload();
    queueMicrotask(() => setDownloadState('started'));
  }, []);

  function downloadAgain() {
    setDownloadState('started');
    triggerDownload();
  }

  const stateMessage =
    downloadState === 'started'
      ? 'Download solicitado. Se o arquivo não aparecer, use o botão abaixo.'
      : downloadState === 'ready'
        ? 'O download já foi solicitado nesta sessão. Use o botão abaixo para tentar novamente.'
        : downloadState === 'unsupported'
          ? 'Abra esta página no Windows para iniciar a instalação.'
          : 'Preparando o download do instalador…';

  return (
    <section className="install-page">
      <div className="container install-layout">
        <div className="install-copy">
          <div className="install-badge">Instalação pública · sem cadastro</div>
          <h1>Instalar SevenOptimizer</h1>
          <p>
            O instalador inicia automaticamente ao abrir esta aba. Você não precisa de conta nem
            de login do GitHub.
          </p>
          <div className="install-points" aria-label="Etapas da instalação">
            {[
              ['01', 'Download', 'O arquivo oficial começa a ser baixado automaticamente.'],
              ['02', 'Confirmação', 'O Windows pergunta antes de executar o instalador.'],
              ['03', 'Conclusão', 'Siga o instalador e abra o SevenOptimizer.'],
            ].map(([number, title, description]) => (
              <div className="install-point" key={number}>
                <span className="install-point-number">{number}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="install-card" data-spotlight>
          <div className="install-card-head">
            <span className="install-version">v{download.version}</span>
            <span className="install-platform">Windows 64 bits</span>
          </div>
          <h2>SevenOptimizer</h2>
          <p className="install-file mono">{download.filename}</p>

          <div className="install-meta">
            <div>
              <span>Versão</span>
              <strong>{download.version}</strong>
            </div>
            <div>
              <span>Tamanho</span>
              <strong>{download.size || '~107 MB'}</strong>
            </div>
            <div>
              <span>Sistema</span>
              <strong>Windows 10/11</strong>
            </div>
          </div>

          <div
            className={`install-state ${downloadState}`}
            role="status"
            aria-live="polite"
          >
            <span className="install-state-dot" />
            <span>{stateMessage}</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={downloadAgain}
            disabled={downloadState === 'unsupported'}
          >
            Baixar o instalador novamente
          </button>

          <p className="install-note">
            O Windows sempre solicita confirmação antes de instalar um aplicativo. Se o download
            não iniciar, use o botão acima ou <Link to="/suporte">abra o suporte</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
