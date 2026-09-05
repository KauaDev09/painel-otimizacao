import React from 'react';
import { Activity, RefreshCcw, Search, X, FolderOpen, Skull, ArrowUp, ArrowDown, ArrowUpDown, Pause, Play, Loader2 } from 'lucide-react';
import { useApi } from '@/api';

// ---------- Tipos locais (métodos ainda não tipados em OrionApi) ----------

type PriorityLevel = 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High';

/** Formato bruto vindo do backend (processService) ou do mock (campos alternativos). */
interface RawProcess {
  id?: number;
  pid?: number;
  name: string;
  cpuSec?: number;
  memMB?: number;
  ramMB?: number;
  priority?: string;
  priorityLabel?: string;
  path?: string;
  company?: string;
  manufacturer?: string;
  windowed?: boolean;
  critical?: boolean;
}

interface ProcessEntry {
  id: number;
  name: string;
  cpuSec: number;
  memMB: number;
  priority: string;
  priorityLabel: string;
  path: string;
  company: string;
  windowed: boolean;
  critical: boolean;
}

interface LocalApi {
  processList(): Promise<RawProcess[]>;
  processKill(payload: { pid: number; name: string }): Promise<{ ok?: boolean }>;
  processSetPriority(payload: { pid: number; name: string; level: PriorityLevel }): Promise<{ ok?: boolean; level?: string }>;
  openPath?: (p: string) => Promise<unknown>;
}

type SortKey = 'name' | 'id' | 'company' | 'cpuSec' | 'memMB';
type SortDir = 'asc' | 'desc';

type Banner = { kind: 'ok' | 'warn' | 'error' | 'info'; text: string } | null;

interface ConfirmState {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const BANNER_STYLE: Record<NonNullable<Banner>['kind'], string> = {
  ok: 'bg-green-500/15 text-green-400',
  warn: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]',
};

const PRIORITY_OPTIONS: [PriorityLevel, string][] = [
  ['Idle', 'Baixa'],
  ['BelowNormal', 'Abaixo normal'],
  ['Normal', 'Normal'],
  ['AboveNormal', 'Acima normal'],
  ['High', 'Alta'],
];

const PRIORITY_LABEL: Record<string, string> = {
  Idle: 'Baixa (idle)',
  BelowNormal: 'Abaixo do normal',
  Normal: 'Normal',
  AboveNormal: 'Acima do normal',
  High: 'Alta',
  RealTime: 'Tempo real',
};

const REFRESH_MS = 4000;
const MAX_ROWS = 300;

// ---------- Helpers ----------

function normalize(raw: RawProcess[]): ProcessEntry[] {
  return raw
    .filter((p) => p && p.name)
    .map((p) => {
      const priority = p.priority || 'Normal';
      return {
        id: Number(p.id ?? p.pid ?? 0),
        name: String(p.name),
        cpuSec: Number(p.cpuSec ?? 0),
        memMB: Number(p.memMB ?? p.ramMB ?? 0),
        priority,
        priorityLabel: p.priorityLabel || PRIORITY_LABEL[priority] || priority,
        path: p.path || '',
        company: p.company || p.manufacturer || '',
        windowed: !!p.windowed,
        critical: !!p.critical,
      };
    });
}

function short(s: string | undefined, n: number): string {
  const v = String(s || '');
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
}

