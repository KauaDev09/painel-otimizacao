import DownloadPanel from '../components/DownloadPanel';
import Reveal from '../components/Reveal';

export default function DownloadPage() {
  return (
    <section className="section" id="download">
      <div className="container">
        <Reveal className="section-head">
          <div className="kicker">Download</div>
          <h2>Instalador público. Ativação por licença.</h2>
          <p>
            Baixe sem cadastro. Sem a key, o painel permanece bloqueado até a validação da licença
            no aplicativo.
          </p>
        </Reveal>
        <Reveal>
          <DownloadPanel />
        </Reveal>
      </div>
    </section>
  );
}
