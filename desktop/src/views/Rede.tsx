import React from 'react';
import {
  Network,
  Wifi,
  Cable,
  Activity,
  Globe,
  Radio,
  RefreshCcw,
  Play,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowDown,
  ArrowUp,
  Server,
} from 'lucide-react';
import { useApi } from '@/api';
import { Sparkline } from '@/components/Sparkline';
import type { MonitorSnapshot } from '@/api/types';

// ---------------------------------------------------------------------------
// Tipos locais (métodos ainda não tipados em OrionApi)
// ---------------------------------------------------------------------------

interface NetAdapter {
  name?: string;
  description?: string;
  type?: string;
  speedMbps?: number | null;
  speed?: number | null; // formato do mock
  ip?: string | null;
  mac?: string | null;
}

interface NetworkInfo {
  adapters?: NetAdapter[];
  dnsServers?: string[];
}

interface PingResult {
  ok?: boolean;
  error?: string;
  host?: string;
  sent?: number;
  received?: number;
  lossPercent?: number;
  loss?: number; // formato do mock
  minMs?: number | null;
  avgMs?: number | null;
  maxMs?: number | null;
  jitterMs?: number | null;
}

interface DnsServerResult {
  server: string;
  address?: string | null;
  ms: number | null;
  ok: boolean;
}

interface DnsResult {
  domain?: string;
  results?: DnsServerResult[];
  // formato do mock
  server?: string;
  resolved?: boolean;
  timeMs?: number;
}

type Risk = 'low' | 'medium' | 'high' | string;

interface EngineItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  benefit?: string;
  risk?: Risk;
  riskLabel?: string;
  requiresAdmin?: boolean;
  confirm?: boolean;
  proOnly?: boolean;
  rebootRequired?: boolean;
  applied?: boolean;
  icon?: string;
}

interface EngineApplyResult {
  ok?: boolean;
  error?: string;
  launchError?: string | null;
  results?: { ok?: boolean; name?: string; message?: string }[];
}

interface EngineUndoResult {
  ok?: boolean;
  message?: string;
}

