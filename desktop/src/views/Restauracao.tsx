import React from 'react';
import { RefreshCcw, RotateCcw, History, X, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Database } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos (formato do engine: engineService.listOperations / getOperation)
// ---------------------------------------------------------------------------

interface OperationSummary {
  id: string;
  ts: number | string;
  label?: string;
  profile?: string | null;
  itemCount?: number;
  successCount?: number;
}

interface OperationItem {
  id: string;
  name?: string;
  hasBackup?: boolean;
}

interface OperationDetail extends OperationSummary {
  items?: OperationItem[];
  results?: { ok?: boolean; name?: string; message?: string }[];
}

interface UndoResult {
  ok?: boolean;
  message?: string;
  error?: string;
  results?: { id?: string; ok?: boolean; message?: string }[];
}

interface EngineStep {
  name?: string;
  ok?: boolean;
  message?: string;
}

interface LocalApi {
  engineListOperations(): Promise<OperationSummary[]>;
  engineGetOperation(opId: string): Promise<OperationDetail | null>;
  engineUndoOperation(opId: string): Promise<UndoResult>;
  engineUndoItem(id: string): Promise<UndoResult>;
  onEngineStep?(cb: (step: EngineStep) => void): void;
}

type UndoOneState = 'idle' | 'busy' | 'done' | 'failed';
type UndoAllState = 'idle' | 'busy' | 'done';

interface ToastEntry { id: number; text: string; kind: 'info' | 'ok' | 'warn' | 'error' }

const PRIMARY_BTN = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';

