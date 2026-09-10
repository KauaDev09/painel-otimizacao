import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Faq from '../components/Faq';
import Reveal from '../components/Reveal';
import { toast } from '../components/Toast';

const supportFaq = [
  {
    question: 'O instalador é gratuito?',
    answer:
      'Sim. O painel só abre com uma key válida, adquirida nos planos. Sem key não existe modo limitado.',
  },
  {
    question: 'A key não ativa. O que faço?',
    answer:
      'Confira espaços e hífens. Se o limite de dispositivos foi atingido, peça liberação no Discord com a key. Licença bloqueada também se resolve por lá.',
  },
  {
    question: 'Posso apagar todos os meus dados?',
    answer: (
      <>
        Sim. Na conta do site, nas Configurações do app ou por este formulário. O pedido apaga conta,
        key, dispositivos, pedidos e logs — não só o login.{' '}
        <Link to="/privacidade#exclusao">Política de exclusão</Link>.
      </>
    ),
  },
];

export default function Suporte() {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const n = (form.elements.namedItem('s-name') as HTMLInputElement).value.trim();
    const em = (form.elements.namedItem('s-email') as HTMLInputElement).value.trim();
    const m = (form.elements.namedItem('s-msg') as HTMLTextAreaElement).value.trim();
    if (!n || !em || !m) {
      toast('Preencha todos os campos.', 'err');
      return;
    }
    toast(
      'Mensagem registrada. Responderemos em breve — ou fale no Discord para urgência.',
      'ok',
    );
    form.reset();
  }

  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-head">
          <div className="kicker">Suporte</div>
          <h2>Como podemos ajudar?</h2>
          <p>
            Licença, instalação, pagamento ou exclusão de dados. O canal oficial é o Discord —
            resposta mais rápida pela comunidade e pela equipe.
          </p>
        </Reveal>

        <div className="support-grid">
          <Reveal className="discord-card" data-spotlight>
            <div className="discord-brand">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.3 4.37A19.8 19.8 0 0 0 15.89 3c-.2.36-.43.85-.59 1.23a18.3 18.3 0 0 0-6.6 0A12.4 12.4 0 0 0 8.1 3 19.7 19.7 0 0 0 3.68 4.39C.96 8.51.22 12.53.53 16.5A19.9 19.9 0 0 0 6.66 19c.36-.49.68-1.01.96-1.56a12.9 12.9 0 0 1-1.51-.73c.13-.09.25-.19.37-.29 2.92 1.36 6.08 1.36 8.96 0 .12.1.24.2.37.29-.48.28-.99.52-1.52.73.28.55.6 1.07.96 1.56a19.8 19.8 0 0 0 6.14-2.49c.36-4.61-.62-8.6-3.45-12.14ZM8.86 14.16c-.88 0-1.6-.82-1.6-1.82s.71-1.82 1.6-1.82 1.61.82 1.6 1.82-.71 1.82-1.6 1.82Zm6.28 0c-.88 0-1.6-.82-1.6-1.82s.71-1.82 1.6-1.82 1.61.82 1.6 1.82-.7 1.82-1.6 1.82Z" />
              </svg>
              Canal oficial
            </div>
            <h3>Entre no Discord</h3>
            <p>
              Ativação de key, dúvidas do painel e avisos de versão. Abra o servidor e descreva o
              que aconteceu — com a key, se for licença.
            </p>
            <a
              className="btn btn-primary btn-lg"
              href="https://discord.gg/e3jHfF7ANp"
              target="_blank"
              rel="noopener noreferrer"
              data-magnet="12"
            >
              Abrir Discord
            </a>
          </Reveal>

          <Reveal className="auth-wrap" style={{ maxWidth: 'none' }}>
            <h3>Enviar mensagem</h3>
            <p className="sub">
              Instalação, pagamento ou pedido para apagar <strong>todos</strong> os seus dados.{' '}
              <Link to="/privacidade#exclusao">Como funciona a exclusão</Link>.
            </p>
            <form id="support-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="s-name">Nome</label>
                <input id="s-name" name="s-name" placeholder="Seu nome" />
              </div>
              <div className="field">
                <label htmlFor="s-email">E-mail</label>
                <input id="s-email" name="s-email" type="email" placeholder="voce@email.com" />
              </div>
              <div className="field">
                <label htmlFor="s-msg">Mensagem</label>
                <textarea
                  id="s-msg"
                  name="s-msg"
                  rows={5}
                  placeholder="Descreva o que precisa, com o máximo de detalhe."
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                Enviar mensagem
              </button>
            </form>
            <div className="muted mt-2 text-center" style={{ fontSize: 14 }}>
              Resposta em até 24h úteis. Para urgência, use o Discord.
            </div>
          </Reveal>
        </div>

        <div className="support-faq">
          <Reveal className="section-head">
            <div className="kicker">Perguntas frequentes</div>
            <h2>Antes de abrir um ticket.</h2>
          </Reveal>
          <Faq items={supportFaq} />
        </div>
      </div>
    </section>
  );
}
