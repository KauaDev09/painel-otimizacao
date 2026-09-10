import { Link } from 'react-router-dom';
import DashboardMockup from '../components/DashboardMockup';
import DownloadPanel from '../components/DownloadPanel';
import Faq from '../components/Faq';
import PlansGrid from '../components/PlansGrid';
import Reveal from '../components/Reveal';

const homeFaq = [
  {
    question: 'O instalador é gratuito?',
    answer:
      'Sim. O painel só abre com uma key válida, adquirida nos planos. Sem key não existe modo limitado.',
  },
  {
    question: 'Funciona no Windows 10?',
    answer: 'Sim. Windows 10 e 11, 64 bits. Não roda em 32 bits.',
  },
  {
    question: 'Ele altera arquivos protegidos do sistema?',
    answer:
      'Altera configurações do Windows de forma controlada e reversível. Quando o risco da BIOS sobe, o modo fica em leitura. Sem ativador e sem crack.',
  },
  {
    question: 'E se eu não gostar do resultado?',
    answer:
      'O histórico do app restaura o item. O ponto de restauração do Windows continua disponível, mas não é o único caminho.',
  },
  {
    question: 'A GPU não aparece. É falha do Orion?',
    answer:
      'A versão atual lê NVIDIA pelo nvidia-smi (mesmo fora do PATH) e AMD/Intel pelo Windows. Adaptador básico ou remoto é ignorado de propósito.',
  },
  {
    question: 'Como a licença é entregue?',
    answer: (
      <>
        Após a confirmação do pagamento. Cole a key no login do aplicativo.{' '}
        <Link to="/planos">Ver planos</Link>.
      </>
    ),
  },
];

