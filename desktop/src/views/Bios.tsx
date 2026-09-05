import React from 'react';
import {
  CircuitBoard,
  RefreshCcw,
  Power,
  Undo2,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Terminal,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos (formatos observados em biosManager.js, main.js e mock-api.js)
// ---------------------------------------------------------------------------

type Level = 'critical' | 'recommended' | 'optional' | 'informational' | 'advanced';
type Filter = 'all' | Level;
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

interface LastAnalysis {
  recommendations?: Recommendation[];
  groups?: Partial<Record<Level, Recommendation[]>>;
}

type BiosStatus =
  | 'available'
  | 'active'
  | 'manual'
  | 'pending_reboot'
  | 'verifying'
  | 'applying'
  | 'success'
  | 'failed'
  | 'unavailable'
  | 'informational'
  | string;

interface BiosItem {
  id: string;
  operation?: string;
  name: string;
  description?: string;
  category?: string;
  level?: Level;
  risk?: Risk;
  impact?: Impact;
  requiresReboot?: boolean;
  rollbackSupported?: boolean;
  rollbackManual?: boolean;
  status?: BiosStatus;
  button?: string;
  state?: { key?: string; label?: string; currentMhz?: number | null; ratedMhz?: number | null } | null;
  expected?: { key?: string } | null;
  auto?: boolean;
  capability?: { ok?: boolean; mode?: string; requiresAdmin?: boolean; reason?: string } | null;
  compatibility?: string;
  provider?: string;
  paths?: string[];
  steps?: string[];
  pending?: { operationId?: string; status?: string } | null;
  currentMhz?: number | null;
  ratedMhz?: number | null;
}

interface BiosPayload {
  provider?: string;
  providerName?: string;
  elevated?: boolean;
  hardware?: { cpu?: string; board?: string; vendorKey?: string } | null;
  items?: BiosItem[];
  counts?: { all?: number; available?: number; manual?: number; active?: number; pending?: number; found?: number };
  pending?: unknown[];
  logs?: string[];
}

interface BiosPreview {
  setting?: string;
  operation?: string;
  current?: string;
  next?: string;
  reboot?: string;
  provider?: string;
  mode?: string;
  reason?: string;
  currentMhz?: number | null;
  ratedMhz?: number | null;
}

interface BiosGuide {
  id?: string;
  name?: string;
  description?: string;
  current?: { key?: string; label?: string } | null;
  recommended?: string;
  paths?: string[];
  steps?: string[];
  requiresReboot?: boolean;
  rollbackManual?: boolean;
}

interface BiosApplyResult {
  ok?: boolean;
  applied?: boolean;
  verified?: boolean;
  pending?: boolean;
  manual?: boolean;
  code?: string;
  message?: string;
  reboot?: { ok?: boolean; message?: string } | null;
}

interface BiosBootVerify {
  checked?: { operationId?: string; setting?: string; status?: string; detail?: string }[];
  payload?: BiosPayload;
}

interface BiosApi {
  getLast(): Promise<LastAnalysis | null | undefined>;
  biosScan?(): Promise<BiosPayload>;
  biosList(): Promise<BiosPayload>;
  biosDryRun(id: string): Promise<BiosPreview>;
  biosGuide(id: string): Promise<BiosGuide>;
  biosApply(payload: { id: string; reboot?: boolean; dryRunOnly?: boolean }): Promise<BiosApplyResult>;
  biosScheduleVerify?(id: string): Promise<{ ok?: boolean }>;
  biosVerifyPending?(): Promise<BiosBootVerify>;
  biosRollback(id: string): Promise<{ ok?: boolean; manual?: boolean; message?: string }>;
  biosReboot?(): Promise<{ ok?: boolean; message?: string }>;
  biosLogs?(): Promise<string[]>;
  onBiosBootVerify?(cb: (res: BiosBootVerify) => void): void;
}

// ---------------------------------------------------------------------------
// Constantes de apresentação (equivalentes ao legado)
// ---------------------------------------------------------------------------

const LEVEL_META: Record<Level, { label: string; color: string; text: string }> = {
  critical: { label: 'CRÍTICA', color: '#f87171', text: 'text-red-400' },
  recommended: { label: 'RECOMENDADA', color: '#4ade80', text: 'text-green-400' },
  optional: { label: 'OPCIONAL', color: '#fbbf24', text: 'text-amber-400' },
  informational: { label: 'INFORMATIVA', color: 'var(--orion-text-secondary)', text: 'text-muted-foreground' },
  advanced: { label: 'AVANÇADA', color: '#fb923c', text: 'text-orange-400' },
};

const RISK_LABEL: Record<string, string> = {
  low: 'RISCO BAIXO',
  medium: 'RISCO MÉDIO',
  high: 'RISCO ALTO',
  info: 'INFORMATIVO',
};
const RISK_CLASS: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-muted-foreground',
};
const IMPACT_LABEL: Record<string, string> = {
  low: 'IMPACTO BAIXO',
  medium: 'IMPACTO MÉDIO',
  high: 'IMPACTO ALTO',
};

