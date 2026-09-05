import React from 'react';
import { Brush, Ruler, CheckSquare, Square, Wrench, Zap, ShieldAlert, Clock, CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { useApi } from '@/api';

// ---------- Tipos locais (métodos ainda não tipados em OrionApi) ----------

interface CleanTarget {
  id: string;
  name: string;
  description?: string;
  requiresAdmin?: boolean;
}

interface StepResult {
  name?: string;
  ok?: boolean;
  message?: string;
}

interface CleanResult {
  ok?: boolean;
  error?: string;
  results?: StepResult[];
  launchError?: string | null;
}

interface RepairOption {
  id: string;
  name: string;
  description?: string;
  requiresAdmin?: boolean;
  estimatedMinutes?: number;
}

interface RepairResult {
  ok?: boolean;
  error?: string;
  results?: StepResult[];
  result?: StepResult;
  launchError?: string | null;
}

interface EngineStep {
  name?: string;
  ok?: boolean;
  message?: string;
}

interface LocalApi {
  cleanerTargets(): Promise<CleanTarget[]>;
  cleanerMeasure(ids: string[]): Promise<Record<string, number | null>>;
  cleanerClean(ids: string[]): Promise<CleanResult>;
  repairOptions(): Promise<RepairOption[]>;
  repairRun(optionId: string): Promise<RepairResult>;
  repairQuickFix(): Promise<RepairResult>;
  onEngineStep?: (cb: (step: EngineStep) => void) => void;
}

type Banner = { kind: 'ok' | 'warn' | 'error' | 'info'; text: string } | null;

interface ConfirmState {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

// ---------- Helpers ----------

function fmtMB(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '— MB';
  return v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`;
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

const BANNER_STYLE: Record<NonNullable<Banner>['kind'], string> = {
  ok: 'bg-green-500/15 text-green-400',
  warn: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]',
};

// ---------- View ----------

export function Limpeza({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;

  const [targets, setTargets] = React.useState<CleanTarget[]>([]);
  const [sizes, setSizes] = React.useState<Record<string, number | null>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [measuring, setMeasuring] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [cleanResults, setCleanResults] = React.useState<StepResult[] | null>(null);

  const [repairs, setRepairs] = React.useState<RepairOption[]>([]);
  const [runningRepair, setRunningRepair] = React.useState<string | null>(null); // id ou 'quickfix'
  const [steps, setSteps] = React.useState<EngineStep[]>([]);

  const [banner, setBanner] = React.useState<Banner>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);

  const busyRef = React.useRef<'clean' | 'repair' | null>(null);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = React.useCallback((kind: NonNullable<Banner>['kind'], text: string, ms = 8000) => {
    setBanner({ kind, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  // Carregamento inicial + assinatura dos passos do motor (canal engine:step).
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, r] = await Promise.all([api.cleanerTargets(), api.repairOptions()]);
        if (!alive) return;
        setTargets(Array.isArray(t) ? t : []);
        setRepairs(Array.isArray(r) ? r : []);
        setLoadError(null);
      } catch (err) {
        if (alive) setLoadError(errMsg(err, 'Não foi possível carregar a manutenção.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // O preload não devolve função de cancelamento; protegemos com a flag "alive".
    api.onEngineStep?.((step) => {
      if (!alive || !step || !step.name || !busyRef.current) return;
      setSteps((prev) => [...prev, step]);
    });

    return () => {
      alive = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [api]);

  const totalMB = React.useMemo(
    () => [...selected].reduce((acc, id) => acc + (sizes[id] || 0), 0),
    [selected, sizes],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === targets.length ? new Set() : new Set(targets.map((t) => t.id))));
  };

  const measure = React.useCallback(async () => {
    if (measuring || !targets.length) return;
    setMeasuring(true);
    try {
      const res = await api.cleanerMeasure(targets.map((t) => t.id));
      setSizes(res && typeof res === 'object' ? res : {});
      showBanner('info', 'Tamanhos medidos. Marque o que deseja limpar.', 5000);
    } catch (err) {
      showBanner('error', errMsg(err, 'Falha ao medir tamanhos.'));
    } finally {
      setMeasuring(false);
    }
  }, [api, measuring, targets, showBanner]);

  const runClean = async (ids: string[]) => {
    setCleaning(true);
    busyRef.current = 'clean';
    setSteps([]);
    setCleanResults(null);
    try {
      const res = await api.cleanerClean(ids);
      const results = res?.results || [];
      const ok = results.filter((r) => r.ok).length;
      const total = results.length;
      setCleanResults(results);
      if (res?.error && !total) {
        showBanner('error', res.error);
      } else if (res?.launchError && !ok) {
        showBanner('error', res.launchError);
      } else if (total && ok === total) {
        showBanner('ok', 'Limpeza concluída!');
      } else {
        showBanner('warn', `Limpeza concluída com avisos (${ok}/${total}).`);
      }
      // Re-mede após a limpeza para refletir o espaço liberado.
      setTimeout(() => { void measure(); }, 1500);
    } catch (err) {
      showBanner('error', errMsg(err, 'Falha ao executar a limpeza.'));
    } finally {
      setCleaning(false);
      busyRef.current = null;
    }
  };

  const askClean = () => {
    const ids = [...selected];
    if (!ids.length) { showBanner('warn', 'Marque pelo menos um item para limpar.', 5000); return; }
    setConfirm({
      title: `Limpar ${ids.length} destino(s)?`,
      text: 'Esta ação não pode ser desfeita (arquivos apagados definitivamente).',
      confirmLabel: 'LIMPAR',
      danger: true,
      onConfirm: () => { setConfirm(null); void runClean(ids); },
    });
  };

  const runRepair = async (rep: RepairOption) => {
    setRunningRepair(rep.id);
    busyRef.current = 'repair';
    setSteps([]);
    try {
      const res = await api.repairRun(rep.id);
      if (res?.error) showBanner('error', res.error, 10000);
      else if (res?.ok) showBanner('ok', 'Reparo concluído! Reinicie o PC se algum problema persistia.', 10000);
      else showBanner('warn', res?.launchError || 'Reparo finalizado com avisos — veja os detalhes nos passos acima.', 10000);
    } catch (err) {
      showBanner('error', errMsg(err, 'Falha ao executar o reparo.'), 9000);
    } finally {
      setRunningRepair(null);
      busyRef.current = null;
    }
  };

  const askRepair = (rep: RepairOption) => {
    setConfirm({
      title: `Executar "${rep.name}"?`,
      text: `Pode levar ~${rep.estimatedMinutes ?? '?'} minutos. O PC continua utilizável, mas fique sem fazer tarefas pesadas.`,
      confirmLabel: 'EXECUTAR',
      onConfirm: () => { setConfirm(null); void runRepair(rep); },
    });
  };

  const runQuickFix = async () => {
    setRunningRepair('quickfix');
    busyRef.current = 'repair';
    setSteps([]);
    try {
      const res = await api.repairQuickFix();
      if (res?.ok) showBanner('ok', 'Correção concluída!');
      else showBanner('warn', res?.result?.message || 'Correção finalizada com avisos.');
    } catch (err) {
      showBanner('error', errMsg(err, 'Falha ao executar a correção rápida.'), 9000);
    } finally {
      setRunningRepair(null);
      busyRef.current = null;
    }
  };

  const askQuickFix = () => {
    setConfirm({
      title: 'Executar a correção rápida legada?',
      text: 'Executa o script clássico "Arrumar Windows" (chkdsk, SFC e DISM em sequência). Pode levar vários minutos.',
      confirmLabel: 'EXECUTAR',
      onConfirm: () => { setConfirm(null); void runQuickFix(); },
    });
  };

  const anyBusy = cleaning || runningRepair !== null;
  const allSelected = targets.length > 0 && selected.size === targets.length;

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Limpeza</h2>
          <p className="mt-1 text-sm text-muted-foreground">Limpeza nativa e reparo do Windows — sem programas de terceiros.</p>
        </div>
      </div>

      {banner && (
        <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm ${BANNER_STYLE[banner.kind]}`}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="inline-flex h-6 w-6 items-center justify-center rounded text-current opacity-70 hover:opacity-100" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando manutenção…</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <p className="text-sm text-red-400">Não foi possível carregar a manutenção: {loadError}</p>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* ---------- Limpeza ---------- */}
          <Section title="Limpeza nativa" icon={<Brush className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={measure}
                disabled={measuring || anyBusy || !targets.length}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
              >
                <Ruler className={'h-4 w-4 ' + (measuring ? 'animate-pulse' : '')} />
                {measuring ? 'MEDINDO…' : 'MEDIR TAMANHOS'}
              </button>
              <button
                type="button"
                onClick={toggleAll}
                disabled={anyBusy || !targets.length}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
              >
                {allSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {allSelected ? 'DESMARCAR TODAS' : 'MARCAR TODAS'}
              </button>
              <button
                type="button"
                onClick={askClean}
                disabled={anyBusy || !selected.size}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
              >
                {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brush className="h-4 w-4" />}
                {cleaning ? 'LIMPANDO…' : 'LIMPAR SELECIONADAS'}
              </button>
              {totalMB > 0 && selected.size > 0 && (
                <span className="text-xs text-muted-foreground">~{fmtMB(totalMB)} liberáveis</span>
              )}
            </div>

            {targets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alvo de limpeza disponível.</p>}

            <div className="space-y-1.5">
              {targets.map((t) => {
                const checked = selected.has(t.id);
                const res = cleanResults?.find((r) => r.name === t.name);
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      checked ? 'bg-[var(--orion-selected-bg)]' : 'bg-black/20 hover:bg-[var(--orion-selected-bg)]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={anyBusy}
                      onChange={() => toggle(t.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {t.name}
                        {t.requiresAdmin && <Badge>ADMIN</Badge>}
                        {res && (
                          res.ok
                            ? <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-red-400" title={res.message || ''}><XCircle className="h-3.5 w-3.5" />{res.message ? `Falha — ${res.message}` : 'Falha'}</span>
                        )}
                      </div>
                      {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{fmtMB(sizes[t.id])}</span>
                  </label>
                );
              })}
            </div>
          </Section>

          {/* ---------- Progresso (passos do motor) ---------- */}
          {(anyBusy || steps.length > 0) && (
            <Section title="Execução" icon={<Loader2 className={'h-4 w-4 text-[var(--orion-icon-default)] ' + (anyBusy ? 'animate-spin' : '')} />}>
              {anyBusy && steps.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {cleaning ? 'Limpando… aguardando os passos do motor.' : 'Executando reparo… isto pode levar vários minutos.'}
                </p>
              )}
              {steps.length > 0 && (
                <ul className="m-0 list-none space-y-1 p-0">
                  {steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {s.ok
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                      <span className="text-foreground">{s.name}</span>
                      {s.message && <span className="text-xs text-muted-foreground">— {s.message}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* ---------- Reparos ---------- */}
          <Section title="Reparo do sistema (SFC / DISM)" icon={<Wrench className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {repairs.map((r) => {
                const running = runningRepair === r.id;
                return (
                  <div key={r.id} className="flex flex-col rounded-lg bg-black/20 p-4">
                    <p className="m-0 text-sm font-semibold text-foreground">{r.name}</p>
                    {r.description && <p className="mt-1 flex-1 text-xs text-muted-foreground">{r.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.requiresAdmin && <Badge icon={<ShieldAlert className="h-3 w-3" />}>ADMIN</Badge>}
                      {r.estimatedMinutes != null && <Badge icon={<Clock className="h-3 w-3" />}>~{r.estimatedMinutes} min</Badge>}
                    </div>
                    <button
                      type="button"
                      onClick={() => askRepair(r)}
                      disabled={anyBusy}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                    >
                      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      {running ? 'EXECUTANDO…' : 'EXECUTAR'}
                    </button>
                  </div>
                );
              })}

              {/* Correção rápida (legado) */}
              <div className="flex flex-col rounded-lg bg-black/20 p-4 shadow-[inset_0_0_0_1px_var(--orion-selected-bg)]">
                <p className="m-0 text-sm font-semibold text-foreground">Correção rápida (legado)</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">
                  Executa o script clássico &quot;Arrumar Windows&quot; (chkdsk, SFC e DISM em sequência).
                </p>
                <button
                  type="button"
                  onClick={askQuickFix}
                  disabled={anyBusy}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                >
                  {runningRepair === 'quickfix' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {runningRepair === 'quickfix' ? 'EXECUTANDO…' : 'EXECUTAR CORREÇÃO RÁPIDA'}
                </button>
              </div>
            </div>
          </Section>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

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

function Badge({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
      {icon}
      {children}
    </span>
  );
}

function ConfirmDialog({
  title, text, confirmLabel, danger, onCancel, onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-[var(--orion-surface)] p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="m-0 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)]"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? 'inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/30'
                : 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