function fmtDate(ts: number | string | undefined): string {
  if (ts == null) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString('pt-BR');
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Erro desconhecido.';
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function Restauracao({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;

  const [ops, setOps] = React.useState<OperationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OperationDetail | null>(null);
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const aliveRef = React.useRef(true);
  const toastTimers = React.useRef<number[]>([]);
  const seq = React.useRef(0);
  const undoingRef = React.useRef(false);

  const toast = React.useCallback((text: string, kind: ToastEntry['kind'] = 'info', ms = 5000) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    const t = window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      toastTimers.current = toastTimers.current.filter((x) => x !== t);
    }, ms);
    toastTimers.current.push(t);
  }, []);

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.engineListOperations();
      if (!aliveRef.current) return;
      setOps(Array.isArray(list) ? list : []);
      setUpdatedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      if (aliveRef.current) setLoadError(`Não foi possível carregar o histórico: ${errMessage(err)}`);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
      toastTimers.current.forEach((t) => window.clearTimeout(t));
      toastTimers.current = [];
    };
  }, [load]);

  // Passos do engine durante "desfazer operação completa" (o preload não expõe
  // unsubscribe; o callback ignora eventos após unmount via aliveRef).
  React.useEffect(() => {
    if (typeof api.onEngineStep !== 'function') return;
    let registered = true;
    api.onEngineStep((step) => {
      if (!registered || !aliveRef.current) return;
      if (!step || !step.name || !undoingRef.current) return;
      toast(`${step.ok ? '✅' : '❌'} ${step.name}${step.message ? ` — ${step.message}` : ''}`, step.ok ? 'ok' : 'error', 3500);
    });
    return () => { registered = false; };
  }, [api, toast]);

  const openDetails = async (opId: string) => {
    if (openingId) return;
    setOpeningId(opId);
    try {
      const op = await api.engineGetOperation(opId);
      if (!aliveRef.current) return;
      if (!op) { toast('❌ Operação não encontrada.', 'error'); return; }
      setDetail(op);
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error');
    } finally {
      if (aliveRef.current) setOpeningId(null);
    }
  };

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Central de Restauração</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de otimizações aplicadas neste computador. Use <b className="text-foreground">DESFAZER</b> para reverter itens individualmente ou uma operação completa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">{updatedAt}</span>}
          <button type="button" onClick={load} disabled={loading} className={SECONDARY_BTN}>
            <RefreshCcw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            {loading ? 'Atualizando…' : 'ATUALIZAR'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-500/10 px-5 py-3 text-sm text-red-400">
          <span className="flex items-center gap-2"><XCircle className="h-4 w-4" />{loadError}</span>
          <button type="button" onClick={load} className={SECONDARY_BTN}>Tentar novamente</button>
        </div>
      )}

      {loading && ops.length === 0 && !loadError && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        </div>
      )}

      {!loading && !loadError && ops.length === 0 && (
        <div className="flex flex-col items-center rounded-lg bg-[var(--orion-surface)] p-10 text-center">
          <History className="mb-3 h-10 w-10 text-[var(--orion-icon-default)]/40" />
          <p className="mb-1 text-lg font-semibold text-foreground">Nenhuma operação registrada ainda.</p>
          <p className="mb-5 text-sm text-muted-foreground">As otimizações aplicadas em <b className="text-foreground">Windows</b> aparecerão aqui e poderão ser desfeitas.</p>
          <button type="button" onClick={() => onNavigate?.('optimize')} className={PRIMARY_BTN}>
            <ChevronRight className="h-4 w-4" />
            IR PARA OTIMIZAÇÕES
          </button>
        </div>
      )}

      {ops.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-[var(--orion-surface)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Data</th>
                <th className="px-5 py-3 font-semibold">Operação</th>
                <th className="px-5 py-3 text-right font-semibold">Itens</th>
                <th className="px-5 py-3 text-right font-semibold">Sucesso</th>
                <th className="px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => {
                const total = op.itemCount ?? 0;
                const ok = op.successCount ?? 0;
                const allOk = total > 0 && ok === total;
                return (
                  <tr key={op.id} className="border-t border-[var(--orion-selected-bg)] transition-colors hover:bg-[var(--orion-selected-bg)]/40">
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{fmtDate(op.ts)}</td>
                    <td className="px-5 py-3">
                      <span className="text-foreground">{op.label || '—'}</span>
                      {op.profile && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
                          {op.profile}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground">{total}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${allOk ? 'text-green-400' : 'text-amber-400'}`}>
                      {ok}/{total}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetails(op.id)}
                        disabled={openingId != null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--orion-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
                      >
                        {openingId === op.id ? 'Abrindo…' : 'DETALHES'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <OperationDetailsDialog
          op={detail}
          api={api}
          toast={toast}
          undoingRef={undoingRef}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ${
                t.kind === 'error' ? 'bg-[var(--orion-surface)] text-red-400 ring-red-500/30'
                  : t.kind === 'warn' ? 'bg-[var(--orion-surface)] text-amber-400 ring-amber-500/30'
                    : t.kind === 'ok' ? 'bg-[var(--orion-surface)] text-green-400 ring-green-500/30'
                      : 'bg-[var(--orion-surface)] text-foreground ring-[var(--orion-hover-border)]'
              }`}
            >
              <span className="flex-1">{t.text}</span>
              <button type="button" onClick={() => dismissToast(t.id)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Fechar">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de detalhes da operação
// ---------------------------------------------------------------------------

function OperationDetailsDialog({ op, api, toast, undoingRef, onClose, onChanged }: {
  op: OperationDetail;
  api: LocalApi;
  toast: (text: string, kind?: ToastEntry['kind'], ms?: number) => void;
  undoingRef: React.MutableRefObject<boolean>;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [undoOne, setUndoOne] = React.useState<Record<string, UndoOneState>>({});
  const [undoAll, setUndoAll] = React.useState<UndoAllState>('idle');
  const [confirmAll, setConfirmAll] = React.useState(false);

  const results = op.results || [];
  const items = op.items || [];
  const okCount = results.filter((r) => r.ok).length;
  const reversible = items.filter((it) => it.hasBackup).length;
  const busy = undoAll === 'busy' || Object.values(undoOne).some((s) => s === 'busy');

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        if (confirmAll) setConfirmAll(false); else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, confirmAll, onClose]);

  const handleUndoOne = async (id: string) => {
    if (busy) return;
    setUndoOne((prev) => ({ ...prev, [id]: 'busy' }));
    try {
      const r = await api.engineUndoItem(id);
      const msg = r?.message || (r?.ok ? 'Item revertido.' : 'Não foi possível reverter.');
      toast(r?.ok ? `↩️ ${msg}` : `⚠ ${msg}`, r?.ok ? 'ok' : 'warn', 7000);
      setUndoOne((prev) => ({ ...prev, [id]: r?.ok ? 'done' : 'failed' }));
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error');
      setUndoOne((prev) => ({ ...prev, [id]: 'idle' }));
    }
  };

  const handleUndoAll = async () => {
    setConfirmAll(false);
    if (busy) return;
    setUndoAll('busy');
    undoingRef.current = true;
    try {
      const r = await api.engineUndoOperation(op.id);
      if (r?.error) {
        toast(`⚠ ${r.error}`, 'warn', 9000);
        setUndoAll('idle');
      } else {
        toast(r?.ok ? '↩️ Operação revertida por completo.' : '⚠ Reversão concluída com avisos.', r?.ok ? 'ok' : 'warn', 9000);
        setUndoAll('done');
        if (r?.results?.length) {
          setUndoOne((prev) => {
            const next = { ...prev };
            r.results!.forEach((x) => { if (x.id) next[x.id] = x.ok ? 'done' : 'failed'; });
            return next;
          });
        }
        await onChanged();
      }
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error', 9000);
      setUndoAll('idle');
    } finally {
      undoingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opDetailsTitle"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="flex w-full max-w-xl flex-col rounded-lg bg-[var(--orion-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[var(--orion-hover-border)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="opDetailsTitle" className="m-0 text-lg font-bold text-foreground">Operação de {fmtDate(op.ts)}</h2>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              <b className="text-foreground">{op.label || '—'}</b> — {okCount}/{results.length} passos OK.
              {op.profile && <span className="ml-1 text-[var(--orion-icon-active)]">· perfil {op.profile}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="my-4 max-h-72 list-none space-y-1.5 overflow-y-auto p-0 pr-1">
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum item registrado nesta operação.</li>
          )}
          {items.map((it, idx) => {
            const st = undoOne[it.id] || 'idle';
            const res = results[idx];
            return (
              <li key={`${it.id}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--orion-bg)] px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {res ? (
                    res.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  ) : <span className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate text-foreground">{it.name || it.id}</span>
                  {it.hasBackup && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] text-muted-foreground">
                      <Database className="h-3 w-3" /> com backup
                    </span>
                  )}
                </span>
                {it.hasBackup && (
                  <button
                    type="button"
                    disabled={busy || st === 'busy' || st === 'done'}
                    onClick={() => handleUndoOne(it.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[0.68rem] font-semibold transition-colors disabled:opacity-60 ${
                      st === 'done'
                        ? 'bg-green-500/15 text-green-400'
                        : st === 'failed'
                          ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                          : 'bg-[var(--orion-surface)] text-[var(--orion-icon-active)] hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]'
                    }`}
                  >
                    {st === 'busy' ? (
                      <><RotateCcw className="h-3 w-3 animate-spin" /> …</>
                    ) : st === 'done' ? (
                      <><CheckCircle2 className="h-3 w-3" /> REVERTIDO</>
                    ) : st === 'failed' ? (
                      <><XCircle className="h-3 w-3" /> FALHOU</>
                    ) : (
                      <><RotateCcw className="h-3 w-3" /> DESFAZER</>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmAll(true)}
            disabled={busy || undoAll === 'done' || items.length === 0}
            className={PRIMARY_BTN}
          >
            <RotateCcw className={'h-4 w-4 ' + (undoAll === 'busy' ? 'animate-spin' : '')} />
            {undoAll === 'busy' ? 'DESFAZENDO…' : undoAll === 'done' ? 'CONCLUÍDO' : 'DESFAZER OPERAÇÃO COMPLETA'}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BTN}>FECHAR</button>
        </div>
        <p className="mb-0 mt-4 text-xs text-muted-foreground">
          Desfazer restaura as chaves do registro salvas antes da aplicação e executa as ações de reversão de cada item. Alguns itens (limpezas) não podem ser revertidos.
          {items.length > 0 && <> {reversible} de {items.length} item(ns) possui(em) backup de registro.</>}
        </p>
      </div>

      {confirmAll && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmUndoAllTitle"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmAll(false); }}
        >
          <div className="w-full max-w-md rounded-lg bg-[var(--orion-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[var(--orion-hover-border)]">
            <h3 id="confirmUndoAllTitle" className="m-0 flex items-center gap-2 text-base font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Desfazer operação completa
            </h3>
            <p className="mb-0 mt-3 text-sm text-foreground">Desfazer TODOS os itens reversíveis desta operação?</p>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">
              Um prompt de administrador (UAC) pode ser exibido. Itens sem backup ou sem ação de reversão serão ignorados.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAll(false)} className={SECONDARY_BTN}>Cancelar</button>
              <button type="button" onClick={handleUndoAll} className={PRIMARY_BTN}>
                <RotateCcw className="h-4 w-4" /> Desfazer tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
