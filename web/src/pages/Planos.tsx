import PlansGrid from '../components/PlansGrid';
import Reveal from '../components/Reveal';

export default function Planos() {
  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-head">
          <div className="kicker">Planos</div>
          <h2>Escolha o plano. Receba a key.</h2>
          <p>
            PIX ou cartão. A chave é liberada após a confirmação do pagamento — sem fila de
            atendimento.
          </p>
        </Reveal>
        <PlansGrid priceSuffix=" mensal" longLabels />
      </div>
    </section>
  );
}
