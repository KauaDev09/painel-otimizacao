import React from 'react';
import { KeyRound, ShieldCheck, RefreshCcw, LogOut, Monitor, Eye, EyeOff, Check, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos locais (formato do licenseService.getState())
// ---------------------------------------------------------------------------

interface LicenseInfo {
  active: boolean;
  state?: string | null;
  reason?: string | null;
  blockReason?: string | null;
  key?: string | null;
  plan?: string | null;
  planSlug?: string | null;
  features?: string[];
  isLegacyLifetime?: boolean;
  expiresAt?: string | null;
  daysLeft?: number | null;
  lastValidatedAt?: string | null;
  offlineGrace?: boolean;
  serverUnreachable?: boolean;
  authorizedVersion?: string | null;
  serverVersion?: string | null;
  canRunVersion?: boolean;
  hostname?: string | null;
  deviceName?: string | null;
  machineId?: string | null;
}

interface LocalApi {
  licenseGetState(): Promise<LicenseInfo>;
  licenseActivate(key: string): Promise<unknown>;
  licenseRefresh(): Promise<LicenseInfo>;
  licenseLogout(): Promise<unknown>;
  onLicenseChanged(cb: (state: LicenseInfo) => void): void;
  openExternal?(url: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORE_URL = 'https://orion-store-dun.vercel.app';

const ERROR_MAP: Record<string, string> = {
  LICENSE_NOT_FOUND: 'Key inválida — verifique se digitou corretamente.',
  LICENSE_EXPIRED: 'Licença expirada — renove na Orion Store.',
  LICENSE_BLOCKED: 'Licença bloqueada — contate o suporte.',
  VERSION_NOT_AUTHORIZED: 'Esta versão não está autorizada pela sua licença.',
  DEVICE_LIMIT: 'Limite de dispositivos atingido para esta key.',
  EMPTY_KEY: 'Informe uma key de licença.',
};

const REASON_LABEL: Record<string, string> = {
  PRODUCT_NOT_ACTIVATED: 'Nenhuma key ativada neste computador.',
  LICENSE_EXPIRED: 'Licença expirada — renove na Orion Store.',
  LICENSE_BLOCKED: 'Licença bloqueada — contate o suporte.',
  VERSION_NOT_AUTHORIZED: 'Esta versão não está autorizada pela sua licença.',
  VALIDATION_REQUIRED: 'É necessário revalidar a licença online.',
};

const FEATURE_NAMES: Record<string, string> = {
  system_monitoring: 'Monitoramento do sistema',
  basic_cleanup: 'Limpeza essencial',
  advanced_cleanup: 'Limpeza avançada',
  fps_boost: 'FPS Boost',
  basic_fps_boost: 'FPS Boost essencial',
  gaming_mode: 'Modo gamer',
  process_optimizer: 'Otimizador de processos',
  startup_optimizer: 'Otimizador de inicialização',
  bios_optimizer: 'Otimizador de BIOS',
  xmp_optimizer: 'Otimizador XMP',
  advanced_memory_optimizer: 'Otimização avançada de memória',
  advanced_windows_optimizer: 'Otimização avançada do Windows',
  realtime_telemetry: 'Telemetria em tempo real',
  priority_features: 'Recursos prioritários',
};

function featureName(slug: string): string {
  return FEATURE_NAMES[slug] || slug.replace(/_/g, ' ');
}

/** Mostra só os 4 últimos caracteres alfanuméricos da key. */
function maskKey(key: string): string {
  const clean = key.replace(/[^A-Za-z0-9]/g, '');
  // Já veio mascarada do backend (ex.: "ABCD-••••-••••") → mantém como está.
  if (clean.length <= 4) return key;
  return `••••-••••-••••-${clean.slice(-4)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
}

function errText(err: unknown, fallbackPrefix: string): string {
  const code = (err as { code?: string })?.code ?? '';
  const mapped = ERROR_MAP[code];
  if (mapped) return mapped;
  const m = (err as { message?: string })?.message;
  return `${fallbackPrefix}: ${m ?? String(err)}`;
}

type Msg = { kind: 'ok' | 'err' | 'info'; text: string } | null;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Licenca({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;
  const [lic, setLic] = React.useState<LicenseInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showKey, setShowKey] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg>(null);

  // Ativar outra key
  const [showActivate, setShowActivate] = React.useState(false);
  const [newKey, setNewKey] = React.useState('');
  const [showNewKey, setShowNewKey] = React.useState(false);
  const [activating, setActivating] = React.useState(false);
  const [activateMsg, setActivateMsg] = React.useState<Msg>(null);

  // Desconectar
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await api.licenseGetState();
        if (alive) setLic(st);
      } catch {
        if (alive) setMsg({ kind: 'err', text: 'Não foi possível consultar o estado da licença.' });
      }
      if (alive) setLoading(false);
    })();
    // O preload não devolve função de unsubscribe → protege com a flag `alive`.
    try {
      api.onLicenseChanged?.((st) => {
        if (alive) setLic(st);
      });
    } catch { /* ok */ }
    return () => { alive = false; };
  }, [api]);

  // Mensagens somem sozinhas.
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setMsg({ kind: 'info', text: 'Revalidando licença no servidor…' });
    try {
      const st = await api.licenseRefresh();
      setLic(st);
      if (st?.serverUnreachable) {
        setMsg({ kind: 'err', text: 'Servidor indisponível — a licença permanece válida em modo offline.' });
      } else if (st?.active) {
        setMsg({ kind: 'ok', text: 'Licença revalidada com sucesso.' });
      } else {
        setMsg({ kind: 'err', text: REASON_LABEL[st?.reason ?? ''] || 'A licença não está ativa.' });
      }
    } catch (err) {
      setMsg({ kind: 'err', text: errText(err, 'Falha ao revalidar') });
    }
    setRefreshing(false);
  };

  const activate = async () => {
    const k = newKey.trim();
    if (!k) {
      setActivateMsg({ kind: 'err', text: 'Informe a Key recebida na compra.' });
      return;
    }
    if (activating) return;
    setActivating(true);
    setActivateMsg({ kind: 'info', text: 'Validando licença…' });
    try {
      await api.licenseActivate(k);
      const st = await api.licenseGetState();
      setLic(st);
      setActivateMsg({ kind: 'ok', text: 'Licença validada' });
      setMsg({ kind: 'ok', text: 'Nova key ativada com sucesso — todos os recursos liberados.' });
      setNewKey('');
      setShowActivate(false);
      setActivateMsg(null);
    } catch (err) {
      setActivateMsg({ kind: 'err', text: errText(err, 'Falha na validação') });
    }
    setActivating(false);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.licenseLogout();
      // App.tsx recebe onLicenseChanged e volta para a tela de login.
      setConfirmLogout(false);
      setMsg({ kind: 'info', text: 'Esta máquina foi desconectada da licença.' });
    } catch (err) {
      setMsg({ kind: 'err', text: errText(err, 'Falha ao desconectar') });
    }
    setLoggingOut(false);
  };

  const buy = () => { api.openExternal?.(STORE_URL)?.catch(() => {}); };

  const active = Boolean(lic?.active);
  const daysWarn = lic?.daysLeft != null && lic.daysLeft <= 7;
  const plan = (lic?.plan || (active ? 'PRO' : '')).toString().toUpperCase();
  const keyDisplay = lic?.key ? (showKey ? lic.key : maskKey(lic.key)) : null;
  const device = lic?.deviceName || lic?.hostname || 'Este computador';
  const reasonCode = lic?.reason || lic?.blockReason || null;

  const primaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
  const dangerBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60';

  const msgClass = (m: Msg) =>
    m?.kind === 'err' ? 'text-red-400' : m?.kind === 'ok' ? 'text-green-400' : 'text-muted-foreground';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Licença</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado da sua key, plano e dispositivo vinculado. A licença é validada com segurança no servidor.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing || loading} className={secondaryBtn}>
          <RefreshCcw className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} />
          {refreshing ? 'Revalidando…' : 'REVALIDAR'}
        </button>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
            msg.kind === 'err'
              ? 'bg-red-500/10 text-red-300'
              : msg.kind === 'ok'
                ? 'bg-green-500/10 text-green-300'
                : 'bg-[var(--orion-selected-bg)] text-foreground'
          }`}
        >
          <span className="flex-1">{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verificando licença…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Coluna esquerda */}
          <div className="space-y-5 lg:col-span-2">
            {/* Estado */}
            <Section title="Estado da licença" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${
                    active
                      ? daysWarn
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                  {active ? 'Ativa' : reasonCode === 'LICENSE_EXPIRED' ? 'Expirada' : reasonCode === 'LICENSE_BLOCKED' ? 'Bloqueada' : 'Inativa'}
                </span>
                {active && lic?.offlineGrace && (
                  <span className="inline-flex items-center rounded-full bg-[var(--orion-selected-bg)] px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
                    Offline
                  </span>
                )}
                {plan && (
                  <span className="inline-flex items-center rounded-full bg-[var(--orion-selected-bg)] px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
                    {plan}
                  </span>
                )}
              </div>

              {!active && reasonCode && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{REASON_LABEL[reasonCode] || 'A licença não está ativa nesta máquina.'}</span>
                </div>
              )}

              <InfoRow label="Plano" value={plan || '—'} />
              <InfoRow
                label="Validade"
                value={lic?.expiresAt ? `Válida até ${fmtDate(lic.expiresAt)}` : active ? 'Vitalícia' : '—'}
              />
              <InfoRow
                label="Dias restantes"
                value={lic?.daysLeft != null ? `${lic.daysLeft} ${lic.daysLeft === 1 ? 'dia' : 'dias'}` : lic?.expiresAt ? '—' : 'Sem expiração'}
                valueClass={daysWarn ? 'text-amber-400' : undefined}
              />
              <InfoRow label="Última validação" value={fmtDateTime(lic?.lastValidatedAt)} />
              {lic?.authorizedVersion && <InfoRow label="Versão autorizada" value={`v${lic.authorizedVersion}`} />}
            </Section>

            {/* Key */}
            <Section title="Key de licença" icon={<KeyRound className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
              {keyDisplay ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-black/40 px-3 py-2 font-mono text-sm tracking-wider text-foreground">{keyDisplay}</span>
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showKey ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem key registrada neste computador.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Por segurança, o aplicativo nunca armazena a key completa em texto claro; parte dela é sempre ocultada.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setShowActivate((s) => !s); setActivateMsg(null); }}
                  className={secondaryBtn}
                >
                  <KeyRound className="h-4 w-4" />
                  {showActivate ? 'CANCELAR' : 'ATIVAR OUTRA KEY'}
                </button>
                <button type="button" onClick={buy} className={secondaryBtn}>
                  <ExternalLink className="h-4 w-4" />
                  ORION STORE
                </button>
              </div>

              {showActivate && (
                <div className="mt-4 rounded-lg bg-black/30 p-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Ativar outra key substitui a licença atual nesta máquina. Cada key possui um limite de dispositivos definido na compra.
                  </p>
                  <div
                    className={[
                      'mb-3 flex items-center gap-2 rounded-lg border bg-black/40 px-3 py-2.5 transition-all duration-200 ease-out',
                      activateMsg?.kind === 'err'
                        ? 'border-red-500/60'
                        : 'border-[var(--orion-selected-bg)] focus-within:border-[var(--orion-hover-border)]',
                    ].join(' ')}
                  >
                    <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && activate()}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      maxLength={29}
                      spellCheck={false}
                      autoComplete="off"
                      type={showNewKey ? 'text' : 'password'}
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKey((s) => !s)}
                      className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-[var(--orion-hover-fg)]"
                    >
                      {showNewKey ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={activate} disabled={activating} className={primaryBtn}>
                      {activating ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {activating ? 'Validando…' : 'ATIVAR KEY'}
                    </button>
                    {activateMsg && <span className={`text-sm ${msgClass(activateMsg)}`}>{activateMsg.text}</span>}
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* Coluna direita */}
          <div className="space-y-5">
            {/* Dispositivo */}
            <Section title="Dispositivo atual" icon={<Monitor className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
              <InfoRow label="Máquina" value={device} />
              <InfoRow label="Vinculada" value={lic?.key ? 'Sim' : 'Não'} valueClass={lic?.key ? 'text-green-400' : undefined} />
              {lic?.machineId && <InfoRow label="ID" value={String(lic.machineId).slice(0, 12) + '…'} />}
              <p className="mt-3 text-xs text-muted-foreground">
                A licença é vinculada a este computador. Ao desconectar, a vaga é liberada para outro dispositivo.
              </p>
              {lic?.key && (
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className={`mt-3 w-full justify-center ${dangerBtn}`}
                >
                  <LogOut className="h-4 w-4" />
                  DESCONECTAR ESTA MÁQUINA
                </button>
              )}
            </Section>

            {/* Recursos do plano */}
            <Section title="Recursos do plano" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
              {active && lic?.features && lic.features.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lic.features.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full bg-[var(--orion-selected-bg)] px-2.5 py-1 text-xs text-foreground">
                      <Check className="h-3 w-3 text-green-400" />
                      {featureName(f)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {active ? 'Nenhum recurso extra liberado.' : 'Ative uma key para liberar os recursos do plano.'}
                </p>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* Modal de confirmação de logout */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-[var(--orion-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="mb-3 flex items-center gap-2">
              <LogOut className="h-5 w-5 text-red-400" />
              <h3 className="m-0 text-lg font-semibold text-foreground">Desconectar esta máquina?</h3>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              A licença será removida deste computador e você voltará para a tela de acesso. Será necessário informar a key novamente
              para usar o Orion Optimizer aqui.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmLogout(false)} disabled={loggingOut} className={secondaryBtn}>
                CANCELAR
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-400 disabled:opacity-60"
              >
                {loggingOut ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <LogOut className="h-4 w-4" />}
                {loggingOut ? 'Desconectando…' : 'DESCONECTAR'}
              </button>
            </div>
          </div>
        </div>
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

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${valueClass || 'text-foreground'}`}>{value}</span>
    </div>
  );
}
