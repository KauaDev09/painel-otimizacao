import React from 'react';
import { Rocket, Send, Sparkles, type LucideIcon } from 'lucide-react';
import { useApi } from '@/api';
import { Sparkline } from '@/components/Sparkline';
import type { MonitorSnapshot, SeveniaChatMessage, SeveniaUsage } from '@/api/types';

interface LiveCardProps {
  icon: LucideIcon | null;
  title: string;
  value: string;
  unit: string;
  desc: string;
  hist: number[];
}

function LiveCard({ icon: Icon, title, value, unit, desc, hist }: LiveCardProps) {
  return (
    <div className="s4-glass p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        <span>{title}</span>
      </div>
      <div className="mb-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
        <small className="ml-1 text-sm font-medium text-muted-foreground">{unit}</small>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{desc}</div>
      <div className="h-8 overflow-hidden">
        <Sparkline values={hist.slice(-40)} width={220} height={32} />
      </div>
    </div>
  );
}

function gpuPercent(snap: MonitorSnapshot | null): number | null {
  const gpu = snap?.gpu;
  if (!gpu) return null;
  if (typeof gpu.percent === 'number' && Number.isFinite(gpu.percent)) return Math.round(gpu.percent);
  if (typeof gpu.usagePercent === 'number' && Number.isFinite(gpu.usagePercent)) return Math.round(gpu.usagePercent);
  if (typeof gpu.vramUsedMB === 'number' && typeof gpu.vramTotalMB === 'number' && gpu.vramTotalMB > 0) {
    return Math.round((gpu.vramUsedMB / gpu.vramTotalMB) * 100);
  }
  return null;
}

function tempLabel(snap: MonitorSnapshot | null): string {
  if (snap?.tempC == null) return 'Sensor indisponível';
  if (snap.tempSource === 'gpu') return 'Temperatura GPU';
  if (snap.tempSource === 'lhm') return 'Sensor hardware';
  if (snap.tempSource === 'acpi') return 'Sensor ACPI';
  return 'Sensor do sistema';
}

