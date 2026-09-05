import React from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCcw,
  Bug,
  Lock,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos (formatos observados em securityService.js e mock-api.js)
// ---------------------------------------------------------------------------

type Level = 'critical' | 'recommended' | 'optional' | 'informational' | 'advanced';
type Risk = 'low' | 'medium' | 'high' | 'info';
type Impact = 'low' | 'medium' | 'high';

interface Recommendation {
  id: string;
  name: string;
  reason?: string;
  statusText?: string;
  recommendation?: string;
  effectiveLevel?: Level;
  risk?: Risk;
  impact?: Impact;
  benefit?: string;
  compatibility?: string;
  paths?: string[];
  steps?: string[];
  notes?: string[];
  rebootRequired?: boolean;
}

interface Threat {
  name?: string;
  detectedAt?: string | number | null;
  severityId?: number;
  severityLabel?: string;
  active?: boolean;
  executed?: boolean;
  resources?: string[];
  process?: string;
}

interface SecurityResult {
  ok?: boolean;
  score: number;
  penalties?: { pts: number; why: string }[];
  threatCount?: number;
  activeThreatCount?: number;
  threats?: Threat[];
  defender?: {
    available?: boolean | null;
    realTimeEnabled?: boolean | null;
    antivirusEnabled?: boolean | null;
    behaviorMonitor?: boolean | null;
    tamperProtected?: boolean | null;
    signatureVersion?: string | null;
    engineVersion?: string | null;
    signatureLastUpdated?: string | boolean | null;
    signatureAgeDays?: number | null;
    lastQuickScan?: string | number | null;
    lastQuickScanAgeDays?: number | null;
    lastFullScan?: string | number | null;
  } | null;
  preferences?: { puaProtection?: number | null; exclusions?: number | null } | null;
  avProducts?: { name?: string; enabled?: boolean | null; upToDate?: boolean | null }[] | null;
  firewall?: { domain?: boolean | null; private?: boolean | null; public?: boolean | null } | null;
  uac?: { enableLua?: boolean | null } | null;
  smartscreen?: { explorer?: string | null } | null;
  recommendations?: Recommendation[];
  counts?: { critical?: number; recommended?: number; optional?: number };
  analyzedAt?: string;
}

interface QuickScanResult {
  started?: boolean;
  note?: string;
  error?: string;
}

interface SecurityApi {
  securityAnalyze(): Promise<SecurityResult>;
  securityQuickScan(): Promise<QuickScanResult>;
  onServiceStep?(cb: (step: { key?: string; label?: string } | string) => void): void;
}

// ---------------------------------------------------------------------------
// Constantes de apresentação
// ---------------------------------------------------------------------------

const LEVEL_META: Record<Level, { label: string; color: string; text: string }> = {
  critical: { label: 'CRÍTICA', color: '#f87171', text: 'text-red-400' },
  recommended: { label: 'RECOMENDADA', color: '#4ade80', text: 'text-green-400' },
  optional: { label: 'OPCIONAL', color: '#fbbf24', text: 'text-amber-400' },
  informational: { label: 'INFORMATIVA', color: 'var(--orion-text-secondary)', text: 'text-muted-foreground' },
  advanced: { label: 'AVANÇADA', color: '#fb923c', text: 'text-orange-400' },
};
const RISK_LABEL: Record<string, string> = { low: 'RISCO BAIXO', medium: 'RISCO MÉDIO', high: 'RISCO ALTO', info: 'INFORMATIVO' };
const RISK_CLASS: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-muted-foreground',
};
const IMPACT_LABEL: Record<string, string> = { low: 'IMPACTO BAIXO', medium: 'IMPACTO MÉDIO', high: 'IMPACTO ALTO' };

function levelMeta(level?: string) {
  return (level && (LEVEL_META as Record<string, { label: string; color: string; text: string }>)[level]) || LEVEL_META.informational;
}