interface RedeApi {
  networkInfo(): Promise<NetworkInfo>;
  networkPingTest(opts: { host?: string; count?: number }): Promise<PingResult>;
  networkDnsTest(domain: string): Promise<DnsResult>;
  monitorSnapshot(): Promise<MonitorSnapshot>;
  engineListItems(): Promise<EngineItem[]>;
  engineApply(payload: { ids: string[]; label?: string }): Promise<EngineApplyResult>;
  engineUndoItem(id: string): Promise<EngineUndoResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PING_HOST = '1.1.1.1';
const DEFAULT_PING_COUNT = 10;
const DEFAULT_DNS_DOMAIN = 'google.com';
const POLL_MS = 2500;
const HIST_MAX = 40;

function dash(v: unknown): string {
  if (v == null || v === '' || v === false) return '—';
  return String(v);
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/** Mantém apenas caracteres válidos para host/domínio (mesma regra do backend). */
function sanitizeHost(v: string): string {
  return v.replace(/[^a-zA-Z0-9.\-]/g, '');
}

/** Formata kbps em kb/s ou Mb/s. */
function fmtKbps(v: number | null | undefined): { value: string; unit: string } {
  if (v == null || !Number.isFinite(v)) return { value: '—', unit: 'kb/s' };
  if (v >= 1000) return { value: (v / 1000).toFixed(v >= 10000 ? 0 : 1), unit: 'Mb/s' };
  return { value: Math.round(v).toString(), unit: 'kb/s' };
}

function latencyClass(ms: number | null | undefined): string {
  if (ms == null) return 'text-muted-foreground';
  return ms <= 30 ? 'text-green-400' : ms <= 80 ? 'text-amber-400' : 'text-red-400';
}

function lossClass(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground';
  return pct === 0 ? 'text-green-400' : pct <= 5 ? 'text-amber-400' : 'text-red-400';
}

function dnsClass(ms: number | null | undefined): string {
  if (ms == null) return 'text-muted-foreground';
  return ms <= 50 ? 'text-green-400' : ms <= 150 ? 'text-amber-400' : 'text-red-400';
}

const RISK_LABEL: Record<string, string> = { low: 'RISCO BAIXO', medium: 'RISCO MÉDIO', high: 'RISCO ALTO' };
const RISK_CLASS: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-red-500/15 text-red-400',
};

/** Normaliza o resultado do DNS test (backend real ou mock). */
function normalizeDns(r: DnsResult): { domain: string; results: DnsServerResult[] } {
  if (Array.isArray(r.results)) return { domain: r.domain || DEFAULT_DNS_DOMAIN, results: r.results };
  return {
    domain: r.domain || DEFAULT_DNS_DOMAIN,
    results: [{ server: r.server || 'DNS atual', address: r.server ?? null, ms: r.timeMs ?? null, ok: r.resolved !== false }],
  };
}

function isWireless(a: NetAdapter): boolean {
  const t = `${a.type || ''} ${a.name || ''} ${a.description || ''}`.toLowerCase();
  return /wi-?fi|wireless|802\.11|wlan/.test(t);
}

type Banner = { kind: 'ok' | 'warn' | 'error'; text: string };

type PendingAction = { type: 'apply'; item: EngineItem } | { type: 'undo'; item: EngineItem };

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Rede({ onNavigate }: { onNavigate?: (view: string) => void }) {
  void onNavigate;
  const api = useApi() as unknown as RedeApi;

  // Adaptadores
  const [info, setInfo] = React.useState<NetworkInfo | null>(null);
  const [infoLoading, setInfoLoading] = React.useState(false);
  const [infoError, setInfoError] = React.useState<string | null>(null);

  // Ping
  const [pingHost, setPingHost] = React.useState(DEFAULT_PING_HOST);
  const [pinging, setPinging] = React.useState(false);
  const [ping, setPing] = React.useState<PingResult | null>(null);
  const [pingError, setPingError] = React.useState<string | null>(null);

  // DNS
  const [dnsDomain, setDnsDomain] = React.useState(DEFAULT_DNS_DOMAIN);
  const [dnsTesting, setDnsTesting] = React.useState(false);
  const [dns, setDns] = React.useState<{ domain: string; results: DnsServerResult[] } | null>(null);
  const [dnsError, setDnsError] = React.useState<string | null>(null);

  // Tráfego ao vivo
  const [snap, setSnap] = React.useState<MonitorSnapshot | null>(null);
  const hist = React.useRef<{ rx: number[]; tx: number[] }>({ rx: [], tx: [] });
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  // Otimizações de rede
  const [items, setItems] = React.useState<EngineItem[]>([]);
  const [itemsError, setItemsError] = React.useState<string | null>(null);
  const [itemsLoading, setItemsLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingAction | null>(null);

  // Banner
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = React.useRef(true);

  const showBanner = React.useCallback((kind: Banner['kind'], text: string, ms = 8000) => {
    setBanner({ kind, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (alive.current) setBanner(null); }, ms);
  }, []);

  // ---- carregamentos ----
  const loadInfo = React.useCallback(async () => {
    setInfoLoading(true);
    try {
      const res = await api.networkInfo();
      if (!alive.current) return;
      setInfo(res || { adapters: [], dnsServers: [] });
      setInfoError(null);
    } catch (err) {
      if (!alive.current) return;
      setInfo(null);
      setInfoError(`Não foi possível ler os adaptadores: ${errMsg(err, 'erro desconhecido')}`);
    } finally {
      if (alive.current) setInfoLoading(false);
    }
  }, [api]);

  const loadItems = React.useCallback(async () => {
    setItemsLoading(true);
    try {
      const all = (await api.engineListItems()) ?? [];
      if (!alive.current) return;
      setItems((Array.isArray(all) ? all : []).filter((i) => i.category === 'rede'));
      setItemsError(null);
    } catch (err) {
      if (!alive.current) return;
      setItems([]);
      setItemsError(`Catálogo indisponível: ${errMsg(err, 'erro desconhecido')}`);
    } finally {
      if (alive.current) setItemsLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    alive.current = true;
    loadInfo();
    loadItems();

    const tick = async () => {
      try {
        const s = await api.monitorSnapshot();
        if (!alive.current) return;
        setSnap(s);
        const push = (arr: number[], v: number | null | undefined) => {
          if (v == null || !Number.isFinite(v)) return;
          arr.push(v);
          if (arr.length > HIST_MAX) arr.shift();
        };
        push(hist.current.rx, s?.netRxKbps);
        push(hist.current.tx, s?.netTxKbps);
        force();
      } catch { /* silencioso */ }
    };
    tick();
    const t = setInterval(tick, POLL_MS);

    return () => {
      alive.current = false;
      clearInterval(t);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [api, loadInfo, loadItems]);

  // ---- ações ----
  const runPing = async () => {
    if (pinging) return;
    const host = sanitizeHost(pingHost.trim()) || DEFAULT_PING_HOST;
    setPingHost(host);
    setPinging(true);
    setPingError(null);
    try {
      const r = await api.networkPingTest({ host, count: DEFAULT_PING_COUNT });
      if (!alive.current) return;
      if (r && r.ok === false) throw new Error(r.error || 'Falha no teste.');
      setPing({ ...r, host: r?.host || host });
    } catch (err) {
      if (!alive.current) return;
      setPing(null);
      setPingError(`Ping test falhou: ${errMsg(err, 'erro desconhecido')}`);
    } finally {
      if (alive.current) setPinging(false);
    }
  };

  const runDns = async () => {
    if (dnsTesting) return;
    const domain = sanitizeHost(dnsDomain.trim()) || DEFAULT_DNS_DOMAIN;
    setDnsDomain(domain);
    setDnsTesting(true);
    setDnsError(null);
    try {
      const r = await api.networkDnsTest(domain);
      if (!alive.current) return;
      if (!r) throw new Error('Sem resposta do teste.');
      setDns(normalizeDns({ ...r, domain: r.domain || domain }));
    } catch (err) {
      if (!alive.current) return;
      setDns(null);
      setDnsError(`DNS test falhou: ${errMsg(err, 'erro desconhecido')}`);
    } finally {
      if (alive.current) setDnsTesting(false);
    }
  };

  const requestApply = (item: EngineItem) => {
    if (busyId) return;
    // Mesma regra do legado: confirmação explícita para itens marcados ou de risco alto.
    if (item.confirm || item.risk === 'high') {
      setPending({ type: 'apply', item });
    } else {
      void doApply(item);
    }
  };

  const doApply = async (item: EngineItem) => {
    setPending(null);
    setBusyId(item.id);
    try {
      const res = await api.engineApply({ ids: [item.id], label: `Rede: ${item.name}` });
      if (!alive.current) return;
      const first = res?.results?.[0];
      const ok = !!(first && first.ok);
      if (ok) {
        showBanner('ok', `${item.name} aplicada.${item.rebootRequired ? ' Reinicie o PC para concluir.' : ''}`);
      } else {
        showBanner('warn', first?.message || res?.error || res?.launchError || 'Falha ao aplicar.');
      }
      await loadItems();
    } catch (err) {
      if (alive.current) showBanner('error', errMsg(err, 'Falha ao aplicar.'), 9000);
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const requestUndo = (item: EngineItem) => {
    if (busyId) return;
    setPending({ type: 'undo', item });
  };

  const doUndo = async (item: EngineItem) => {
    setPending(null);
    setBusyId(item.id);
    try {
      const r = await api.engineUndoItem(item.id);
      if (!alive.current) return;
      if (r?.ok) showBanner('ok', r.message || `${item.name} revertida.`);
      else showBanner('warn', r?.message || 'Não foi possível desfazer este item.');
      await loadItems();
    } catch (err) {
      if (alive.current) showBanner('error', errMsg(err, 'Falha ao desfazer.'), 9000);
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const adapters = info?.adapters ?? [];
  const dnsServers = info?.dnsServers ?? [];
  const rx = fmtKbps(snap?.netRxKbps);
  const tx = fmtKbps(snap?.netTxKbps);
  const netAvailable = snap?.netRxKbps != null || snap?.netTxKbps != null;

  return (
    <div className="view-appear space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Rede</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnóstico da conexão com medições reais — adaptadores, latência, DNS e tráfego ao vivo — e otimizações de
            rede do catálogo.
          </p>
        </div>
        <button
          type="button"
          onClick={loadInfo}
          disabled={infoLoading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
        >
          <RefreshCcw className={'h-4 w-4 ' + (infoLoading ? 'animate-spin' : '')} />
          {infoLoading ? 'Lendo…' : 'ATUALIZAR'}
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${
            banner.kind === 'ok'
              ? 'bg-green-500/10 text-green-400'
              : banner.kind === 'warn'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          }`}
        >
          <span className="flex items-center gap-2">
            {banner.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {banner.text}
          </span>
          <button type="button" onClick={() => setBanner(null)} className="text-muted-foreground hover:text-foreground" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tráfego ao vivo */}
      <Section title="Tráfego ao vivo" icon={<Activity className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LiveStat
            icon={<ArrowDown className="h-4 w-4 text-[var(--orion-icon-default)]" />}
            label="Download"
            value={rx.value}
            unit={rx.unit}
            hist={hist.current.rx}
            desc={netAvailable ? 'Recebido agora' : 'Indisponível'}
          />
          <LiveStat
            icon={<ArrowUp className="h-4 w-4 text-[var(--orion-icon-default)]" />}
            label="Upload"
            value={tx.value}
            unit={tx.unit}
            hist={hist.current.tx}
            desc={netAvailable ? 'Enviado agora' : 'Indisponível'}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Atualiza automaticamente enquanto esta aba está aberta.</p>
      </Section>

      {/* Adaptadores */}
      <Section title="Adaptadores ativos" icon={<Network className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
        {infoError && <p className="mb-3 text-xs text-red-400">{infoError}</p>}
        {infoLoading && !info && (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            Lendo adaptadores…
          </div>
        )}
        {!infoLoading && !infoError && adapters.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum adaptador ativo encontrado.</p>
        )}
        {adapters.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {adapters.map((a, i) => {
              const speed = a.speedMbps ?? a.speed ?? null;
              return (
                <div key={`${a.name || 'adapter'}-${i}`} className="rounded-lg bg-black/20 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    {isWireless(a) ? (
                      <Wifi className="h-4 w-4 text-[var(--orion-icon-default)]" />
                    ) : (
                      <Cable className="h-4 w-4 text-[var(--orion-icon-default)]" />
                    )}
                    <span className="text-sm font-semibold text-foreground">{dash(a.name)}</span>
                    {a.type && <span className="text-xs text-muted-foreground">{a.type}</span>}
                  </div>
                  <InfoRow label="Descrição" value={dash(a.description)} />
                  <InfoRow label="IP (IPv4)" value={dash(a.ip)} mono />
                  <InfoRow label="Velocidade do enlace" value={speed ? `${speed} Mbps` : '—'} />
                  <InfoRow label="MAC" value={dash(a.mac)} mono />
                </div>
              );
            })}
            {dnsServers.length > 0 && (
              <div className="rounded-lg bg-black/20 px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4 text-[var(--orion-icon-default)]" />
                  <span className="text-sm font-semibold text-foreground">Servidores DNS em uso</span>
                  <span className="text-xs text-muted-foreground">configuração atual</span>
                </div>
                {dnsServers.map((d) => (
                  <div key={d} className="py-1 font-mono text-sm text-foreground">
                    {d}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Testes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Ping */}
        <Section title="Ping test" icon={<Radio className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="rede-ping-host">Destino</label>
            <input
              id="rede-ping-host"
              type="text"
              value={pingHost}
              disabled={pinging}
              onChange={(e) => setPingHost(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runPing(); }}
              placeholder={DEFAULT_PING_HOST}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={runPing}
              disabled={pinging}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
            >
              <Radio className={'h-4 w-4 ' + (pinging ? 'animate-pulse' : '')} />
              {pinging ? 'MEDINDO…' : 'PING TEST'}
            </button>
          </div>
          {pingError && <p className="text-xs text-red-400">{pingError}</p>}
          {pinging && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
              Enviando {DEFAULT_PING_COUNT} pacotes ICMP para {sanitizeHost(pingHost) || DEFAULT_PING_HOST}…
            </div>
          )}
          {ping && !pinging && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {ping.host} · {ping.sent ?? DEFAULT_PING_COUNT} pacotes ICMP reais
              </p>
              <MetricRow
                label="Latência média"
                value={<b className={latencyClass(ping.avgMs)}>{ping.avgMs ?? '—'} ms</b>}
              />
              <MetricRow label="Mínima / máxima" value={`${ping.minMs ?? '—'} ms / ${ping.maxMs ?? '—'} ms`} />
              <MetricRow label="Jitter (variação)" value={ping.jitterMs != null ? <b>{ping.jitterMs} ms</b> : '—'} />
              <MetricRow
                label="Pacotes perdidos"
                value={(() => {
                  const loss = ping.lossPercent ?? ping.loss ?? null;
                  return (
                    <>
                      <b className={lossClass(loss)}>{loss != null ? `${loss}%` : '—'}</b>
                      {ping.sent != null && ping.received != null && (
                        <span className="text-muted-foreground"> ({ping.received}/{ping.sent} recebidos)</span>
                      )}
                    </>
                  );
                })()}
              />
            </div>
          )}
          {!ping && !pinging && !pingError && (
            <p className="text-xs text-muted-foreground">Mede latência média, mínima/máxima, jitter e perda de pacotes.</p>
          )}
        </Section>

        {/* DNS */}
        <Section title="DNS test" icon={<Globe className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="rede-dns-domain">Domínio</label>
            <input
              id="rede-dns-domain"
              type="text"
              value={dnsDomain}
              disabled={dnsTesting}
              onChange={(e) => setDnsDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runDns(); }}
              placeholder={DEFAULT_DNS_DOMAIN}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={runDns}
              disabled={dnsTesting}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
            >
              <Globe className={'h-4 w-4 ' + (dnsTesting ? 'animate-pulse' : '')} />
              {dnsTesting ? 'TESTANDO…' : 'DNS TEST'}
            </button>
          </div>
          {dnsError && <p className="text-xs text-red-400">{dnsError}</p>}
          {dnsTesting && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
              Resolvendo {sanitizeHost(dnsDomain) || DEFAULT_DNS_DOMAIN} em cada servidor…
            </div>
          )}
          {dns && !dnsTesting && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Resolução de {dns.domain}</p>
              {dns.results.map((x, i) => (
                <MetricRow
                  key={`${x.server}-${i}`}
                  label={x.server}
                  value={
                    x.ok && x.ms != null ? (
                      <b className={dnsClass(x.ms)}>{x.ms} ms</b>
                    ) : (
                      <i className="text-muted-foreground">falhou</i>
                    )
                  }
                />
              ))}
              <p className="mt-2 text-xs text-muted-foreground">
                Tempos medidos localmente nesta máquina — variam conforme sua conexão.
              </p>
            </div>
          )}
          {!dns && !dnsTesting && !dnsError && (
            <p className="text-xs text-muted-foreground">
              Compara o tempo de resolução do DNS atual com Cloudflare (1.1.1.1) e Google (8.8.8.8).
            </p>
          )}
        </Section>
      </div>

      {/* Otimizações de rede */}
      <Section title="Otimizações de rede disponíveis" icon={<Network className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
        {itemsError && <p className="text-sm text-muted-foreground">{itemsError}</p>}
        {itemsLoading && items.length === 0 && !itemsError && (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            Carregando catálogo…
          </div>
        )}
        {!itemsLoading && !itemsError && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma otimização de rede catalogada.</p>
        )}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((it) => {
              const busy = busyId === it.id;
              const risk = it.risk || 'low';
              return (
                <div key={it.id} className="flex flex-wrap items-start gap-3 rounded-lg bg-black/20 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--orion-selected-bg)]">
                    <Network className="h-4 w-4 text-[var(--orion-icon-default)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{it.name}</span>
                      {it.proOnly ? (
                        <span className="rounded-full bg-[var(--orion-icon-default)]/20 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
                          PRO
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-green-400">
                          GRÁTIS
                        </span>
                      )}
                      {it.applied && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> APLICADA
                        </span>
                      )}
                    </div>
                    {it.description && <p className="mt-1 text-xs text-muted-foreground">{it.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider ${
                          RISK_CLASS[risk] || 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {risk === 'high' && <AlertTriangle className="h-3 w-3" />}
                        {RISK_LABEL[risk] || it.riskLabel || risk}
                      </span>
                      {it.requiresAdmin && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          ADMIN
                        </span>
                      )}
                      {it.rebootRequired && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          REINÍCIO
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.applied && (
                      <button
                        type="button"
                        onClick={() => requestUndo(it)}
                        disabled={!!busyId}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground disabled:opacity-60"
                        title="Desfazer esta otimização"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        DESFAZER
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => requestApply(it)}
                      disabled={!!busyId}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-3 py-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                    >
                      {busy ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {busy ? 'APLICANDO…' : it.applied ? 'REAPLICAR' : 'APLICAR'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Diálogo de confirmação */}
      {pending && pending.type === 'apply' && (
        <ConfirmDialog
          title="Aplicar 1 otimização?"
          onCancel={() => setPending(null)}
          onConfirm={() => doApply(pending.item)}
          confirmLabel="APLICAR"
        >
          <p className="m-0 mb-2 text-xs text-muted-foreground">
            Um prompt de administrador (UAC) pode ser exibido para aplicar a otimização.
          </p>
          {(pending.item.risk === 'high' || pending.item.confirm) && (
            <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2">
              <p className="m-0 mb-1 flex items-center gap-2 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {pending.item.risk === 'high' ? 'Risco alto — confirmação explícita' : 'Requer confirmação explícita'}
              </p>
              <p className="m-0 text-sm text-foreground">
                {pending.item.name}
                {pending.item.riskLabel || pending.item.risk ? (
                  <span className="text-muted-foreground"> · {pending.item.riskLabel || pending.item.risk}</span>
                ) : null}
              </p>
            </div>
          )}
          {pending.item.description && <p className="m-0 text-xs text-muted-foreground">{pending.item.description}</p>}
        </ConfirmDialog>
      )}
      {pending && pending.type === 'undo' && (
        <ConfirmDialog
          title="Desfazer esta otimização?"
          onCancel={() => setPending(null)}
          onConfirm={() => doUndo(pending.item)}
          confirmLabel="DESFAZER"
        >
          <p className="m-0 mb-2 text-sm text-foreground">{pending.item.name}</p>
          <p className="m-0 text-xs text-muted-foreground">
            Desfazer restaura as chaves do registro salvas antes da aplicação e executa a ação de reversão do item. Alguns
            itens não podem ser revertidos automaticamente.
          </p>
        </ConfirmDialog>
      )}
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

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`truncate text-right font-medium text-foreground ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
      </span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/40 py-1.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function LiveStat({
  icon,
  label,
  value,
  unit,
  desc,
  hist,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  desc: string;
  hist: number[];
}) {
  return (
    <div className="rounded-lg bg-black/20 px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mb-1 text-2xl font-semibold text-foreground">
        {value}
        <small className="ml-1 text-sm font-medium text-muted-foreground">{unit}</small>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{desc}</div>
      <div className="h-8 overflow-hidden">
        <Sparkline values={hist.length > 1 ? hist.slice(-HIST_MAX) : [0, 0]} width={220} height={32} />
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = 'CONFIRMAR',
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--orion-surface)] p-5 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        <h3 className="m-0 mb-3 text-base font-semibold text-foreground">{title}</h3>
        <div className="mb-5">{children}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
