import { Link } from 'react-router-dom';

export default function Termos() {
  return (
    <section className="section">
      <div className="container legal-page">
        <div className="kicker">Legal</div>
        <h1>Termos de uso</h1>
        <p className="lead">
          Última atualização: 5 de setembro de 2026. Ao baixar o instalador, comprar uma key ou usar
          o painel, você concorda com isto.
        </p>

        <h2>1. O que é o Orion</h2>
        <p>
          O Orion Optimizer é um aplicativo para Windows que analisa hardware e aplica otimizações
          escolhidas por você. O instalador é público. O painel completo exige chave de licença
          paga.
        </p>

        <h2>2. Conta e licença</h2>
        <p>
          A key é pessoal. Você responde pelo uso nos dispositivos vinculados. Podemos bloquear a
          key se houver abuso, fraude no pagamento ou violação destes termos.
        </p>

        <h2>3. Risco das otimizações</h2>
        <p>
          Alguns ajustes podem reiniciar o PC, alterar serviços do Windows ou reduzir estabilidade.
          O app avisa quando o risco é alto. Você aplica por conta própria. Não prometemos ganho de
          FPS nem “milagre”.
        </p>

        <h2>4. Pagamento</h2>
        <p>
          Planos são assinatura mensal, cobrados via PIX ou cartão pelo provedor de pagamento. A key
          é enviada após a confirmação. Imposto e chargeback seguem as regras do provedor.
        </p>

        <h2>5. Seus dados</h2>
        <p>
          Coletamos só o necessário para vender, ativar, proteger a licença e cumprir a lei. O
          detalhe está na <Link to="/privacidade">Política de privacidade</Link>. Você pode pedir a
          exclusão de <strong>todos</strong> os dados — não só a conta.
        </p>

        <h2>6. Cookies</h2>
        <p>
          Scripts de interface, fontes externas e o registro de visita no site só rodam depois que
          você aceita cookies. O aviso de cookies é software open source sob licença MIT.
        </p>

        <h2>7. Propriedade</h2>
        <p>
          O software, a marca e o painel web são da Orion. Você recebe licença de uso, não a
          propriedade do código do aplicativo.
        </p>

        <h2>8. Contato</h2>
        <p>
          Dúvidas, exclusão de dados ou suporte: <Link to="/suporte">página de suporte</Link>,{' '}
          <a href="https://discord.gg/e3jHfF7ANp" target="_blank" rel="noopener noreferrer">
            Discord oficial
          </a>{' '}
          ou a tela Licença / Configurações do aplicativo.
        </p>
      </div>
    </section>
  );
}
