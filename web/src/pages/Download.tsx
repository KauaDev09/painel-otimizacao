import DownloadPanel from '../components/DownloadPanel';
import Reveal from '../components/Reveal';

export default function DownloadPage() {
  return (
    <section className="section" id="download">
      <div className="container">
        <Reveal className="section-head">
          <div className="kicker">Download</div>
          <h2>Instale agora. Ative quando quiser.</h2>
          <p>
            O instalador é público e não pede cadastro. Sem a key, o painel permanece bloqueado.
          </p>
        </Reveal>
        <Reveal>
          <DownloadPanel />
        </Reveal>
      </div>
    </section>
  );
}