function errMsg(err: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

function dash(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function fmtDate(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('pt-BR');
}

function short(s: unknown, n: number): string {
  const str = dash(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

type BannerType = 'success' | 'error' | 'warning' | 'info';
interface Banner { type: BannerType; text: string }

const BANNER_CLASS: Record<BannerType, string> = {
  success: 'bg-green-500/10 text-green-400',
  error: 'bg-red-500/10 text-red-400',
  warning: 'bg-amber-500/10 text-amber-400',
  info: 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]',
};

function BannerIcon({ type }: { type: BannerType }) {
  const cls = 'h-4 w-4 shrink-0';
  if (type === 'success') return <CheckCircle2 className={cls} />;
  if (type === 'error') return <ShieldAlert className={cls} />;
  if (type === 'warning') return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Linha de proteção (equivalente ao protRow legado): ponto colorido + Ativado/Desativado. */
function ProtRow({ label, value, extra }: { label: string; value: boolean | null | undefined; extra?: string }) {
  const dot = value === true ? 'bg-green-500' : value === false ? 'bg-red-400' : 'bg-muted-foreground';
  const txt = value === true ? 'Ativado' : value === false ? 'Desativado' : 'não determinado';
  const txtCls = value === true ? 'text-green-400' : value === false ? 'text-red-400' : 'text-muted-foreground';
  return (
    <InfoRow
      label={label}
      value={
        <span className={`inline-flex items-center gap-2 ${txtCls}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          {txt}{extra || ''}
        </span>
      }
    />
  );
}

function ScoreRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? 'var(--orion-icon-active)' : value >= 50 ? 'var(--orion-icon-default)' : '#ef4444';
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="38" fill="none" stroke="var(--orion-selected-bg)" strokeWidth="4" />
        <circle cx="40" cy="40" r="38" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function Badges({ risk, impact, reboot }: { risk?: string; impact?: string; reboot?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {risk && (
        <span className={`rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${RISK_CLASS[risk] || RISK_CLASS.info}`}>
          {RISK_LABEL[risk] || risk}
        </span>
      )}
      {impact && (
        <span className="rounded-md bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {IMPACT_LABEL[impact] || impact}
        </span>
      )}
      {reboot && (
        <span className="rounded-md bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          REINICIALIZAÇÃO NECESSÁRIA
        </span>
      )}
    </div>
  );
}

function RecCard({ rec, onDetails }: { rec: Recommendation; onDetails: (rec: Recommendation) => void }) {
  const meta = levelMeta(rec.effectiveLevel);
  const status = (rec.statusText || '').replace(/^Status: /, '');
  return (
    <div className="rounded-lg border-l-4 bg-[var(--orion-surface)] px-5 py-4" style={{ borderLeftColor: meta.color }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold text-foreground">{rec.name}</p>
          {status && <p className="mt-1 text-xs text-muted-foreground">Status: {status}</p>}
          {rec.recommendation && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className={`font-semibold ${meta.text}`}>{meta.label}</span> Recomendação:{' '}
              <span className="font-semibold text-foreground">{rec.recommendation}</span>
            </p>
          )}
        </div>
        <span className={`shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
      </div>
      <Badges risk={rec.risk} impact={rec.impact} reboot={rec.rebootRequired} />
      {rec.paths && rec.paths.length > 0 && (
        <p className="mt-3 whitespace-pre-line font-mono text-[0.7rem] text-muted-foreground">{rec.paths.join('\n')}</p>
      )}
      <button
        type="button"
        onClick={() => onDetails(rec)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)]"
      >
        VER DETALHES
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide }: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`flex max-h-[90vh] w-full flex-col rounded-lg bg-[var(--orion-surface)] shadow-[0_0_40px_rgba(0,0,0,0.6)] ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-start justify-between gap-4 px-5 pt-4">
          {title ? <h3 className="m-0 text-base font-semibold text-foreground">{title}</h3> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-muted-foreground">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 pb-4">{footer}</div>}
      </div>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--orion-icon-active)]">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Seguranca({ onNavigate }: { onNavigate?: (view: string) => void }) {
  void onNavigate;
  const api = useApi() as unknown as SecurityApi;
  const [result, setResult] = React.useState<SecurityResult | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [stepLabel, setStepLabel] = React.useState<string>('Analisando…');
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [details, setDetails] = React.useState<Recommendation | null>(null);
  const [confirmScan, setConfirmScan] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const alive = React.useRef(true);
  const busyRef = React.useRef(false);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const threatsRef = React.useRef<HTMLDivElement | null>(null);

  const toast = React.useCallback((type: BannerType, text: string, ms = 7000) => {
    if (!alive.current) return;
    setBanner({ type, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (alive.current) setBanner(null); }, ms);
  }, []);

  // Passos de progresso (canal compartilhado com o Game Boost — só exibimos enquanto esta tela está ocupada).
  React.useEffect(() => {
    alive.current = true;
    api.onServiceStep?.((step) => {
      if (!alive.current || !busyRef.current) return;
      const label = typeof step === 'string' ? step : step?.label;
      if (label) setStepLabel(label);
    });
    return () => {
      alive.current = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [api]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDetails(null);
      setConfirmScan(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    busyRef.current = true;
    setStepLabel('Analisando…');
    try {
      const res = await api.securityAnalyze();
      if (!alive.current) return;
      if (!res || typeof res.score !== 'number') {
        toast('error', 'A análise de segurança não retornou dados válidos.');
      } else {
        setResult(res);
        setUpdatedAt(new Date().toLocaleTimeString());
        toast(
          res.activeThreatCount ? 'warning' : 'success',
          `Análise concluída — Security Score: ${res.score}/100${res.activeThreatCount ? ` · ${res.activeThreatCount} ameaça(s) ATIVA(S)` : ''}`,
        );
      }
    } catch (err) {
      toast('error', `Falha na análise de segurança: ${errMsg(err)}`);
    } finally {
      busyRef.current = false;
      if (alive.current) setAnalyzing(false);
    }
  };

  const handleQuickScan = async () => {
    setConfirmScan(false);
    if (scanning) return;
    setScanning(true);
    busyRef.current = true;
    setStepLabel('Iniciando verificação rápida…');
    try {
      const res = await api.securityQuickScan();
      if (!alive.current) return;
      if (res?.started) toast('info', res.note || 'Verificação rápida iniciada em segundo plano.', 9000);
      else toast('error', res?.error || 'Não foi possível iniciar a verificação.', 9000);
    } catch (err) {
      toast('error', errMsg(err, 'Não foi possível iniciar a verificação.'));
    } finally {
      busyRef.current = false;
      if (alive.current) setScanning(false);
    }
  };

  const scrollToThreats = () => {
    threatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Dados derivados ----
  const d = result?.defender || {};
  const prefs = result?.preferences || {};
  const fw = result?.firewall || {};
  const uac = result?.uac || {};
  const ss = result?.smartscreen || {};
  const avProducts = result?.avProducts || [];
  const threats = result?.threats || [];
  const threatCount = result?.threatCount ?? threats.length;
  const activeThreatCount = result?.activeThreatCount ?? threats.filter((t) => t.active).length;
  const penalties = result?.penalties || [];
  const recs = result?.recommendations || [];
  const smartscreenOn = ss.explorer != null ? String(ss.explorer).toLowerCase() !== 'off' : null;
  const busy = analyzing || scanning;

  const secondaryBtn = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60';
  const primaryBtn = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Segurança</h2>
          <p className="mt-1 text-sm text-muted-foreground">Estado do Microsoft Defender, firewall e proteções do Windows.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">{updatedAt}</span>}
          <button
            type="button"
            onClick={() => setConfirmScan(true)}
            disabled={busy}
            title="Inicia a Verificação Rápida nativa do Microsoft Defender em segundo plano"
            className={secondaryBtn}
          >
            <Search className={'h-4 w-4 ' + (scanning ? 'animate-pulse' : '')} />
            {scanning ? 'Iniciando…' : 'VERIFICAÇÃO RÁPIDA'}
          </button>
          <button type="button" onClick={handleAnalyze} disabled={busy} className={primaryBtn}>
            <RefreshCcw className={'h-4 w-4 ' + (analyzing ? 'animate-spin' : '')} />
            {analyzing ? 'Analisando…' : 'ANALISAR SEGURANÇA'}
          </button>
        </div>
      </div>

      {/* Mensagem (toast inline) */}
      {banner && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${BANNER_CLASS[banner.type]}`}>
          <BannerIcon type={banner.type} />
          <span className="flex-1">{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-current opacity-70 hover:opacity-100" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Progresso */}
      {busy && (
        <div className="flex items-center gap-3 rounded-lg bg-[var(--orion-surface)] px-5 py-3 text-sm text-muted-foreground">
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <span>{stepLabel}</span>
        </div>
      )}

      {/* Estado vazio */}
      {!result && !analyzing && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-[var(--orion-icon-default)]/40" />
          <p className="mb-3 text-sm text-muted-foreground">
            Execute a análise para ver o estado do Microsoft Defender e das proteções do Windows.
          </p>
          <button type="button" onClick={handleAnalyze} disabled={busy} className={primaryBtn.replace('px-4 py-2', 'px-5 py-2.5')}>
            <RefreshCcw className="h-4 w-4" />
            ANALISAR SEGURANÇA
          </button>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Coluna esquerda */}
            <div className="space-y-5 lg:col-span-2">
              <Section title="Microsoft Defender" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                {d.available === false && (
                  <p className="mb-2 flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Microsoft Defender indisponível neste sistema.
                  </p>
                )}
                <ProtRow label="Proteção em tempo real" value={d.realTimeEnabled} />
                <ProtRow label="Antivírus" value={d.antivirusEnabled} />
                <ProtRow label="Proteção contra adulteração" value={d.tamperProtected} />
                {d.behaviorMonitor != null && <ProtRow label="Monitoramento de comportamento" value={d.behaviorMonitor} />}
                <InfoRow label="Versão de assinaturas" value={dash(d.signatureVersion)} />
                <InfoRow
                  label="Assinaturas atualizadas"
                  value={d.signatureLastUpdated ? `${d.signatureAgeDays ?? '?'} dia(s) atrás` : '—'}
                />
                <InfoRow
                  label="Última verificação rápida"
                  value={d.lastQuickScan ? `${fmtDate(d.lastQuickScan)} (${d.lastQuickScanAgeDays ?? '?'} d)` : 'nenhuma registrada'}
                />
                {d.lastFullScan ? <InfoRow label="Última verificação completa" value={fmtDate(d.lastFullScan)} /> : null}
                <InfoRow
                  label="PUA / Exclusões"
                  value={`${prefs.puaProtection == null ? '–' : (prefs.puaProtection ?? 0) >= 1 ? 'PUA on' : 'PUA off'} · ${prefs.exclusions ?? '?'} exclusão(ões)`}
                />
              </Section>

              <Section title="Antivírus registrados" icon={<Bug className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                {avProducts.length ? (
                  avProducts.map((a, i) => <ProtRow key={`${a.name || 'av'}-${i}`} label={a.name || 'Antivírus'} value={a.enabled} />)
                ) : (
                  <InfoRow label="Produtos antivírus" value="nenhum registrado no Windows Security Center" />
                )}
              </Section>

              <Section title="Proteções do sistema" icon={<Lock className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <ProtRow label="Firewall (Domínio)" value={fw.domain} />
                <ProtRow label="Firewall (Privado)" value={fw.private} />
                <ProtRow label="Firewall (Público)" value={fw.public} />
                <ProtRow label="UAC (Controle de Conta)" value={uac.enableLua} />
                <ProtRow label="SmartScreen" value={smartscreenOn} extra={ss.explorer ? ` (${String(ss.explorer)})` : ''} />
              </Section>
            </div>

            {/* Coluna direita */}
            <div className="space-y-5">
              <Section title="Security Score" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <div className="flex flex-col items-center py-2">
                  <ScoreRing value={result.score} />
                </div>
                <ul className="m-0 mt-3 list-none space-y-1 p-0">
                  {penalties.length ? (
                    penalties.map((p, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{p.why}</span>
                        <span className="font-semibold text-red-400">-{p.pts}</span>
                      </li>
                    ))
                  ) : (
                    <li className="flex items-center gap-2 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sistema protegido
                    </li>
                  )}
                </ul>
              </Section>

              <Section title="Ameaças" icon={<ShieldAlert className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <InfoRow label="Total registrado" value={threatCount} />
                <InfoRow
                  label="Ativas agora"
                  value={<span className={activeThreatCount ? 'text-red-400' : 'text-green-400'}>{activeThreatCount}</span>}
                />
                {threatCount > 0 && (
                  <button
                    type="button"
                    onClick={scrollToThreats}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)]"
                  >
                    VER AMEAÇAS
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </Section>
            </div>
          </div>

          {/* Ameaças detectadas */}
          <section ref={threatsRef} className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--orion-icon-default)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ameaças detectadas</span>
              {threats.length > 0 && <span className="text-xs text-muted-foreground">({threats.length})</span>}
            </div>
            <div className="overflow-x-auto rounded-lg bg-[var(--orion-surface)]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Ameaça</th>
                    <th className="px-4 py-3 font-semibold">Severidade</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {threats.length ? (
                    threats.map((t, i) => {
                      const sev = t.severityId ?? 0;
                      const sevCls = sev >= 4 ? 'text-red-400' : sev >= 1 ? 'text-amber-400' : 'text-foreground';
                      return (
                        <tr key={`${t.name || 'threat'}-${i}`} className="border-t border-[var(--orion-selected-bg)]">
                          <td className="px-4 py-2.5 text-muted-foreground">{t.detectedAt ? fmtDate(t.detectedAt) : '—'}</td>
                          <td className="px-4 py-2.5 font-semibold text-foreground" title={(t.resources || []).join('\n')}>{dash(t.name)}</td>
                          <td className={`px-4 py-2.5 ${sevCls}`}>{dash(t.severityLabel)}</td>
                          <td className="px-4 py-2.5">
                            {t.active ? (
                              <span className="font-semibold text-red-400">ATIVA</span>
                            ) : t.executed ? (
                              <span className="text-amber-400">Executou antes</span>
                            ) : (
                              <span className="text-muted-foreground">Bloqueada/Removida</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground" title={dash(t.process)}>{short(t.process, 30)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-t border-[var(--orion-selected-bg)]">
                      <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                        Nenhuma ameaça registrada pelo Microsoft Defender.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recomendações de segurança */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--orion-icon-default)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recomendações de segurança</span>
              {recs.length > 0 && <span className="text-xs text-muted-foreground">({recs.length})</span>}
            </div>
            {recs.length ? (
              recs.map((r) => <RecCard key={r.id} rec={r} onDetails={setDetails} />)
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Nenhuma recomendação — proteções em dia.
              </div>
            )}
          </section>
        </>
      )}

      {/* Confirmação da verificação rápida */}
      {confirmScan && (
        <Modal
          title="Iniciar a Verificação Rápida do Microsoft Defender?"
          onClose={() => setConfirmScan(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmScan(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)]"
              >
                Cancelar
              </button>
              <button type="button" onClick={handleQuickScan} className={primaryBtn}>
                <Search className="h-4 w-4" />
                INICIAR VERIFICAÇÃO
              </button>
            </>
          }
        >
          <p className="m-0">Ela roda em segundo plano, de forma nativa, e pode levar alguns minutos.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Execute a análise de segurança novamente mais tarde para ver o resultado da verificação.
          </p>
        </Modal>
      )}

      {/* Modal de detalhes da recomendação */}
      {details && (
        <Modal onClose={() => setDetails(null)} wide>
          {(() => {
            const meta = levelMeta(details.effectiveLevel);
            const status = (details.statusText || '').replace(/^Status: /, '');
            return (
              <div>
                <h2 className="m-0 text-lg font-bold text-foreground">{details.name}</h2>
                <p className={`mt-1 text-xs font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</p>

                <ModalSection title="O que faz"><p className="m-0">{dash(details.reason)}</p></ModalSection>
                <ModalSection title="Status atual"><p className="m-0">{dash(status)}</p></ModalSection>
                <ModalSection title="Recomendação"><p className="m-0 font-semibold text-foreground">{dash(details.recommendation)}</p></ModalSection>
                <ModalSection title="Benefício esperado"><p className="m-0">{dash(details.benefit)}</p></ModalSection>
                <ModalSection title="Compatibilidade"><p className="m-0">{dash(details.compatibility)}</p></ModalSection>

                <Badges risk={details.risk} impact={details.impact} reboot={details.rebootRequired} />

                <ModalSection title="Como encontrar (caminho provável)">
                  <ul className="m-0 list-disc pl-5 font-mono text-xs">
                    {(details.paths || []).map((p, i) => <li key={i}>{p}</li>)}
                    {!(details.paths || []).length && <li>—</li>}
                  </ul>
                </ModalSection>

                {details.steps && details.steps.length > 0 && (
                  <ModalSection title="Passo a passo">
                    <ol className="m-0 list-decimal pl-5">
                      {details.steps.map((s, i) => <li key={i} className="py-0.5">{s}</li>)}
                    </ol>
                  </ModalSection>
                )}

                {details.notes && details.notes.length > 0 && details.notes.map((n, i) => (
                  <p key={i} className="mt-3 flex items-start gap-2 text-xs text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {n}
                  </p>
                ))}

                <p className="mt-4 text-xs text-muted-foreground">
                  Os nomes das opções podem variar conforme fabricante e versão do Windows. Esta ferramenta orienta manualmente — nunca aplica alterações automaticamente.
                </p>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
