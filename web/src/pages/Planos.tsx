import PlansGrid from '../components/PlansGrid';
import Reveal from '../components/Reveal';

export default function Planos() {
  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-head">
          <div className="kicker">Licenciamento</div>
          <h2>Planos mensais com entrega automática da key</h2>
          <p>
            PIX ou cartão. A chave é emitida após a confirmação do pagamento e libera o painel no
            aplicativo.
          </p>
        </Reveal>
        <PlansGrid priceSuffix=" mensal" longLabels />
      </div>
    </section>
  );
}
