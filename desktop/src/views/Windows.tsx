import React from 'react';
import {
  AppWindow, Cpu, Monitor, MemoryStick, Network, HardDrive, Zap, Power, Gamepad2, Brush, Shield,
  Settings2, Scale, Rocket, Briefcase, Plus, Download, Search, ChevronDown, RotateCcw, Lock,
  Crown, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Play, ScanSearch, Gauge, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos (formato do engine: engineService.js / catalog.js / mock-api.js)
// ---------------------------------------------------------------------------

type Risk = 'low' | 'medium' | 'high' | 'info' | string;

interface OptItem {
  id: string;
  name: string;
  description?: string;
  benefit?: string;
  category?: string;
  risk?: Risk;
  riskLabel?: string;
  profiles?: string[];
  proOnly?: boolean;
  rebootRequired?: boolean;
  requiresAdmin?: boolean;
  confirm?: boolean;
  icon?: string;
  applyHint?: string;
  registryKeys?: string[];
  applied?: boolean;
}

interface OptProfile {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  count?: number;
}

interface DriverEntry {
  id: string;
  vendor: string;
}

interface EngineStep {
  name?: string;
  ok?: boolean;
  message?: string;
}

interface ApplyResult {
  ok?: boolean;
  error?: string;
  opId?: string | null;
  launchError?: string | null;
  restorePoint?: { ok?: boolean; message?: string } | null;
  results?: { ok?: boolean; name?: string; message?: string }[];
}

interface UndoResult {
  ok?: boolean;
  message?: string;
}

interface LocalApi {
  engineListItems(): Promise<OptItem[]>;
  engineGetProfiles(): Promise<OptProfile[]>;
  engineGetDrivers(): Promise<DriverEntry[]>;
  engineApply(payload: { ids: string[]; label?: string; createRestorePoint?: boolean; profile?: string | null }): Promise<ApplyResult>;
  engineUndoItem(id: string): Promise<UndoResult>;
  onEngineStep(cb: (step: EngineStep) => void): void;
  licenseGetState?(): Promise<{ active?: boolean } | null>;
}

// ---------------------------------------------------------------------------
// Constantes (espelham renderer.js)
// ---------------------------------------------------------------------------

const CUSTOM_PROFILE_KEY = 'orion.customProfile';
const APPLIED_KEY = 'orion.appliedIds';
const RISK_SORT: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };

const CATEGORY_LABEL: Record<string, string> = {
  windows: 'Windows', cpu: 'CPU', gpu: 'GPU', ram: 'RAM', rede: 'Rede',
  armazenamento: 'Armazenamento', energia: 'Energia', inicializacao: 'Inicialização',
  jogos: 'Jogos', limpeza: 'Limpeza', seguranca: 'Segurança',
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  windows: AppWindow, cpu: Cpu, gpu: Monitor, ram: MemoryStick, rede: Network,
  armazenamento: HardDrive, energia: Zap, inicializacao: Power, jogos: Gamepad2,
  limpeza: Brush, seguranca: Shield,
};

// Nomes de ícones do catálogo legado (icons.js) → lucide.
const NAMED_ICON: Record<string, LucideIcon> = {
  windows: AppWindow, cpu: Cpu, gpu: Monitor, ram: MemoryStick, network: Network,
  storage: HardDrive, power: Zap, startup: Power, gaming: Gamepad2, cleaning: Brush,
  security: Shield, privacy: Shield, system: Settings2, scale: Scale, boost: Rocket,
  rocket: Rocket, briefcase: Briefcase, zap: Zap, gauge: Gauge, download: Download,
};

const RISK_GROUP_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const RISK_GROUP_LABEL: Record<string, string> = { high: 'Requer atenção', medium: 'Moderadas', low: 'Seguras' };
const RISK_BADGE_LABEL: Record<string, string> = { low: 'RISCO BAIXO', medium: 'RISCO MÉDIO', high: 'RISCO ALTO', info: 'INFORMATIVO' };
const RISK_BADGE_CLASS: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]',
};
const RISK_STRIPE_CLASS: Record<string, string> = {
  low: 'border-l-green-500/60',
  medium: 'border-l-amber-500/60',
  high: 'border-l-red-500/70',
};

