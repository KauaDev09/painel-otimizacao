import React from 'react';
import { LifeBuoy, HelpCircle, Server, Info, ExternalLink, RefreshCcw, ChevronDown, MessageCircle, X } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

interface AppMetaInfo {
  appName?: string;
  version?: string;
  officialUrl?: string;
  buildDate?: string;
  electron?: string;
  node?: string;
}

interface HealthResult {
  online?: boolean;
  ok?: boolean;
  api?: string;
  license?: string;
}

interface LocalApi {
  appHealth(): Promise<HealthResult | null>;
  getAppMeta(): Promise<AppMetaInfo | undefined>;
  openExternal(url: string): Promise<void>;
}

type Health = 'unknown' | 'online' | 'offline';

// FAQ copiado do legado (#view-support em index.html).
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Preciso de uma licença para usar o aplicativo?',
    a: 'Sim. O acesso ao Orion exige uma Key válida, adquirida na Orion Store e validada com segurança no servidor. Sem Key, o painel não é liberado.',
  },
  {
    q: 'Por que algumas otimizações pedem senha de administrador?',
    a: 'Alterações no registro e nos serviços do Windows exigem permissão de administrador. O aplicativo agrupa tudo em um único pedido de UAC, com backup prévio para permitir desfazer.',
  },
  {
    q: 'As otimizações podem ser revertidas?',
    a: 'Sim. Itens com backup do registro podem ser revertidos individualmente na aba Restauração. Limpezas de arquivos apagam definitivamente e não são reversíveis — isso é sempre avisado antes.',
  },
  {
    q: 'A análise altera alguma configuração da BIOS?',
    a: 'A análise é somente leitura. Aplicações automáticas só ocorrem quando existe um método documentado e verificável, sempre com confirmação. Sem suporte seguro, o Orion mostra o guia de configuração manual — nunca finge que aplicou algo.',
  },
  {
    q: 'Posso usar em mais de um computador?',
    a: 'Cada licença possui um limite de dispositivos definido na compra. Ativar em outra máquina usa uma das vagas — o suporte pode liberar dispositivos antigos.',
  },
  {
    q: 'O Monitor mostra temperatura?',
    a: 'Somente quando o fabricante expõe os sensores ACPI ao Windows. Quando não há sensor disponível, o campo fica como indisponível — nunca inventamos valores.',
  },
  {
    q: 'O Benchmark promete aumento de FPS?',
    a: 'Não. O benchmark mede CPU, memória e disco com cargas reais e serve para comparar antes/depois das otimizações neste mesmo aplicativo.',
  },
];

function isOnline(r: HealthResult | null | undefined): boolean {
  if (!r) return false;
  if (typeof r.online === 'boolean') return r.online;
  if (typeof r.ok === 'boolean') return r.ok;
  return r.api === 'online';
}

