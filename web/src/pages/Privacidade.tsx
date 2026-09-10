import { Link } from 'react-router-dom';

export default function Privacidade() {
  return (
    <section className="section">
      <div className="container legal-page">
        <div className="kicker">LGPD</div>
        <h1>Política de privacidade</h1>
        <p className="lead">
          Última atualização: 5 de setembro de 2026. Diz o que coletamos, por quê, e como você apaga
          tudo.
        </p>

        <h2>1. Quem controla</h2>
        <p>
          Orion Optimizer (site e aplicativo Windows). Pedidos sobre dados:{' '}
          <Link to="/suporte">/suporte</Link> ou o{' '}
          <a href="https://discord.gg/e3jHfF7ANp" target="_blank" rel="noopener noreferrer">
            Discord oficial
          </a>
          .
        </p>

        <h2>2. Que dado coletamos e o motivo</h2>
        <ul>
          <li>
            <strong>Nome e e-mail</strong> — criar a conta, enviar a key e falar de pagamento ou
            suporte.
          </li>
          <li>
            <strong>Chave de licença, plano e validade</strong> — saber se o painel pode abrir e o
            que a key libera.
          </li>
          <li>
            <strong>Identificador da máquina (hash), hostname e IP da ativação</strong> — limitar
            dispositivos, barrar uso compartilhado indevido e mostrar “este PC” no app.
          </li>
          <li>
            <strong>Dados de pagamento no provedor</strong> (PIX/cartão, valor, status) — cobrar a
            assinatura. Número de cartão não fica no nosso banco; fica no gateway.
          </li>
          <li>
            <strong>Pedidos e cupons</strong> — emitir a key certa e aplicar desconto.
          </li>
          <li>
            <strong>Histórico de otimização e análise de segurança enviados pelo app</strong> (score,
            categorias, resumo de hardware) — se a sincronização estiver ligada, para você ver no
            histórico e o suporte diagnosticar.
          </li>
          <li>
            <strong>Log de acesso</strong> (IP, página ou rota da API, data, navegador, às vezes
            user id ou key) — segurança, abuso, fraude e cumprimento legal. Sem isso não dá para
            ver quem bateu na API.
          </li>
          <li>
            <strong>Cookie / localStorage de consentimento e token de sessão</strong> — lembrar que
            você aceitou cookies e manter o login da conta no site.
          </li>
          <li>
            <strong>Mensagem do formulário de suporte</strong> — responder a dúvida.
          </li>
        </ul>
        <p>Não vendemos lista de cliente. Não usamos os dados para propaganda de terceiro.</p>

        <h2>3. Cookies e scripts</h2>
        <p>
          O banner “Aceitar cookies” é código próprio, <strong>open source, licença MIT</strong>.
          Até você aceitar:
        </p>
        <ul>
          <li>não carregamos fontes do Google;</li>
          <li>não liberamos scripts e efeitos da interface além do necessário ao banner;</li>
          <li>não enviamos o ping de visita do log de acesso.</li>
        </ul>
        <p>
          Chamadas de API que você mesmo dispara depois (login, compra) geram log de acesso no
          servidor por motivo de segurança.
        </p>

        <h2>4. Base legal</h2>
        <p>
          Execução de contrato (key, pagamento, app). Consentimento (cookies não essenciais e
          visita). Legítimo interesse / obrigação legal (log de acesso, fraude, defesa em processo).
        </p>

        <h2 id="exclusao">5. Direito de exclusão — apaga o dado inteiro</h2>
        <p>
          Se você pedir, apagamos <strong>a conta e o restante</strong>: licenças, dispositivos,
          ativações, pedidos, pagamentos ligados, histórico de otimização, análises de segurança,
          logs daquela key/usuário e registros de acesso com o seu user id.
        </p>
        <p>
          Não fica “conta desativada com os dados no fundo”. O que sobra é só um comprovante interno
          sem nome: data da exclusão + hash do e-mail, para provar que o pedido foi cumprido.
        </p>
        <p>Como pedir:</p>
        <ul>
          <li>
            no site, em <Link to="/conta">Minha conta</Link> → “Apagar todos os meus dados”;
          </li>
          <li>no aplicativo, em Configurações → Privacidade;</li>
          <li>
            pelo <Link to="/suporte">suporte</Link>, informando a key.
          </li>
        </ul>
        <p>
          O gateway de pagamento pode conservar comprovantes fiscais pelo prazo da lei — isso não
          fica no nosso cadastro seu.
        </p>

        <h2>6. Quanto tempo fica</h2>
        <p>
          Enquanto a conta/key existir. Log de acesso: até 12 meses, salvo investigação em curso.
          Depois da exclusão, só o comprovante sem identificação direta.
        </p>

        <h2>7. Onde processa</h2>
        <p>
          Servidores de aplicação e banco usados pelo site (hospedagem do Orion). O app fala com essa
          API para validar a key.
        </p>

        <h2>8. Seus outros direitos</h2>
        <p>
          Acesso, correção, oposição e portabilidade: peça no suporte. Resposta em até 15 dias
          úteis.
        </p>
      </div>
    </section>
  );
}
