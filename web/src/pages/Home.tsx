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
      'Sim. O download é público. O painel completo exige uma key válida, adquirida em um dos planos. Não há modo de avaliação.',
  },
  {
    question: 'Quais versões do Windows são suportadas?',
    answer: 'Windows 10 e Windows 11, edições 64 bits. Não há suporte a 32 bits.',
  },
  {
    question: 'O software altera arquivos protegidos do sistema?',
    answer:
      'Ele modifica configurações e serviços do Windows de forma documentada e, sempre que possível, reversível. O módulo de BIOS permanece em modo somente leitura. Não inclui ativador, crack ou bypass de licença da Microsoft.',
  },
  {
    question: 'Como desfazer uma otimização?',
    answer:
      'Pelo histórico do aplicativo, operação a operação. O ponto de restauração do Windows continua disponível como recurso complementar.',
  },
  {
    question: 'A GPU não aparece no painel. Por quê?',
    answer:
      'NVIDIA é lida via nvidia-smi (mesmo fora do PATH). AMD e Intel usam as APIs do Windows. Adaptadores básicos, virtuais ou de sessão remota são omitidos de propósito.',
  },
  {
    question: 'Quando recebo a key?',
    answer: (
      <>
        Assim que o pagamento for confirmado. A key é usada na tela de login do aplicativo.{' '}
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
            <div className="hero-badge">Windows 10 e 11 · 64 bits</div>
            <h1>
              Diagnóstico e otimização para{' '}
              <span className="accent-word">Windows</span>
            </h1>
            <p className="sub">
              SevenOptimizer lê o hardware e a configuração do sistema, organiza os ajustes por módulo e
              aplica somente o que você autorizar — com histórico para desfazer quando quiser.
            </p>
            <div className="hero-ctas">
              <Link to="/download" className="btn btn-lg btn-primary">
                Baixar instalador
              </Link>
              <Link to="/#produto" className="btn btn-lg btn-ghost">
                Conhecer o painel
              </Link>
            </div>
          </div>
          <DashboardMockup />
        </div>
      </header>

      <section className="section" id="produto">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Módulos</div>
            <h2>Um painel. Seis módulos de trabalho.</h2>
            <p>
              Cada módulo cobre uma área do sistema. A licença libera o conjunto; você escolhe o que
              aplicar.
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
              <h3>Configuração do Windows</h3>
              <p>
                Serviços, telemetria, efeitos visuais e plano de energia. Cada item traz descrição
                clara do que muda — e você decide o que aplicar.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card side">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7.15 8.7h9.7c2.15 0 3.55 2.05 2.95 4.05l-1.05 3.45a2.15 2.15 0 0 1-2.3 1.45H15l-1.15-2.05h-3.7L8.95 17.65H7.55a2.15 2.15 0 0 1-2.3-1.45L4.2 12.75c-.6-2 0.8-4.05 2.95-4.05Z" />
                </svg>
              </div>
              <h3>Prioridade para jogos</h3>
              <p>
                Ajuste de prioridade de processo, redução de overlays e processos em segundo plano.
                Adequado a títulos competitivos, FiveM e uso geral de biblioteca.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card side">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5.5" width="18" height="11.2" rx="1.8" />
                  <circle cx="16.15" cy="11.1" r="2.35" />
                </svg>
              </div>
              <h3>Monitoramento de GPU</h3>
              <p>
                Leitura de uso em tempo real para NVIDIA, AMD e Intel, incluindo cenários em que o
                nvidia-smi não está no PATH do sistema.
              </p>
            </Reveal>
            <Reveal as="article" className="feature-card mid">
              <div className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3.5" y="4.8" width="17" height="14.4" rx="2" />
                  <path d="M3.5 9h17" />
                </svg>
              </div>
              <h3>Limpeza de arquivos temporários</h3>
              <p>
                Remove caches, temporários e resíduos de instaladores. Não executa “limpeza de
                registro” destrutiva nem apaga saves de jogos.
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
              <p>
                Lista programas e tarefas que sobem com o Windows. Ative ou desative sem abrir o
                Gerenciador de Tarefas.
              </p>
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
                Leitura de parâmetros e perfil de memória. O SevenOptimizer não grava firmware: mostra o
                que está ativo e o que pode ser revisado manualmente no setup.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-alt" id="como-funciona">
        <div className="container flow">
          <Reveal className="section-head" style={{ marginBottom: 0 }}>
            <div className="kicker">Fluxo de trabalho</div>
            <h2>Quatro etapas, do laudo à aplicação.</h2>
            <p>
              Sem assistente longo e sem pacotes opacos. Você analisa, seleciona, aplica e
              acompanha.
            </p>
          </Reveal>
          <div className="steps">
            {[
              [
                '01',
                'Inventário do sistema',
                'Coleta de hardware, inicialização e serviços relevantes — sem nota genérica de “saúde do PC”.',
              ],
              [
                '02',
                'Seleção assistida',
                'Nenhuma otimização roda sozinha. Você marca os itens e confirma antes da execução.',
              ],
              [
                '03',
                'Aplicação registrada',
                'Cada operação entra no histórico do painel e pode ser revertida individualmente.',
              ],
              [
                '04',
                'Telemetria local',
                'CPU, GPU, memória e temperatura no mesmo lugar, para validar o efeito após a mudança.',
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
            <div className="kicker">Análise</div>
            <h2>Primeiro o diagnóstico. Depois a intervenção.</h2>
            <p>
              O recorte abaixo corresponde ao que o aplicativo monta a partir da máquina local —
              dados de sessão, não arte estático de marketing.
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
              ['CPU', 'identificação via WMI', 'ok'],
              ['GPU', 'fabricante + utilização em tempo real', 'ok'],
              ['Memória', 'ocupação e XMP, quando disponível', 'revisar'],
              ['Inicialização', 'itens além do essencial', 'reduzir'],
              ['Windows', 'energia, interface e segundo plano', 'ajustável'],
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
            <h2>Você escolhe o que aplicar. E pode desfazer depois.</h2>
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
                Ajustes com descrição clara
              </h3>
              <p>
                Cada operação mostra o que será alterado antes de rodar. Sem pacotes fechados e sem
                surpresa no final.
              </p>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Descrição por item, não por lote fechado
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Organização por categoria
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Status após a aplicação
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
                Histórico para desfazer
              </h3>
              <p>
                O painel registra cada operação. Se o resultado não agradar, você reverte o item —
                sem precisar restaurar o Windows inteiro.
              </p>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Reversão item a item
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  Sem formatação do disco
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  BIOS apenas em leitura no painel
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Compatibilidade</div>
            <h2>Ambiente suportado</h2>
          </Reveal>
          <div className="compat">
            {[
              ['Windows 10', '64 bits · cerca de 150 MB em disco'],
              ['Windows 11', '64 bits · conexão apenas na ativação da key'],
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
            Recomendado: 2 GB de RAM livres. Não exige driver proprietário adicional nem runtime
            externo além do instalador.
          </Reveal>
        </div>
      </section>

      <section className="section section-alt" id="planos">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Licenciamento</div>
            <h2>Planos mensais com entrega automática da key</h2>
            <p>
              Pagamento via PIX ou cartão. A chave é emitida após a confirmação do provedor de
              pagamento.
            </p>
          </Reveal>
          <PlansGrid />
          <p className="plans-footnote">
            O instalador é público. A key autoriza o uso do painel na máquina vinculada.
          </p>
        </div>
      </section>

      <section className="section" id="download">
        <div className="container">
          <Reveal className="section-head">
            <div className="kicker">Download</div>
            <h2>Instalador público. Ativação por licença.</h2>
            <p>
              Baixe sem cadastro. Sem a key, o painel permanece bloqueado até a validação da
              licença.
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
            <div className="kicker">FAQ</div>
            <h2>Perguntas técnicas frequentes</h2>
          </Reveal>
          <Faq items={homeFaq} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-band" data-spotlight>
            <div>
              <img
                className="brand-logo-full"
                src="/assets/s4-logo-horizontal-dark.png"
                alt="SevenOptimizer"
                style={{ height: 44, marginBottom: 16 }}
              />
              <div className="kicker" style={{ marginBottom: 12 }}>
                Próximo passo
              </div>
              <h2>Instale, ative e rode a análise inicial</h2>
              <p>
                Em poucos minutos o painel apresenta o inventário do sistema e as recomendações
                disponíveis para a sua configuração.
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