export default function Home() {
  return (
    <>
      <header className="hero">
        <div className="container hero-grid">
          <div>
            <div className="hero-badge">Windows 10/11, leitura direta de hardware</div>
            <h1>O laudo do seu PC, não um score inventado.</h1>
            <p className="sub">
              Cada ajuste mostra o risco antes de aplicar. Você decide item por item, não pacote
              fechado.
            </p>
            <div className="hero-ctas">
              <Link to="/download" className="btn btn-lg btn-primary">
                Baixar instalador
              </Link>
              <Link to="/#produto" className="btn btn-lg btn-ghost">
                Ver o painel
              </Link>
            </div>
          </div>
          <DashboardMockup />
        </div>
      </header>

      <section className="section" id="produto">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">O painel</div>
            <h2>Seis áreas. Uma licença. Risco visível antes de aplicar.</h2>
            <p>
              Ferramenta de diagnóstico e ajuste — não um “pacote milagroso”. O que importa fica em
              destaque; o resto fica quieto.
            </p>
          </Reveal>
          <div className="feature-grid">
            <Reveal as="article" className="feature-card lead">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3.5" width="18" height="17" rx="2.4" />
                  <path d="M3 8h18" />
                  <path d="M6.5 12h5.2M6.5 15.6h5.2" />
                </svg>
              </div>
              <h3>Windows com controle</h3>
              <p>
                Serviços, telemetria, efeitos e energia. Cada item declara o risco antes de aplicar.
                Alterações que podem afetar o boot exigem confirmação explícita — o núcleo do
                produto.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card side">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7.15 8.7h9.7c2.15 0 3.55 2.05 2.95 4.05l-1.05 3.45a2.15 2.15 0 0 1-2.3 1.45H15l-1.15-2.05h-3.7L8.95 17.65H7.55a2.15 2.15 0 0 1-2.3-1.45L4.2 12.75c-.6-2 0.8-4.05 2.95-4.05Z" />
                </svg>
              </div>
              <h3>Modo jogo</h3>
              <p>
                Prioridade no processo, menos overlay e menos segundo plano. Competitivo, FiveM e o
                restante da biblioteca.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card side">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5.5" width="18" height="11.2" rx="1.8" />
                  <circle cx="16.15" cy="11.1" r="2.35" />
                </svg>
              </div>
              <h3>GPU de verdade</h3>
              <p>
                NVIDIA, AMD ou Intel. Uso ao vivo, inclusive quando o nvidia-smi não está no PATH.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card mid">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3.5" y="4.8" width="17" height="14.4" rx="2" />
                  <path d="M3.5 9h17" />
                </svg>
              </div>
              <h3>Limpeza segura</h3>
              <p>
                Temporários, cache e restos de instalador. Sem limpeza mágica de registro e sem
                apagar saves.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card narrow">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8.1" cy="12" r="5.15" />
                  <path d="M8.1 8.55v4.05" />
                  <path d="M15.2 8.2h6.1M15.2 12h6.1M15.2 15.8h4.3" />
                </svg>
              </div>
              <h3>Inicialização</h3>
              <p>O que sobe com o Windows, em lista. Ative ou desative sem abrir o Gerenciador.</p>
            </Reveal>
            <Reveal as="article" className="feature-card wide">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.4" />
                  <rect x="8.6" y="8.6" width="6.8" height="6.8" rx=".7" />
                </svg>
              </div>
              <h3>BIOS e memória</h3>
              <p>
                Leitura e perfis. O Orion não flasheia a BIOS: mostra o que está ligado e o que vale
                ajustar — quando o risco sobe, fica em modo leitura.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt" id="como-funciona">
        <div className="container flow">
          <Reveal className="section-head" style={{ marginBottom: 0 }}>
            <div className="kicker">Como funciona</div>
            <h2>Quatro passos. Sem assistente de 19 telas.</h2>
            <p>
              Analisa. Você escolhe. Aplica. Acompanha os medidores. Se não gostou, desfaz o item.
            </p>
          </Reveal>
          <div className="steps">
            {[
              ['01', 'Lê a máquina', 'Hardware, inicialização e serviços. Sem score inventado.'],
              [
                '02',
                'Você escolhe',
                'Nada é aplicado sozinho. Itens de maior impacto pedem confirmação explícita.',
              ],
              [
                '03',
                'Aplica e registra',
                'O histórico fica no painel. Você restaura o item — não precisa restaurar o Windows inteiro.',
              ],
              [
                '04',
                'Acompanha',
                'CPU, GPU, RAM e temperatura no mesmo lugar. Se a GPU não aparecer, o Orion tenta outra fonte.',
              ],
            ].map(([num, title, text]) => (
              <Reveal key={num} className="step">
                <div className="num">{num}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container flow">
          <Reveal className="section-head" style={{ marginBottom: 0 }}>
            <div className="kicker">Diagnóstico</div>
            <h2>Primeiro o laudo. Depois o bisturi.</h2>
            <p>
              Essa tela é o recorte do que o app monta a partir do seu hardware — não um print
              inventado de marketing.
            </p>
          </Reveal>
          <Reveal className="diag" data-spotlight>
            <div className="diag-head">
              <span className="mono">Análise do sistema</span>
              <div className="score">
                <div className="diag-score">
                  <span className="mono">82</span>
                  <span className="of">/100</span>
                </div>
              </div>
            </div>
            {[
              ['CPU', 'identificada no WMI', 'ok'],
              ['GPU', 'NVIDIA / AMD / Intel + uso ao vivo', 'ok'],
              ['Memória', 'ocupação e XMP quando existir', 'olhar'],
              ['Inicialização', 'o que sobe sem você pedir', 'cortar'],
              ['Windows', 'energia, visual, segundo plano', 'ajustável'],
            ].map(([k, sub, st]) => (
              <div key={k} className="diag-row">
                <div className="d">
                  <span className="k">
                    {k} <span className="sub">{sub}</span>
                  </span>
                </div>
                <span className={`st-o ${st === 'ok' || st === 'ajustável' ? 'ok' : 'warn'}`}>
                  {st}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section section-alt" id="recursos">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Controle</div>
            <h2>Se algo sair do esperado, você desfaz. Se for arriscado, o app avisa.</h2>
          </Reveal>
          <div className="trust-grid">
            <Reveal className="trust" data-spotlight data-glare>
              <h3>
                <span className="ti" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 4.5h5.2L18 9.2V19a1.6 1.6 0 0 1-1.6 1.6H8A1.6 1.6 0 0 1 6.4 19V6.1A1.6 1.6 0 0 1 8 4.5Z" />
                    <path d="M13 4.6v3.8A1.2 1.2 0 0 0 14.2 9.6H18" />
                    <path d="M9.2 13.2h5.8M9.2 16.1h3.8" />
                  </svg>
                </span>
                Nada escondido
              </h3>
              <p>
                Risco, reinício e impacto aparecem antes. Ajustes que podem interromper o PC pedem
                confirmação. Sem letra miúda.
              </p>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Descrição por ajuste, não por “pacote”
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Impacto por categoria
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Status depois de aplicar
                </li>
              </ul>
            </Reveal>
            <Reveal className="trust" data-spotlight>
              <h3>
                <span className="ti" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4.6 11.2A7.4 7.4 0 1 0 12 4.6" />
                    <path d="M4.6 6.2v5h5" />
                  </svg>
                </span>
                Restauração por item
              </h3>
              <p>
                O histórico do painel desfaz a operação. Restaurar o sistema inteiro não é o único
                plano B.
              </p>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Por operação
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Sem wipe do disco
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  BIOS em modo leitura quando o risco sobe
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Onde roda</div>
            <h2>Feito no Windows. Para o Windows.</h2>
          </Reveal>
          <div className="compat">
            {[
              ['Windows 10', '64 bits · 150 MB de disco'],
              ['Windows 11', '64 bits · internet só na ativação'],
            ].map(([title, desc]) => (
              <Reveal key={title} className="compat-card" data-spotlight>
                <div className="oslog">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 5.6 10.5 4.5v6.6H3V5.6zM11.7 4.4 21 3v8.1h-9.3V4.4zM3 12.9h7.5v6.6L3 18.4v-5.5zM11.7 12.3H21V21l-9.3-1.5v-7.2z" />
                  </svg>
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal as="p" className="compat-note">
            2 GB de RAM livres. Sem driver adicional. Sem runtime extra além do próprio instalador.
          </Reveal>
        </div>
      </section>

      <section className="section section-alt" id="planos">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Licença</div>
            <h2>Escolha o plano. Receba a key.</h2>
            <p>
              PIX ou cartão. A chave é liberada após a confirmação do pagamento — sem fila de
              atendimento.
            </p>
          </Reveal>
          <PlansGrid />
          <p className="plans-footnote">O instalador é público. A key destrava o painel.</p>
        </div>
      </section>

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

      <section className="section section-alt" id="faq">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Perguntas frequentes</div>
            <h2>O que o suporte mais responde.</h2>
          </Reveal>
          <Faq items={homeFaq} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band" data-spotlight>
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Pronto
              </div>
              <h2>Menos ruído. Mais desempenho.</h2>
              <p>
                Baixe, cole a key e rode a análise. Em poucos minutos o painel mostra o que vale
                ajustar.
              </p>
            </div>
            <Link to="/download" className="btn btn-lg btn-primary" data-magnet="12">
              Baixar instalador
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