const GROUP_ORDER: Level[] = ['critical', 'recommended', 'optional', 'informational'];
const GROUP_TITLES: Record<Level, string> = {
  critical: 'Críticas — atenção imediata',
  recommended: 'Recomendadas',
  optional: 'Opcionais',
  informational: 'Informativas',
  advanced: 'Avançado — não recomendado para usuários comuns',
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'critical', label: 'Críticas' },
  { key: 'recommended', label: 'Recomendadas' },
  { key: 'optional', label: 'Opcionais' },
  { key: 'informational', label: 'Informativas' },
];

const BIOS_BUTTON_LABEL: Record<string, string> = {
  available: 'ATIVAR',
  active: 'ATIVO',
  manual: 'CONFIGURAÇÃO MANUAL',
  pending_reboot: 'AGUARDANDO REINICIALIZAÇÃO',
  verifying: 'VERIFICANDO',
  applying: 'APLICANDO',
  success: 'SUCESSO',
  failed: 'FALHOU',
  unavailable: 'INDISPONÍVEL',
  informational: 'VERIFICAR',
  rollback: 'DESFAZER',
};

const DISABLED_STATUSES = ['active', 'pending_reboot', 'verifying', 'applying', 'success', 'unavailable'];

function biosStatusLabel(item: BiosItem): string {
  if (item.status === 'pending_reboot') return 'Aguardando reinicialização';
  if (item.status === 'verifying') return 'Verificando alterações...';
  if (item.status === 'success') return 'ATIVADO';
  if (item.status === 'failed') return 'FALHOU';
  if (item.status === 'active') return 'ATIVADO';
  if (item.status === 'applying') return 'Preparando otimização...';
  return item.state && item.state.label ? item.state.label : 'NÃO DETERMINADO';
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

function levelMeta(level?: string) {
  return (level && (LEVEL_META as Record<string, { label: string; color: string; text: string }>)[level]) || LEVEL_META.informational;
}

function groupsFrom(last: LastAnalysis | null): Partial<Record<Level, Recommendation[]>> {
  if (!last) return {};
  if (last.groups) return last.groups;
  const out: Partial<Record<Level, Recommendation[]>> = {};
  for (const r of last.recommendations || []) {
    const lvl: Level = r.effectiveLevel || 'informational';
    (out[lvl] ||= []).push(r);
  }
  return out;
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

function Badges({ risk, impact, reboot, extra }: { risk?: string; impact?: string; reboot?: boolean; extra?: string[] }) {
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
      {(extra || []).map((e) => (
        <span key={e} className="rounded-md bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {e}
        </span>
      ))}
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

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="m-0 py-0.5 text-sm text-muted-foreground">
      {label}: <span className="font-semibold text-foreground">{value}</span>
    </p>
  );
}

interface DialogSpec {
  title: string;
  body: React.ReactNode;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Bios({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as BiosApi;
  const [bios, setBios] = React.useState<BiosPayload | null>(null);
  const [last, setLast] = React.useState<LastAnalysis | null>(null);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [scanning, setScanning] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyBanner, setVerifyBanner] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [details, setDetails] = React.useState<Recommendation | null>(null);
  const [dialog, setDialog] = React.useState<(DialogSpec & { resolve: (v: boolean) => void }) | null>(null);
  const [showLogs, setShowLogs] = React.useState(false);
  const alive = React.useRef(true);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = React.useRef<typeof dialog>(null);
  dialogRef.current = dialog;

  const toast = React.useCallback((type: BannerType, text: string, ms = 6000) => {
    if (!alive.current) return;
    setBanner({ type, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (alive.current) setBanner(null); }, ms);
  }, []);

  const ask = React.useCallback((spec: DialogSpec) => new Promise<boolean>((resolve) => {
    if (!alive.current) { resolve(false); return; }
    setDialog({ ...spec, resolve });
  }), []);

  const closeDialog = React.useCallback((value: boolean) => {
    const d = dialogRef.current;
    if (d) d.resolve(value);
    setDialog(null);
  }, []);

  const refreshBios = React.useCallback(async () => {
    try {
      const payload = await api.biosList();
      if (alive.current && payload) setBios(payload);
    } catch (err) {
      toast('error', errMsg(err, 'Não foi possível carregar as otimizações de BIOS.'));
    }
  }, [api, toast]);

  const loadLast = React.useCallback(async () => {
    try {
      const l = await api.getLast?.();
      if (alive.current && l) setLast(l);
    } catch { /* sem análise ainda */ }
  }, [api]);

  // Carga inicial + listener de verificação pós-reinício.
  React.useEffect(() => {
    alive.current = true;
    loadLast();
    refreshBios();
    api.onBiosBootVerify?.((res) => {
      if (!alive.current) return;
      if (res?.payload) setBios(res.payload);
      if (res?.checked && res.checked.length) {
        const ok = res.checked.filter((c) => c.status === 'success').length;
        const fail = res.checked.filter((c) => c.status === 'failed').length;
        setVerifyBanner(`Verificando alterações... ${ok} confirmada(s), ${fail} falha(s).`);
      }
      toast('info', 'Verificação pós-reinício da BIOS concluída.');
    });
    return () => {
      alive.current = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      if (dialogRef.current) dialogRef.current.resolve(false);
    };
  }, [api, loadLast, refreshBios, toast]);

  // Esc fecha modais.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dialogRef.current) closeDialog(false);
      setDetails(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDialog]);

  // ---- Ações ----

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setVerifyBanner(null);
    try {
      let payload: BiosPayload | null = null;
      if (api.biosScan) payload = await api.biosScan();
      else payload = await api.biosList();
      if (!alive.current) return;
      if (payload) setBios(payload);
      await loadLast();
      const found = payload?.counts?.found;
      toast('success', found != null ? `${found} otimização(ões) encontrada(s)` : 'Análise de BIOS concluída.');
    } catch (err) {
      toast('error', errMsg(err, 'Falha ao analisar a BIOS.'));
    } finally {
      if (alive.current) setScanning(false);
    }
  };

  const findItem = (id: string) => bios?.items?.find((x) => x.id === id) || null;

  const openBiosGuide = async (id: string, item: BiosItem | null) => {
    try {
      const g = await api.biosGuide(id);
      const verify = await ask({
        title: 'Configuração manual necessária',
        okLabel: 'Avisar após reiniciar',
        cancelLabel: 'Fechar',
        body: (
          <div>
            <p className="m-0 text-sm font-semibold text-foreground">{g.name}</p>
            {g.description && <p className="mt-1">{g.description}</p>}
            <ModalSection title="Valor atual"><p className="m-0">{dash(g.current && g.current.label)}</p></ModalSection>
            <ModalSection title="Valor recomendado"><p className="m-0">{dash(g.recommended)}</p></ModalSection>
            <ModalSection title="Caminho aproximado">
              <ul className="m-0 list-disc pl-5 font-mono text-xs">
                {(g.paths || []).map((p, i) => <li key={i}>{p}</li>)}
                {!(g.paths || []).length && <li>—</li>}
              </ul>
            </ModalSection>
            <ModalSection title="Como fazer">
              <ol className="m-0 list-decimal pl-5">
                {(g.steps || []).map((s, i) => <li key={i} className="py-0.5">{s}</li>)}
                {!(g.steps || []).length && <li>Consulte o manual da placa-mãe.</li>}
              </ol>
            </ModalSection>
            {item?.compatibility && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {item.compatibility}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              O Orion não afirma que a opção foi aplicada até verificar o hardware de novo.
            </p>
          </div>
        ),
      });
      if (verify && api.biosScheduleVerify) {
        await api.biosScheduleVerify(id);
        await refreshBios();
        toast('info', 'Operação pendente criada. Após reiniciar, o Orion verifica o resultado.');
      }
    } catch (err) {
      toast('error', errMsg(err, 'Não foi possível abrir o guia.'));
    }
  };

  const handleBiosAction = async (id: string) => {
    const item = findItem(id);
    if (!item) return;
    if (item.status === 'manual' || item.status === 'informational' || !item.auto) {
      await openBiosGuide(id, item);
      return;
    }
    setBusyId(id);
    try {
      const preview = await api.biosDryRun(id);
      const ok = await ask({
        title: item.requiresReboot ? 'Esta otimização exige uma reinicialização.' : 'Aplicar otimização',
        okLabel: item.requiresReboot ? 'APLICAR E REINICIAR' : 'APLICAR',
        danger: !!item.requiresReboot,
        body: (
          <div>
            <KV label="Configuração" value={dash(preview.setting)} />
            <KV label="Estado atual" value={dash(preview.current)} />
            <KV label="Estado esperado" value={dash(preview.next)} />
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Somente a operação autorizada será executada. Um prompt UAC pode aparecer.
            </p>
          </div>
        ),
      });
      if (!ok) return;
      toast('info', 'Preparando otimização...');
      const res = await api.biosApply({ id, reboot: !!item.requiresReboot });
      if (res.manual) {
        await openBiosGuide(id, item);
        return;
      }
      if (!res.ok) {
        toast('error', res.message || 'Falha ao aplicar.');
      } else {
        toast('success', res.message || 'Operação registrada.');
      }
      await refreshBios();
    } catch (err) {
      toast('error', errMsg(err, 'Falha ao aplicar a otimização.'));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const handleBiosDryRun = async (id: string) => {
    const item = findItem(id);
    const isAuto = !!(item && item.auto);
    setBusyId(id);
    try {
      const preview = await api.biosDryRun(id);
      const go = await ask({
        title: 'Otimizar BIOS',
        okLabel: 'OTIMIZAR BIOS',
        body: (
          <div>
            <p className="m-0 mb-2">O Orion pretende:</p>
            <KV label="Alteração" value={dash(preview.setting)} />
            <KV label="Atual" value={dash(preview.current)} />
            <KV label="Novo" value={dash(preview.next)} />
            <KV label="Reboot" value={dash(preview.reboot)} />
            <KV label="Provider" value={dash(preview.provider)} />
            <KV label="Modo" value={dash(preview.mode)} />
            {preview.reason && <p className="mt-2 text-xs text-muted-foreground">{preview.reason}</p>}
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isAuto
                ? 'A otimização será aplicada automaticamente e verificada após a reinicialização.'
                : 'Esta alteração exige configuração manual na BIOS — o botão acima apenas explica o procedimento.'}
            </p>
          </div>
        ),
      });
      if (!alive.current) return;
      setBusyId(null);
      if (go) await handleBiosAction(id);
    } catch (err) {
      toast('error', errMsg(err, 'Não foi possível simular a otimização.'));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const handleBiosRollback = async (id: string) => {
    const item = findItem(id);
    const ok = await ask({
      title: 'Desfazer otimização',
      okLabel: 'DESFAZER',
      body: (
        <div>
          <p className="m-0">
            Restaurar o estado anterior de <span className="font-semibold text-foreground">{item?.name || id}</span>?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            O Orion tentará reverter a alteração usando o snapshot salvo. Se não for possível, será indicado um rollback manual.
          </p>
        </div>
      ),
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await api.biosRollback(id);
      if (res.ok) toast('success', res.message || 'Rollback concluído.');
      else toast('warning', res.message || 'Rollback manual');
      await refreshBios();
    } catch (err) {
      toast('error', errMsg(err, 'Falha ao desfazer.'));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const handleVerifyPending = async () => {
    if (!api.biosVerifyPending || verifying) return;
    setVerifying(true);
    try {
      const res = await api.biosVerifyPending();
      if (!alive.current) return;
      if (res?.payload) setBios(res.payload);
      const checked = res?.checked || [];
      if (checked.length) {
        const ok = checked.filter((c) => c.status === 'success').length;
        const fail = checked.filter((c) => c.status === 'failed').length;
        setVerifyBanner(`Verificando alterações... ${ok} confirmada(s), ${fail} falha(s).`);
        toast(fail ? 'warning' : 'success', `Verificação concluída: ${ok} confirmada(s), ${fail} falha(s).`);
      } else {
        toast('info', 'Nenhuma operação pendente para verificar.');
      }
    } catch (err) {
      toast('error', errMsg(err, 'Falha ao verificar operações pendentes.'));
    } finally {
      if (alive.current) setVerifying(false);
    }
  };

  const handleReboot = async () => {
    if (!api.biosReboot) return;
    const ok = await ask({
      title: 'Reiniciar o computador agora?',
      okLabel: 'REINICIAR AGORA',
      cancelLabel: 'Depois',
      danger: true,
      body: (
        <div>
          <p className="m-0">
            Salve seu trabalho antes de continuar. Após a reinicialização, o Orion verificará automaticamente as otimizações pendentes.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Programas abertos serão fechados. Um prompt UAC pode aparecer.
          </p>
        </div>
      ),
    });
    if (!ok) return;
    try {
      const res = await api.biosReboot();
      if (res?.ok) toast('info', res.message || 'Reinicialização solicitada.');
      else toast('error', res?.message || 'Não foi possível reiniciar.');
    } catch (err) {
      toast('error', errMsg(err, 'Não foi possível reiniciar.'));
    }
  };

  const refreshLogs = async () => {
    if (!api.biosLogs) return;
    try {
      const logs = await api.biosLogs();
      if (alive.current && Array.isArray(logs)) setBios((prev) => ({ ...(prev || {}), logs }));
    } catch { /* ok */ }
  };

  // ---- Dados derivados ----

  const items = (bios?.items || []).filter((i) => filter === 'all' || i.level === filter);
  const found = bios?.counts?.found != null ? bios.counts.found : (bios?.items || []).length;
  const hasScan = !!(bios && bios.items && bios.items.length);
  const pendingCount = bios?.counts?.pending || 0;
  const groups = groupsFrom(last);
  const groupsToShow = GROUP_ORDER.filter((g) => (groups[g] || []).length && (filter === 'all' || filter === g));
  const totalRecs = (last?.recommendations || []).length;
  const logs = bios?.logs || [];

  const foundLabel = hasScan
    ? `${found} otimização(ões) encontrada(s) · provider ${bios?.providerName || bios?.provider || '—'}`
    : 'Analise o computador para detectar otimizações de firmware.';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">BIOS</h2>
          <p className="mt-1 text-sm text-muted-foreground">{foundLabel}</p>
          {bios?.hardware && (bios.hardware.board || bios.hardware.cpu) && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <CircuitBoard className="h-3.5 w-3.5 text-[var(--orion-icon-default)]" />
              {[bios.hardware.board, bios.hardware.cpu].filter(Boolean).join(' · ')}
              {bios.elevated === false && <span className="text-amber-400">· sem privilégios de administrador</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
          >
            <RefreshCcw className={'h-4 w-4 ' + (scanning ? 'animate-spin' : '')} />
            {scanning ? 'Analisando…' : 'ANALISAR'}
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

      {/* Pendências de reinicialização */}
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <Power className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Há otimizações aguardando reinicialização. O Orion confirmará o resultado na próxima inicialização.
          </span>
          {api.biosVerifyPending && (
            <button
              type="button"
              onClick={handleVerifyPending}
              disabled={verifying}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] disabled:opacity-60"
            >
              <RefreshCcw className={'h-3.5 w-3.5 ' + (verifying ? 'animate-spin' : '')} />
              {verifying ? 'Verificando…' : 'VERIFICAR AGORA'}
            </button>
          )}
          {api.biosReboot && (
            <button
              type="button"
              onClick={handleReboot}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
            >
              <Power className="h-3.5 w-3.5" />
              REINICIAR AGORA
            </button>
          )}
        </div>
      )}

      {verifyBanner && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-3 text-sm text-[var(--orion-icon-active)]">
          <Info className="h-4 w-4 shrink-0" />
          <span className="flex-1">{verifyBanner}</span>
          <button type="button" onClick={() => setVerifyBanner(null)} className="text-current opacity-70 hover:opacity-100" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[var(--orion-icon-active)] text-black'
                  : 'bg-[var(--orion-surface)] text-muted-foreground hover:bg-[var(--orion-selected-bg)] hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Otimizações de BIOS */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CircuitBoard className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Otimizações de BIOS</span>
          {hasScan && <span className="text-xs text-muted-foreground">({items.length})</span>}
        </div>

        {scanning && !hasScan && (
          <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            <p className="text-sm text-muted-foreground">Detectando otimizações de firmware…</p>
          </div>
        )}

        {!scanning && !hasScan && (
          <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              Execute ANALISAR para detectar otimizações de BIOS neste computador.
            </p>
            <button
              type="button"
              onClick={handleScan}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
            >
              <RefreshCcw className="h-4 w-4" />
              ANALISAR
            </button>
          </div>
        )}

        {hasScan && items.length === 0 && (
          <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-center text-sm text-muted-foreground">
            Nenhuma otimização nesta categoria.
          </div>
        )}

        {items.map((item) => {
          const meta = levelMeta(item.level);
          const status = item.status || 'informational';
          const btnLabel = BIOS_BUTTON_LABEL[status] || item.button || 'VERIFICAR';
          const disabled = DISABLED_STATUSES.includes(status) || busyId === item.id;
          const outline = status === 'manual' || status === 'informational';
          const isMem = item.id === 'xmp' || item.id === 'expo' || item.id === 'docp';
          const statusOk = status === 'active' || status === 'success';
          const statusFail = status === 'failed';
          return (
            <div key={item.id} className="rounded-lg border-l-4 bg-[var(--orion-surface)] px-5 py-4" style={{ borderLeftColor: meta.color }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status:{' '}
                    <span className={`font-semibold ${statusOk ? 'text-green-400' : statusFail ? 'text-red-400' : 'text-foreground'}`}>
                      {biosStatusLabel(item)}
                    </span>
                  </p>
                  {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                  {isMem && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Memória atual: <span className="font-semibold text-foreground">{dash(item.currentMhz)} MT/s</span>
                      {item.ratedMhz ? (
                        <> · Perfil disponível: <span className="font-semibold text-foreground">{item.ratedMhz} MT/s</span></>
                      ) : null}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
              </div>

              <Badges
                risk={item.risk}
                impact={item.impact}
                reboot={item.requiresReboot}
                extra={[item.auto ? 'AUTOMÁTICO' : 'MANUAL']}
              />

              <p className="mt-3 font-mono text-[0.7rem] text-muted-foreground">
                {(item.paths || []).join(' · ')}
                {item.compatibility ? ` · ${item.compatibility}` : ''}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBiosAction(item.id)}
                  disabled={disabled}
                  className={
                    outline
                      ? 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60'
                      : 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60'
                  }
                >
                  {outline ? <ClipboardList className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  {btnLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleBiosDryRun(item.id)}
                  disabled={busyId === item.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                >
                  <Info className="h-3.5 w-3.5" />
                  {item.auto ? 'OTIMIZAR BIOS' : 'Otimizar BIOS'}
                </button>
                {item.rollbackSupported ? (
                  <button
                    type="button"
                    onClick={() => handleBiosRollback(item.id)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    DESFAZER
                  </button>
                ) : item.rollbackManual && statusOk ? (
                  <span className="text-xs text-muted-foreground">Rollback manual</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      {/* Recomendações da última análise */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recomendações da análise</span>
          {totalRecs > 0 && <span className="text-xs text-muted-foreground">({totalRecs})</span>}
        </div>

        {!last && (
          <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-sm text-muted-foreground">
            Nenhuma análise disponível. Execute a análise na tela{' '}
            <button
              type="button"
              onClick={() => onNavigate?.('sistema')}
              className="font-semibold text-[var(--orion-icon-active)] transition-colors hover:text-[var(--orion-hover-fg)]"
            >
              Sistema
            </button>{' '}
            para ver as recomendações.
          </div>
        )}

        {last && groupsToShow.length === 0 && (
          <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-center text-sm text-muted-foreground">
            Nenhuma recomendação nesta categoria.
          </div>
        )}

        {groupsToShow.map((g) => {
          const list = groups[g] || [];
          return (
            <div key={g} className="space-y-3">
              <p className={`m-0 mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${LEVEL_META[g].text}`}>
                {GROUP_TITLES[g]} ({list.length})
              </p>
              {list.map((r) => <RecCard key={r.id} rec={r} onDetails={setDetails} />)}
            </div>
          );
        })}
      </section>

      {/* Logs de BIOS */}
      <section className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <button
          type="button"
          onClick={() => { setShowLogs((v) => !v); if (!showLogs) refreshLogs(); }}
          className="flex w-full items-center gap-2 text-left"
        >
          <Terminal className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Logs de BIOS</span>
          <ChevronRight className={'h-4 w-4 text-muted-foreground transition-transform ' + (showLogs ? 'rotate-90' : '')} />
        </button>
        {showLogs && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
            {logs.length ? logs.join('\n') : 'Nenhum registro ainda.'}
          </pre>
        )}
      </section>

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
                  Os nomes das opções podem variar conforme fabricante e versão da BIOS. Esta ferramenta orienta manualmente — nunca aplica alterações automaticamente.
                </p>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Diálogo de confirmação/prompt */}
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => closeDialog(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-selected-bg)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-hover-glow)] hover:text-[var(--orion-hover-fg)]"
              >
                {dialog.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className={
                  dialog.danger
                    ? 'inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-400'
                    : 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]'
                }
              >
                {dialog.okLabel || 'Continuar'}
              </button>
            </>
          }
        >
          {dialog.body}
        </Modal>
      )}
    </div>
  );
}