const DRIVER_NAMES: Record<string, string> = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel' };

type RiskFilter = 'all' | 'low' | 'medium' | 'high';
type PlanFilter = 'all' | 'free' | 'pro';
type SortMode = 'name' | 'risk' | 'category';
type LogStatus = 'ok' | 'fail' | 'skip';

interface LogEntry { id: number; status: LogStatus; name: string; message?: string }
interface ToastEntry { id: number; text: string; kind: 'info' | 'ok' | 'warn' | 'error' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iconFor(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  return NAMED_ICON[name] || fallback;
}

function catIcon(cat: string | undefined): LucideIcon {
  return (cat && CATEGORY_ICON[cat]) || Settings2;
}

function readJsonArray(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Erro desconhecido.';
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

const PRIMARY_BTN = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN = 'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
const SELECT_CLASS = 'rounded-lg bg-[var(--orion-bg)] px-3 py-2 text-sm text-foreground outline-none ring-1 ring-[var(--orion-selected-bg)] focus:ring-[var(--orion-hover-border)]';

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function Windows({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;

  // Catálogo
  const [items, setItems] = React.useState<OptItem[]>([]);
  const [profiles, setProfiles] = React.useState<OptProfile[]>([]);
  const [drivers, setDrivers] = React.useState<DriverEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Seleção / estado aplicado
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [applied, setApplied] = React.useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [activeProfile, setActiveProfile] = React.useState<string | null>(null);
  const [customIds, setCustomIds] = React.useState<string[]>([]);
  const [profileDiff, setProfileDiff] = React.useState<{ entering: number; leaving: number } | null>(null);

  // Filtros
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [catFilter, setCatFilter] = React.useState<string>('all');
  const [riskFilter, setRiskFilter] = React.useState<RiskFilter>('all');
  const [planFilter, setPlanFilter] = React.useState<PlanFilter>('all');
  const [unappliedOnly, setUnappliedOnly] = React.useState(false);
  const [sort, setSort] = React.useState<SortMode>('name');

  // Aplicação
  const [restorePoint, setRestorePoint] = React.useState(true);
  const [applying, setApplying] = React.useState(false);
  const [progress, setProgress] = React.useState<{ pct: number; label: string } | null>(null);
  const [runLog, setRunLog] = React.useState<LogEntry[]>([]);
  const [confirm, setConfirm] = React.useState<{ chosen: OptItem[]; ids: string[]; rp: boolean } | null>(null);
  const [revertingId, setRevertingId] = React.useState<string | null>(null);
  const [driverBusy, setDriverBusy] = React.useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const toastTimers = React.useRef<number[]>([]);
  const seq = React.useRef(0);

  // Refs para o listener global do engine
  const applyingRef = React.useRef(false);
  const applyTotalRef = React.useRef(0);
  const applyDoneRef = React.useRef(0);
  const aliveRef = React.useRef(true);
  const liveLogCountRef = React.useRef(0);

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

  const appendRunLog = React.useCallback((status: LogStatus, name: string, message?: string) => {
    const id = ++seq.current;
    setRunLog((prev) => [...prev, { id, status, name, message }]);
  }, []);

  const persistApplied = React.useCallback((set: Set<string>) => {
    writeJson(APPLIED_KEY, [...set]);
  }, []);

  // ---- carga inicial ----
  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [its, profs, drvs] = await Promise.all([
        api.engineListItems(),
        api.engineGetProfiles(),
        api.engineGetDrivers(),
      ]);
      if (!aliveRef.current) return;
      const list = Array.isArray(its) ? its : [];
      setItems(list);
      setProfiles(Array.isArray(profs) ? profs : []);
      setDrivers(Array.isArray(drvs) ? drvs : []);
      const app = new Set(list.filter((i) => i.applied).map((i) => i.id));
      readJsonArray(APPLIED_KEY).forEach((id) => app.add(id));
      setApplied(app);
      setCustomIds(readJsonArray(CUSTOM_PROFILE_KEY));
    } catch (err) {
      if (aliveRef.current) setLoadError(`Não foi possível carregar o catálogo: ${errMessage(err)}`);
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

  // Listener de passos do engine. O preload não expõe unsubscribe, então o
  // callback ignora eventos após o unmount via aliveRef.
  React.useEffect(() => {
    if (typeof api.onEngineStep !== 'function') return;
    let registered = true;
    api.onEngineStep((step) => {
      if (!registered || !aliveRef.current) return;
      if (!step || !step.name) return;
      if (applyingRef.current) {
        applyDoneRef.current += 1;
        liveLogCountRef.current += 1;
        const total = Math.max(applyTotalRef.current, applyDoneRef.current);
        const pct = Math.min(100, Math.round((applyDoneRef.current / total) * 100));
        setProgress({ pct, label: step.name });
        appendRunLog(step.ok ? 'ok' : 'fail', step.name, step.message || '');
        return;
      }
      toast(`${step.ok ? '✅' : '❌'} ${step.name}`, step.ok ? 'ok' : 'error', 3500);
    });
    return () => { registered = false; };
  }, [api, appendRunLog, toast]);

  // Debounce da busca (200 ms como no legado)
  React.useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 200);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // ---- filtros ----
  const categories = React.useMemo(() => [...new Set(items.map((i) => i.category || '').filter(Boolean))], [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((i) => {
      if (catFilter !== 'all' && i.category !== catFilter) return false;
      if (riskFilter !== 'all' && i.risk !== riskFilter) return false;
      if (planFilter === 'pro' && !i.proOnly) return false;
      if (planFilter === 'free' && i.proOnly) return false;
      if (unappliedOnly && applied.has(i.id)) return false;
      if (q && !(i.name || '').toLowerCase().includes(q) && !(i.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = list.slice();
    if (sort === 'risk') {
      sorted.sort((a, b) => (RISK_SORT[a.risk || ''] ?? 9) - (RISK_SORT[b.risk || ''] ?? 9) || a.name.localeCompare(b.name, 'pt-BR'));
    } else if (sort === 'category') {
      sorted.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return sorted;
  }, [items, search, catFilter, riskFilter, planFilter, unappliedOnly, applied, sort]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, OptItem[]>();
    filtered.forEach((it) => {
      const r = it.risk || 'low';
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(it);
    });
    return [...map.entries()].sort((a, b) => (RISK_GROUP_ORDER[a[0]] ?? 3) - (RISK_GROUP_ORDER[b[0]] ?? 3));
  }, [filtered]);

  const filtersDirty = search !== '' || catFilter !== 'all' || riskFilter !== 'all' || planFilter !== 'all' || unappliedOnly || sort !== 'name';

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setCatFilter('all');
    setRiskFilter('all');
    setPlanFilter('all');
    setUnappliedOnly(false);
    setSort('name');
  };

  // ---- seleção ----
  const toggleItem = (id: string, force?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = force == null ? !next.has(id) : force;
      if (on) next.add(id); else next.delete(id);
      return next;
    });
    setActiveProfile(null);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((i) => next.add(i.id));
      return next;
    });
    setActiveProfile(null);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setActiveProfile(null);
    setProfileDiff(null);
  };

  const showProfileDiff = (nextSet: Set<string>) => {
    const entering = [...nextSet].filter((id) => !selected.has(id)).length;
    const leaving = [...selected].filter((id) => !nextSet.has(id)).length;
    setProfileDiff({ entering, leaving });
  };

  // ---- perfis ----
  const onProfileClick = (id: string) => {
    if (id === 'custom') {
      if (selected.size) {
        const ids = [...selected];
        setCustomIds(ids);
        writeJson(CUSTOM_PROFILE_KEY, ids);
        setActiveProfile('custom');
        toast('✅ Perfil personalizado salvo neste computador.', 'ok');
        return;
      }
      if (!customIds.length) {
        toast('⚠ Selecione otimizações e clique de novo em Personalizado para salvar.', 'warn');
        return;
      }
      const next = new Set(customIds);
      showProfileDiff(next);
      setSelected(next);
      setActiveProfile('custom');
      toast(`Perfil Personalizado selecionado — ${next.size} otimização(ões).`);
      return;
    }
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const next = new Set(items.filter((i) => (i.profiles || []).includes(p.id)).map((i) => i.id));
    showProfileDiff(next);
    setSelected(next);
    setActiveProfile(p.id);
    toast(`Perfil ${p.name} selecionado — ${next.size} otimização(ões). Revise e clique em APLICAR.`);
  };

  // ---- drivers ----
  const openDriver = async (id: string) => {
    if (driverBusy) return;
    setDriverBusy(id);
    try {
      const res = await api.engineApply({ ids: [id], label: 'Download de driver' });
      toast(res?.ok ? 'Página oficial aberta no navegador.' : '❌ Não foi possível abrir a página do fabricante.', res?.ok ? 'ok' : 'error');
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error');
    } finally {
      setDriverBusy(null);
    }
  };

  // ---- reverter item ----
  const revertSingleItem = async (id: string) => {
    if (revertingId) return;
    setRevertingId(id);
    try {
      const res = await api.engineUndoItem(id);
      if (res && res.ok) {
        setApplied((prev) => {
          const next = new Set(prev);
          next.delete(id);
          persistApplied(next);
          return next;
        });
        toast('✅ Otimização revertida.', 'ok');
      } else {
        toast(`⚠ ${(res && res.message) || 'Não foi possível reverter.'}`, 'warn');
      }
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error');
    } finally {
      setRevertingId(null);
    }
  };

  // ---- aplicar ----
  const requestApply = async () => {
    let ids = [...selected];
    if (!ids.length) { toast('⚠ Selecione pelo menos uma otimização.', 'warn'); return; }

    const chosenAll = items.filter((i) => ids.includes(i.id));
    let chosen = chosenAll;

    let licensed = true;
    try {
      const st = typeof api.licenseGetState === 'function' ? await api.licenseGetState() : null;
      licensed = st ? Boolean(st.active) : true;
    } catch { licensed = true; }

    if (!licensed) {
      const locked = chosenAll.filter((i) => i.proOnly);
      chosen = chosenAll.filter((i) => !i.proOnly);
      if (!chosen.length) {
        toast('🔒 Esses recursos exigem um plano. Ative sua licença para continuar.', 'warn', 7000);
        onNavigate?.('activation');
        return;
      }
      if (locked.length) {
        toast(`🔒 ${locked.length} item(ns) PRO ignorado(s). Ative a licença para usá-los.`, 'warn', 7000);
      }
      ids = chosen.map((i) => i.id);
    }
    setConfirm({ chosen, ids, rp: restorePoint });
  };

  const doApply = async () => {
    if (!confirm || applying) return;
    const { chosen, ids, rp } = confirm;
    setConfirm(null);
    setApplying(true);
    applyingRef.current = true;
    applyDoneRef.current = 0;
    applyTotalRef.current = chosen.length + (rp ? 1 : 0);
    liveLogCountRef.current = 0;
    setRunLog([]);
    setProgress({ pct: 2, label: 'Iniciando…' });

    try {
      const res = await api.engineApply({
        ids,
        label: `${chosen.length} otimização(ões) manual(is)`,
        createRestorePoint: rp,
        profile: activeProfile,
      });
      const results = res?.results || [];
      const liveCount = liveLogCountRef.current;
      const okIds: string[] = [];
      results.forEach((r, i) => {
        const item = chosen[i];
        if (r.ok && item) okIds.push(item.id);
        if (!liveCount) {
          const name = (item && item.name) || r.name || 'Item';
          appendRunLog(r.ok ? 'ok' : 'fail', name, r.message || (r.ok ? 'Aplicado' : 'Falha'));
        }
      });
      if (!liveCount && results.length < chosen.length) {
        chosen.slice(results.length).forEach((item) => appendRunLog('skip', item.name, 'Pulado'));
      }
      if (okIds.length) {
        setApplied((prev) => {
          const next = new Set(prev);
          okIds.forEach((id) => next.add(id));
          persistApplied(next);
          return next;
        });
      }
      const okCount = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      setProgress({ pct: 100, label: 'Concluído' });
      if (res?.error && !results.length) {
        toast(`⚠ ${res.error}`, 'warn', 9000);
      }
      if (res?.restorePoint && !res.restorePoint.ok) {
        toast(`ℹ ${res.restorePoint.message || 'Ponto de restauração não criado.'}`, 'info', 9000);
      }
      if (results.length) {
        if (fail.length) {
          toast(`⚠ Concluído com avisos: ${okCount}/${results.length} OK.`, 'warn', 12000);
        } else {
          toast(`✅ ${okCount} otimização(ões) aplicada(s) com sucesso.`, 'ok', 10000);
        }
      }
      setSelected(new Set());
    } catch (err) {
      toast(`❌ ${errMessage(err)}`, 'error', 9000);
    } finally {
      applyingRef.current = false;
      setApplying(false);
      window.setTimeout(() => { if (aliveRef.current) setProgress(null); }, 2500);
    }
  };

  const selectedCount = selected.size;
  const selectedLabel = selectedCount === 1 ? '1 selecionada' : `${selectedCount} selecionadas`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Windows</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione otimizações individuais ou use um perfil pronto. Tudo é aplicado com backup do registro e pode ser desfeito em{' '}
            <button
              type="button"
              onClick={() => onNavigate?.('restore')}
              className="font-semibold text-[var(--orion-icon-active)] transition-colors hover:text-[var(--orion-hover-fg)]"
            >
              Restauração
            </button>.
          </p>
        </div>
      </div>

      {/* Barra de ação */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Otimizações do Sistema</span>
            <span className="rounded-full bg-[var(--orion-selected-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--orion-icon-active)]">
              {selectedLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={selectAllFiltered} disabled={applying || !filtered.length} className={SECONDARY_BTN}>
              Selecionar tudo
            </button>
            <button type="button" onClick={clearSelection} disabled={applying || !selectedCount} className={SECONDARY_BTN}>
              Limpar seleção
            </button>
            <label
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground"
              title="Cria um ponto de restauração do Windows antes de aplicar"
            >
              <Switch checked={restorePoint} onChange={setRestorePoint} disabled={applying} />
              Ponto de restauração
            </label>
            <button type="button" onClick={requestApply} disabled={applying} className={PRIMARY_BTN}>
              <Play className="h-4 w-4" />
              {applying ? 'APLICANDO…' : 'APLICAR SELECIONADAS'}
            </button>
          </div>
        </div>
        {progress && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--orion-bg)]">
              <div
                className="h-full rounded-full bg-[var(--orion-icon-active)] transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
              />
            </div>
            <span className="min-w-0 max-w-xs truncate text-xs text-muted-foreground">{progress.label}</span>
          </div>
        )}
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-500/10 px-5 py-3 text-sm text-red-400">
          <span className="flex items-center gap-2"><XCircle className="h-4 w-4" />{loadError}</span>
          <button type="button" onClick={load} className={SECONDARY_BTN}>Tentar novamente</button>
        </div>
      )}

      {loading && !loadError && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando catálogo de otimizações…</p>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Perfis prontos */}
          <section>
            <GroupTitle>Perfis prontos</GroupTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {profiles.map((p) => {
                const count = p.count != null ? p.count : items.filter((i) => (i.profiles || []).includes(p.id)).length;
                const Icon = iconFor(p.icon, Settings2);
                return (
                  <ProfileCard
                    key={p.id}
                    active={activeProfile === p.id}
                    icon={<Icon className="h-6 w-6" strokeWidth={1.75} />}
                    name={p.name}
                    description={p.description || ''}
                    footer={plural(count, 'ajuste', 'ajustes')}
                    onClick={() => onProfileClick(p.id)}
                  />
                );
              })}
              <ProfileCard
                active={activeProfile === 'custom'}
                icon={<Plus className="h-6 w-6" strokeWidth={1.75} />}
                name="Personalizado"
                description="Salva a seleção atual neste computador."
                footer={customIds.length ? plural(customIds.length, 'ajuste', 'ajustes') : 'Clique para salvar'}
                onClick={() => onProfileClick('custom')}
              />
            </div>
            {profileDiff && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2.5 text-sm text-muted-foreground">
                <ScanSearch className="h-4 w-4 text-[var(--orion-icon-default)]" />
                <span>
                  <b className="text-foreground">{profileDiff.entering}</b> entram na seleção · <b className="text-foreground">{profileDiff.leaving}</b> saem
                </span>
              </div>
            )}
          </section>

          {/* Toolbar de filtros */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--orion-surface)] px-5 py-4">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg bg-[var(--orion-bg)] px-3 py-2 ring-1 ring-[var(--orion-selected-bg)] focus-within:ring-[var(--orion-hover-border)]">
              <Search className="h-4 w-4 shrink-0 text-[var(--orion-icon-default)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por título ou descrição…"
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskFilter)} aria-label="Filtrar por risco" className={SELECT_CLASS}>
              <option value="all">Risco: todos</option>
              <option value="low">Risco baixo</option>
              <option value="medium">Risco médio</option>
              <option value="high">Risco alto</option>
            </select>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as PlanFilter)} aria-label="Filtrar por plano" className={SELECT_CLASS}>
              <option value="all">Plano: todos</option>
              <option value="free">Grátis</option>
              <option value="pro">PRO</option>
            </select>
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={unappliedOnly}
                onChange={(e) => setUnappliedOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--orion-icon-active)]"
              />
              Somente não aplicadas
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="Ordenar lista" className={SELECT_CLASS}>
              <option value="name">Ordenar: nome</option>
              <option value="risk">Ordenar: risco</option>
              <option value="category">Ordenar: categoria</option>
            </select>
          </div>

          {/* Chips de categoria */}
          <div className="flex flex-wrap gap-2">
            <Chip active={catFilter === 'all'} onClick={() => setCatFilter('all')}>Todas ({items.length})</Chip>
            {categories.map((c) => {
              const n = items.filter((i) => i.category === c).length;
              const Icon = catIcon(c);
              return (
                <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
                  <Icon className="h-3.5 w-3.5" />
                  {CATEGORY_LABEL[c] || c} ({n})
                </Chip>
              );
            })}
          </div>

          {/* Lista de itens */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-[var(--orion-surface)] p-10 text-center">
              <Search className="mb-3 h-8 w-8 text-muted-foreground" strokeWidth={1.75} />
              <h3 className="m-0 text-base font-semibold text-foreground">Nenhuma otimização encontrada</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver resultados.</p>
              {filtersDirty && (
                <button type="button" onClick={clearFilters} className={SECONDARY_BTN}>Limpar filtros</button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([risk, list]) => (
                <div key={risk}>
                  <h4 className="mb-2 mt-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {RISK_GROUP_LABEL[risk] || risk} <span className="opacity-70">({list.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {list.map((it) => (
                      <OptItemCard
                        key={it.id}
                        item={it}
                        selected={selected.has(it.id)}
                        applied={applied.has(it.id)}
                        expanded={expanded.has(it.id)}
                        reverting={revertingId === it.id}
                        disabled={applying}
                        onToggle={() => toggleItem(it.id)}
                        onToggleExpanded={() => toggleExpanded(it.id)}
                        onRevert={() => revertSingleItem(it.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Log de execução */}
          {runLog.length > 0 && (
            <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Log de execução</span>
                {!applying && (
                  <button type="button" onClick={() => setRunLog([])} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Limpar
                  </button>
                )}
              </div>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {runLog.map((l) => (
                  <li key={l.id} className="flex items-start gap-2 text-sm">
                    {l.status === 'ok' && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />}
                    {l.status === 'fail' && <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
                    {l.status === 'skip' && <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className={l.status === 'fail' ? 'text-red-400' : l.status === 'skip' ? 'text-muted-foreground' : 'text-foreground'}>
                      {l.name}{l.message ? <span className="text-muted-foreground"> — {l.message}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Drivers oficiais */}
          <section>
            <GroupTitle>Drivers oficiais</GroupTitle>
            {drivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fabricante disponível.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {drivers.map((d) => (
                  <ProfileCard
                    key={d.id}
                    icon={<Download className="h-6 w-6" strokeWidth={1.75} />}
                    name={DRIVER_NAMES[d.vendor] || d.vendor}
                    description="Abrir página oficial de drivers."
                    footer={driverBusy === d.id ? 'Abrindo…' : undefined}
                    disabled={driverBusy != null}
                    onClick={() => openDriver(d.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Diálogo de confirmação */}
      {confirm && (
        <ConfirmApplyDialog
          chosen={confirm.chosen}
          rp={confirm.rp}
          onCancel={() => setConfirm(null)}
          onConfirm={doApply}
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
// Subcomponentes
// ---------------------------------------------------------------------------

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--orion-selected-bg)] text-[var(--orion-hover-fg)] ring-1 ring-[var(--orion-hover-border)]'
          : 'bg-[var(--orion-surface)] text-muted-foreground hover:bg-[var(--orion-selected-bg)] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? 'bg-[var(--orion-icon-active)]' : 'bg-[var(--orion-selected-bg)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-[var(--orion-bg)] shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function ProfileCard({ active, icon, name, description, footer, disabled, onClick }: {
  active?: boolean;
  icon: React.ReactNode;
  name: string;
  description: string;
  footer?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-2 rounded-lg px-5 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'bg-[var(--orion-selected-bg)] ring-1 ring-[var(--orion-hover-border)]'
          : 'bg-[var(--orion-surface)] hover:bg-[var(--orion-selected-bg)]/60'
      }`}
    >
      <span className={active ? 'text-[var(--orion-hover-fg)]' : 'text-[var(--orion-icon-default)]'}>{icon}</span>
      <span className="text-sm font-semibold text-foreground">{name}</span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
      {footer && <span className="mt-auto text-xs font-medium text-[var(--orion-icon-active)]">{footer}</span>}
    </button>
  );
}

function RiskBadge({ risk }: { risk: Risk | undefined }) {
  const r = risk || 'low';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider ${RISK_BADGE_CLASS[r] || RISK_BADGE_CLASS.info}`}>
      {r === 'high' && <AlertTriangle className="h-3 w-3" />}
      {RISK_BADGE_LABEL[r] || r}
    </span>
  );
}

function OptItemCard({ item, selected, applied, expanded, reverting, disabled, onToggle, onToggleExpanded, onRevert }: {
  item: OptItem;
  selected: boolean;
  applied: boolean;
  expanded: boolean;
  reverting: boolean;
  disabled: boolean;
  onToggle: () => void;
  onToggleExpanded: () => void;
  onRevert: () => void;
}) {
  const Icon = iconFor(item.icon, catIcon(item.category));
  const risk = item.risk || 'low';
  const hint = item.applyHint || (item.registryKeys || []).join('\n') || 'Ajuste de sistema (sem chave de registro declarada).';

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onToggle();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => { if (!disabled) onToggle(); }}
      onKeyDown={onKey}
      className={`flex cursor-pointer gap-3 rounded-lg border-l-2 px-4 py-3.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--orion-hover-border)] ${
        RISK_STRIPE_CLASS[risk] || 'border-l-[var(--orion-hover-border)]'
      } ${selected ? 'bg-[var(--orion-selected-bg)]' : 'bg-[var(--orion-surface)] hover:bg-[var(--orion-selected-bg)]/50'}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--orion-bg)] text-[var(--orion-icon-default)]">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-sm font-semibold text-foreground">{item.name}</h3>
          <RiskBadge risk={item.risk} />
          {item.proOnly && <Tag><Crown className="h-3 w-3" /> PRO</Tag>}
          {item.requiresAdmin && <Tag><Lock className="h-3 w-3" /> Admin</Tag>}
          {item.rebootRequired && <Tag><RotateCcw className="h-3 w-3" /> Reinício</Tag>}
          {applied && <Tag className="text-green-400"><CheckCircle2 className="h-3 w-3" /> Aplicada</Tag>}
        </div>
        {item.description && <p className="mb-0 mt-1 text-xs text-muted-foreground">{item.description}</p>}
        {item.benefit && (
          <p className="mb-0 mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />
            {item.benefit}
          </p>
        )}
        {expanded && (
          <pre className="mb-0 mt-2 whitespace-pre-wrap break-all rounded-md bg-[var(--orion-bg)] px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">{hint}</pre>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => e.stopPropagation()}
            onChange={() => { if (!disabled) onToggle(); }}
            className="h-4 w-4 cursor-pointer accent-[var(--orion-icon-active)]"
          />
          <button
            type="button"
            aria-label="Ver chave de registro"
            aria-expanded={expanded}
            onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {applied && (
          <button
            type="button"
            disabled={reverting || disabled}
            onClick={(e) => { e.stopPropagation(); onRevert(); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--orion-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
          >
            <RotateCcw className={'h-3 w-3 ' + (reverting ? 'animate-spin' : '')} />
            {reverting ? 'Revertendo…' : 'Reverter'}
          </button>
        )}
      </div>
    </div>
  );
}

function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground ${className}`}>
      {children}
    </span>
  );
}

function ConfirmApplyDialog({ chosen, rp, onCancel, onConfirm }: {
  chosen: OptItem[];
  rp: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const high = chosen.filter((i) => i.risk === 'high' || i.confirm);
  const rest = chosen.filter((i) => i.risk !== 'high' && !i.confirm);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmApplyTitle"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-lg rounded-lg bg-[var(--orion-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[var(--orion-hover-border)]">
        <h2 id="confirmApplyTitle" className="m-0 text-lg font-bold text-foreground">Confirmar aplicação</h2>
        <p className="mb-0 mt-3 text-sm text-foreground">
          Aplicar <b>{chosen.length}</b> otimização(ões)? Ponto de restauração: <b>{rp ? 'sim' : 'não'}</b>.
        </p>
        <p className="mb-0 mt-1 text-xs text-muted-foreground">Um prompt de administrador (UAC) pode ser exibido para aplicar tudo de uma vez.</p>

        <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
          {high.length > 0 && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3">
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-red-400">
                <AlertTriangle className="h-4 w-4" /> Risco alto — confirmação explícita
              </h3>
              <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                {high.map((i) => (
                  <li key={i.id}>{i.name} · <span className="text-muted-foreground">{i.riskLabel || i.risk}</span></li>
                ))}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <ul className="mb-0 mt-0 list-disc space-y-1 pl-5 text-sm text-foreground">
              {rest.map((i) => <li key={i.id}>{i.name}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={SECONDARY_BTN}>Cancelar</button>
          <button type="button" onClick={onConfirm} className={PRIMARY_BTN}>
            <Play className="h-4 w-4" /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