function errMsg(err: unknown, fallback: string): string {
  const m = (err as { message?: string })?.message;
  return m ? String(m) : fallback;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Suporte({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;
  const [meta, setMeta] = React.useState<AppMetaInfo | null>(null);
  const [health, setHealth] = React.useState<Health>('unknown');
  const [checking, setChecking] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<number | null>(0);
  const [toast, setToast] = React.useState<string | null>(null);
  const alive = React.useRef(true);

  const checkHealth = React.useCallback(async () => {
    setChecking(true);
    setHealth('unknown');
    try {
      const r = await api.appHealth();
      if (!alive.current) return;
      setHealth(isOnline(r) ? 'online' : 'offline');
    } catch {
      if (!alive.current) return;
      setHealth('offline');
    }
    if (alive.current) {
      setCheckedAt(new Date().toLocaleTimeString('pt-BR'));
      setChecking(false);
    }
  }, [api]);

  React.useEffect(() => {
    alive.current = true;
    api.getAppMeta?.().then((m) => { if (alive.current && m) setMeta(m); }).catch(() => {});
    checkHealth();
    return () => { alive.current = false; };
  }, [api, checkHealth]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const contact = async () => {
    const url = meta?.officialUrl;
    if (!url) {
      setToast('URL de suporte ainda não configurada.');
      return;
    }
    try {
      await api.openExternal(url);
    } catch (err) {
      setToast(errMsg(err, 'Não foi possível abrir o link de suporte.'));
    }
  };

  const primaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';

  const healthLabel = health === 'online' ? 'Online' : health === 'offline' ? 'Offline' : 'Verificando…';
  const healthDot = health === 'online' ? 'bg-green-500' : health === 'offline' ? 'bg-red-400' : 'bg-muted-foreground animate-pulse';
  const healthText = health === 'online' ? 'text-green-400' : health === 'offline' ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Suporte</h2>
          <p className="mt-1 text-sm text-muted-foreground">Perguntas frequentes, status do serviço e contato com o suporte oficial.</p>
        </div>
        <button type="button" onClick={contact} className={primaryBtn}>
          <MessageCircle className="h-4 w-4" />
          ABRIR PÁGINA DE SUPORTE
        </button>
      </div>

      {toast && (
        <div className="flex items-center gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* FAQ */}
        <div className="lg:col-span-2">
          <Section title="Perguntas frequentes" icon={<HelpCircle className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <div className="divide-y divide-[var(--orion-selected-bg)]">
              {FAQ.map((item, i) => {
                const isOpen = open === i;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-[var(--orion-hover-fg)]"
                    >
                      <span className={`flex-1 text-sm font-medium ${isOpen ? 'text-[var(--orion-icon-active)]' : 'text-foreground'}`}>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--orion-icon-default)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && <p className="m-0 pb-3 pr-8 text-sm leading-relaxed text-muted-foreground">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Coluna direita */}
        <div className="space-y-5">
          {/* Status do serviço */}
          <Section title="Status do serviço" icon={<Server className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Licenciamento/API</span>
              <span className={`inline-flex items-center gap-2 font-medium ${healthText}`}>
                <span className={`h-2 w-2 rounded-full ${healthDot}`} />
                {healthLabel}
              </span>
            </div>
            {checkedAt && <p className="m-0 mt-1 text-xs text-muted-foreground">Última verificação: {checkedAt}</p>}
            {health === 'offline' && (
              <p className="m-0 mt-2 text-xs text-muted-foreground">
                Sem conexão com o servidor. A licença continua válida em modo offline por um período de tolerância.
              </p>
            )}
            <button type="button" onClick={checkHealth} disabled={checking} className={`mt-3 w-full justify-center ${secondaryBtn}`}>
              <RefreshCcw className={'h-4 w-4 ' + (checking ? 'animate-spin' : '')} />
              {checking ? 'Verificando…' : 'TESTAR NOVAMENTE'}
            </button>
          </Section>

          {/* Informações da versão */}
          <Section title="Informações da versão" icon={<Info className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <InfoRow label="Aplicativo" value={meta?.appName || 'ORION OPTIMIZER'} />
            <InfoRow label="Versão instalada" value={meta?.version ? `v${meta.version}` : '—'} />
            <InfoRow label="Modo de análise" value="Somente leitura (BIOS) · reversível (Windows)" />
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('settings')} className="mt-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:text-[var(--orion-hover-fg)]">
                Verificar atualizações em Configurações →
              </button>
            )}
          </Section>

          {/* Contato */}
          <Section title="Contato" icon={<LifeBuoy className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <p className="m-0 mb-3 text-sm text-muted-foreground">
              Precisa de ajuda com licença, ativação ou reembolso? Fale com o suporte oficial.
            </p>
            <button type="button" onClick={contact} className={`w-full justify-center ${primaryBtn}`}>
              <ExternalLink className="h-4 w-4" />
              ABRIR PÁGINA DE SUPORTE
            </button>
            {meta?.officialUrl && (
              <p className="m-0 mt-2 truncate text-center text-xs text-muted-foreground" title={meta.officialUrl}>
                {meta.officialUrl}
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