function fmtMem(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

// ---------- View ----------

export function Processos({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;

  const [procs, setProcs] = React.useState<ProcessEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('memMB');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [busyPids, setBusyPids] = React.useState<Set<number>>(new Set());
  const [banner, setBanner] = React.useState<Banner>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  const aliveRef = React.useRef(true);
  const inFlight = React.useRef(false);
  const confirmOpen = React.useRef(false);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  confirmOpen.current = confirm !== null;

  const showBanner = React.useCallback((kind: NonNullable<Banner>['kind'], text: string, ms = 7000) => {
    setBanner({ kind, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  const refresh = React.useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    try {
      const list = await api.processList();
      if (!aliveRef.current) return;
      setProcs(normalize(Array.isArray(list) ? list : []));
      setLoadError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      if (!aliveRef.current) return;
      setLoadError(errMsg(err, 'Não foi possível listar os processos.'));
    } finally {
      inFlight.current = false;
      if (aliveRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [api]);

  // Carga inicial + auto-refresh enquanto a view está montada.
  React.useEffect(() => {
    aliveRef.current = true;
    void refresh();
    const t = setInterval(() => {
      // Não atualiza enquanto o diálogo de confirmação está aberto (evita trocar o alvo).
      if (!autoRefresh || confirmOpen.current) return;
      void refresh();
    }, REFRESH_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(t);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [refresh, autoRefresh]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'company' ? 'asc' : 'desc');
    }
  };

  const q = query.trim().toLowerCase();
  const { visible, filteredCount } = React.useMemo(() => {
    const filtered = procs.filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.id).includes(q) || p.company.toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' }) * dir;
    });
    return { visible: filtered.slice(0, MAX_ROWS), filteredCount: filtered.length };
  }, [procs, q, sortKey, sortDir]);

  const totals = React.useMemo(() => ({
    count: procs.length,
    memMB: procs.reduce((acc, p) => acc + p.memMB, 0),
    windowed: procs.filter((p) => p.windowed).length,
  }), [procs]);

  const markBusy = (pid: number, on: boolean) => {
    setBusyPids((prev) => {
      const next = new Set(prev);
      if (on) next.add(pid); else next.delete(pid);
      return next;
    });
  };

  const killProcess = async (p: ProcessEntry) => {
    markBusy(p.id, true);
    try {
      await api.processKill({ pid: p.id, name: p.name });
      if (!aliveRef.current) return;
      showBanner('ok', `${p.name} (PID ${p.id}) encerrado.`);
      setTimeout(() => { void refresh(); }, 400);
    } catch (err) {
      if (!aliveRef.current) return;
      showBanner('error', errMsg(err, 'Não foi possível encerrar o processo.'), 8000);
    } finally {
      if (aliveRef.current) markBusy(p.id, false);
    }
  };

  const askKill = (p: ProcessEntry) => {
    setConfirm({
      title: `Encerrar "${p.name}"?`,
      text: `PID ${p.id}${p.company ? ` · ${p.company}` : ''}. Dados não salvos nesse programa serão perdidos.`,
      confirmLabel: 'ENCERRAR',
      onConfirm: () => { setConfirm(null); void killProcess(p); },
    });
  };

  const changePriority = async (p: ProcessEntry, level: PriorityLevel) => {
    if (level === p.priority) return;
    const previous = p.priority;
    markBusy(p.id, true);
    // Otimista.
    setProcs((prev) => prev.map((x) => (x.id === p.id ? { ...x, priority: level, priorityLabel: PRIORITY_LABEL[level] || level } : x)));
    try {
      await api.processSetPriority({ pid: p.id, name: p.name, level });
      if (!aliveRef.current) return;
      showBanner('ok', `Prioridade de ${p.name} alterada para ${PRIORITY_LABEL[level] || level}.`);
    } catch (err) {
      if (!aliveRef.current) return;
      setProcs((prev) => prev.map((x) => (x.id === p.id ? { ...x, priority: previous, priorityLabel: PRIORITY_LABEL[previous] || previous } : x)));
      showBanner('error', errMsg(err, 'Não foi possível alterar a prioridade.'), 8000);
      setTimeout(() => { void refresh(); }, 600);
    } finally {
      if (aliveRef.current) markBusy(p.id, false);
    }
  };

  const openLocation = async (p: ProcessEntry) => {
    if (!p.path) return;
    const dir = p.path.replace(/[\\/][^\\/]+$/, '');
    try {
      await api.openPath?.(dir);
    } catch (err) {
      showBanner('error', errMsg(err, 'Não foi possível abrir o local do arquivo.'), 6000);
    }
  };

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Processos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Processos em execução com uso de CPU e RAM. Processos críticos do Windows são protegidos e não podem ser encerrados nem repriorizados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">{updatedAt}</span>}
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--orion-selected-bg)] ${
              autoRefresh ? 'text-[var(--orion-icon-active)] hover:text-[var(--orion-hover-fg)]' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={autoRefresh ? `Atualizando a cada ${REFRESH_MS / 1000}s` : 'Atualização automática pausada'}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'AUTO' : 'PAUSADO'}
          </button>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
          >
            <RefreshCcw className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} />
            {refreshing ? 'Atualizando…' : 'ATUALIZAR'}
          </button>
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

      {/* Resumo */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-foreground">{totals.count}</span> processo(s)
        </span>
        <span className="flex items-center gap-2">
          <span className="text-foreground">{fmtMem(totals.memMB)}</span> de RAM em uso (soma)
        </span>
        <span className="flex items-center gap-2">
          <span className="text-foreground">{totals.windowed}</span> com janela
        </span>
        {filteredCount > visible.length && (
          <span className="text-xs">Exibindo os primeiros {MAX_ROWS} de {filteredCount}.</span>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--orion-icon-default)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nome, PID ou fabricante…"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg bg-[var(--orion-surface)] py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        {loading && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            <p className="text-sm text-muted-foreground">Lendo processos…</p>
          </div>
        )}

        {!loading && loadError && procs.length === 0 && (
          <p className="p-4 text-center text-sm text-red-400">{loadError}</p>
        )}

        {!loading && (procs.length > 0 || !loadError) && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <SortTh label="Processo" k="name" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortTh label="PID" k="id" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortTh label="Fabricante" k="company" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortTh label="CPU (s)" k="cpuSec" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortTh label="RAM" k="memMB" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <th className="py-2 pr-3 font-semibold">Prioridade</th>
                  <th className="py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum processo corresponde ao filtro.</td>
                  </tr>
                )}
                {visible.map((p) => {
                  const busy = busyPids.has(p.id);
                  return (
                    <tr key={`${p.id}-${p.name}`} className="border-t border-[var(--orion-selected-bg)] align-middle transition-colors hover:bg-[var(--orion-selected-bg)]/40">
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground" title={p.path || p.name}>{p.name}</span>
                          {p.critical && <Badge tone="neutral">SISTEMA</Badge>}
                          {p.windowed && <Badge tone="accent">JANELA</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground">{p.id}</td>
                      <td className="py-2 pr-3 text-muted-foreground" title={p.company}>{short(p.company, 24) || '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-foreground">{p.cpuSec.toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-foreground">{fmtMem(p.memMB)}</td>
                      <td className="py-2 pr-3">
                        {p.critical ? (
                          <span className="text-xs text-muted-foreground">{p.priorityLabel}</span>
                        ) : (
                          <select
                            value={PRIORITY_OPTIONS.some(([v]) => v === p.priority) ? p.priority : 'Normal'}
                            disabled={busy}
                            onChange={(e) => changePriority(p, e.target.value as PriorityLevel)}
                            className="rounded-md bg-[var(--orion-bg)] px-2 py-1 text-xs text-foreground disabled:opacity-60"
                          >
                            {PRIORITY_OPTIONS.map(([v, lbl]) => (
                              <option key={v} value={v}>{lbl}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {p.path && (
                            <button
                              type="button"
                              onClick={() => openLocation(p)}
                              title="Abrir local do arquivo"
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--orion-surface)] px-2 py-1 text-[0.65rem] font-semibold text-[var(--orion-icon-active)] shadow-[inset_0_0_0_1px_var(--orion-hover-border)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
                            >
                              <FolderOpen className="h-3 w-3" />
                              LOCAL
                            </button>
                          )}
                          {!p.critical && (
                            <button
                              type="button"
                              onClick={() => askKill(p)}
                              disabled={busy}
                              title="Encerrar processo"
                              className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[0.65rem] font-semibold text-red-400 shadow-[inset_0_0_0_1px_rgba(255,92,95,0.45)] transition-colors hover:bg-red-500/20 disabled:opacity-60"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Skull className="h-3 w-3" />}
                              ENCERRAR
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

function SortTh({
  label, k, active, dir, onClick, align,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === k;
  return (
    <th className={`py-2 pr-3 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-foreground ${
          isActive ? 'text-[var(--orion-icon-active)]' : 'text-muted-foreground'
        }`}
      >
        {label}
        {isActive
          ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </th>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'accent' }) {
  const cls = tone === 'accent'
    ? 'bg-green-500/15 text-green-400'
    : 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function ConfirmDialog({
  title, text, confirmLabel, onCancel, onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
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
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