interface HomeProps {
  onNavigate: (view: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const api = useApi();
  const [snap, setSnap] = React.useState<MonitorSnapshot | null>(null);
  const hist = React.useRef<{ cpu: number[]; gpu: number[]; ram: number[]; disk: number[]; temp: number[] }>({
    cpu: [],
    gpu: [],
    ram: [],
    disk: [],
    temp: [],
  });
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const push = (key: 'cpu' | 'gpu' | 'ram' | 'disk' | 'temp', v: number | null | undefined) => {
    if (!Number.isFinite(v)) return;
    const arr = hist.current[key];
    arr.push(v as number);
    if (arr.length > 40) arr.shift();
  };

  React.useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.monitorSnapshot();
        if (!alive) return;
        setSnap(s);
        push('cpu', s?.cpu);
        const gp = gpuPercent(s);
        push('gpu', gp);
        push('ram', s?.ramPercent);
        push('disk', s?.diskPercent);
        push('temp', s?.tempC);
        force();
      } catch {
        /* silencioso */
      }
    };
    let inFlight = false;
    const safeTick = async () => {
      if (inFlight) return;
      inFlight = true;
      try { await tick(); } finally { inFlight = false; }
    };
    safeTick();
    const t = setInterval(safeTick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const cpu = snap?.cpu != null ? Math.round(snap.cpu) : '—';
  const gpu = gpuPercent(snap);
  const temp = snap?.tempC != null ? Math.round(snap.tempC) : '—';
  const ramUsed = snap?.ramUsedMB != null ? `${(snap.ramUsedMB / 1024).toFixed(1)} GB usados` : 'Uso atual';

  return (
    <div className="view-appear space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--s4-lime,#4ade80)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--s4-lime,#4ade80)] shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            System Secure · Monitoramento ao vivo
          </div>
          <h2 className="m-0 text-2xl font-bold tracking-tight text-foreground">Dashboard do sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Telemetria em tempo real — CPU, GPU, memória e temperatura no mesmo painel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('optimize')}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Rocket className="h-4 w-4" />
          OTIMIZAÇÃO RÁPIDA
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <LiveCard icon={null} title="CPU" value={String(cpu)} unit="%" desc="Uso atual" hist={hist.current.cpu} />
        <LiveCard
          icon={null}
          title="GPU"
          value={gpu != null ? String(gpu) : '—'}
          unit="%"
          desc={
            gpu != null
              ? (snap?.gpu?.label ? String(snap.gpu.label) : 'Uso atual')
              : 'Indisponível'
          }
          hist={hist.current.gpu}
        />
        <LiveCard icon={null} title="RAM" value={snap?.ramPercent != null ? String(Math.round(snap.ramPercent)) : '—'} unit="%" desc={ramUsed} hist={hist.current.ram} />
        <LiveCard icon={null} title="Disco" value={snap?.diskPercent != null ? String(Math.round(snap.diskPercent)) : '—'} unit="%" desc="Atividade do disco" hist={hist.current.disk} />
        <LiveCard icon={null} title="Temperatura" value={String(temp)} unit="°C" desc={tempLabel(snap)} hist={hist.current.temp} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recursos do Sistema
          </div>
          <div className="s4-glass p-5">
            {(['cpu', 'gpu', 'ram'] as const).map((k) => {
              const values = hist.current[k];
              const last = values.length ? Math.round(values[values.length - 1]) : 0;
              return (
                <div key={k} className="flex items-center gap-4 py-2">
                  <div className="w-10 text-xs font-semibold uppercase text-foreground">{k}</div>
                  <div className="h-11 flex-1 overflow-hidden">
                    <Sparkline values={values.length ? values : [0, 0]} width={300} height={44} />
                  </div>
                  <div className="w-12 text-right text-sm font-medium text-foreground">{last}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informações do Sistema
          </div>
          <div className="s4-glass p-5">
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Visão detalhada do hardware, firmware, saúde do sistema e recomendações.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--s4-icon-active)] transition-colors hover:text-[var(--s4-hover-fg)]"
            >
              Abrir Diagnóstico do Sistema
            </button>
          </div>
        </div>
      </div>

      <SeveniaPanel api={api} />
    </div>
  );
}

const CHAT_SUGGESTIONS = [
  'O que devo otimizar agora?',
  'Como melhorar meu FPS?',
  'Sugira uma limpeza segura',
  'Leia o laudo do sistema',
];

function SeveniaPanel({ api }: { api: ReturnType<typeof useApi> }) {
  const [messages, setMessages] = React.useState<SeveniaChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [usage, setUsage] = React.useState<SeveniaUsage | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [err, setErr] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    api
      .seveniaUsage()
      .then((r) => {
        if (r.ok && r.usage) setUsage(r.usage);
        else if (r.offline) setOffline(true);
      })
      .catch((e: { code?: string }) => {
        if (e.code === 'LICENSE_REQUIRED') {
          setErr('Ative sua licença na aba Licença para usar a SevenIA.');
        }
      });
  }, [api]);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(preset?: string) {
    const text = (preset || input).trim();
    if (!text || sending) return;
    const history = messages.slice(-12);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setErr('');
    setSending(true);
    try {
      const res = await api.seveniaChat({ message: text, history });
      if (res.ok && res.reply) {
        setMessages((m) => [...m, { role: 'assistant', content: res.reply as string }]);
        if (res.usage) setUsage(res.usage);
      } else {
        setErr('A SevenIA não retornou resposta.');
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      const map: Record<string, string> = {
        LICENSE_REQUIRED: 'Ative sua licença na aba Licença para usar a SevenIA.',
        SEVENIA_QUOTA: 'Limite diário de mensagens atingido. Volte amanhã ou ative a SevenIA Pro.',
        RATE_LIMITED: 'Muitas mensagens em sequência. Aguarde um instante.',
        NETWORK_ERROR: 'Sem conexão com o servidor da SevenIA. Verifique sua internet.',
        SEVENIA_NOT_CONFIGURED: 'A SevenIA ainda não está configurada no servidor.',
      };
      setErr((code && map[code]) || (e as { message?: string }).message || 'Não foi possível falar com a SevenIA.');
    } finally {
      setSending(false);
    }
  }

  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const isPro = usage?.plan === 'pro';

  return (
    <div className="s4-glass p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--s4-accent,#ff3b3f)]" />
          <span className="text-sm font-semibold text-foreground">SevenIA — Assistente de IA</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isPro
                ? 'bg-[rgba(34,197,94,0.15)] text-[var(--s4-lime,#4ade80)]'
                : 'bg-[rgba(255,255,255,0.08)] text-muted-foreground'
            }`}
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {offline ? 'Offline — sem conexão com o servidor' : `${used} de ${limit} mensagens hoje`}
        </div>
      </div>

      <div
        ref={listRef}
        className="mb-3 max-h-[300px] min-h-[120px] space-y-2 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-3"
      >
        {!messages.length && !err ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            Pergunte sobre otimização do sistema, laudos, FPS, limpeza segura e muito mais.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-white/5 text-foreground'
              }`}
            >
              {m.content}
            </div>
          ))
        )}
        {err && (
          <div className="rounded-lg bg-[rgba(255,59,63,0.08)] px-3 py-2 text-[12px] text-[var(--s4-outline,#ff6b6b)]">
            {err}
          </div>
        )}
        {sending && (
          <div className="flex items-center gap-2 px-1 py-1 text-[12px] text-muted-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            SevenIA pensando...
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={4000}
          placeholder="Pergunte para a SevenIA..."
          className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--s4-accent,#ff3b3f)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            disabled={sending}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}