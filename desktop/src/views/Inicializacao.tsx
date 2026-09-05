import React from 'react';
import { Power, RefreshCcw, Search, ShieldCheck, X, Loader2 } from 'lucide-react';
import { useApi } from '@/api';

// ---------- Tipos locais (métodos ainda não tipados em OrionApi) ----------

type Impact = 'Alto' | 'Médio' | 'Baixo' | 'Protegido' | 'Desconhecido' | string;

interface StartupEntry {
  id?: string;
  name: string;
  command?: string;
  regKey?: string;
  kind?: 'run' | 'runonce' | 'folder' | string;
  source?: string;
  scope?: string;
  enabled?: boolean;
  impact?: Impact;
  protected?: boolean;
  location?: string;
}

interface LocalApi {
  startupList(): Promise<StartupEntry[]>;
  /** main.js lê `payload.entry.enabled` como estado desejado; o legado também envia `enabled` no topo. */
  startupSetEnabled(payload: { entry: StartupEntry; enabled: boolean }): Promise<{ ok?: boolean; enabled?: boolean }>;
}

type Banner = { kind: 'ok' | 'warn' | 'error' | 'info'; text: string } | null;

const BANNER_STYLE: Record<NonNullable<Banner>['kind'], string> = {
  ok: 'bg-green-500/15 text-green-400',
  warn: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
  info: 'bg-[var(--orion-selected-bg)] text-[var(--orion-icon-active)]',
};

const IMPACT_CLASS: Record<string, string> = {
  Alto: 'bg-red-500/15 text-red-400',
  Médio: 'bg-amber-500/15 text-amber-400',
  Baixo: 'bg-green-500/15 text-green-400',
  Protegido: 'bg-[var(--orion-selected-bg)] text-muted-foreground',
  Desconhecido: 'bg-[var(--orion-selected-bg)] text-muted-foreground',
};

const IMPACT_ORDER: Record<string, number> = { Alto: 0, Médio: 1, Baixo: 2, Desconhecido: 3, Protegido: 4 };

type FilterState = 'all' | 'enabled' | 'disabled';

// ---------- Helpers ----------

function short(s: string | undefined, n: number): string {
  const v = String(s || '');
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

function entryKey(e: StartupEntry, i: number): string {
  return e.id || `${e.source || ''}|${e.name}|${i}`;
}

// ---------- View ----------

export function Inicializacao({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;

  const [entries, setEntries] = React.useState<StartupEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterState>('all');
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [banner, setBanner] = React.useState<Banner>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = React.useRef(true);

  const showBanner = React.useCallback((kind: NonNullable<Banner>['kind'], text: string, ms = 7000) => {
    setBanner({ kind, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.startupList();
      if (!aliveRef.current) return;
      setEntries(Array.isArray(list) ? list : []);
      setLoadError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      if (!aliveRef.current) return;
      setEntries([]);
      setLoadError(errMsg(err, 'Não foi possível listar os programas de inicialização.'));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [refresh]);

  const setEnabled = async (entry: StartupEntry, key: string, enable: boolean) => {
    if (entry.protected || pending.has(key)) return;
    setPending((p) => new Set(p).add(key));
    // Atualização otimista.
    setEntries((prev) => prev.map((e, i) => (entryKey(e, i) === key ? { ...e, enabled: enable } : e)));
    try {
      await api.startupSetEnabled({ entry: { ...entry, enabled: enable }, enabled: enable });
      if (!aliveRef.current) return;
      showBanner(
        enable ? 'ok' : 'info',
        enable ? `${entry.name} voltará a iniciar com o Windows.` : `${entry.name} não iniciará mais com o Windows.`,
      );
    } catch (err) {
      if (!aliveRef.current) return;
      // Reverte.
      setEntries((prev) => prev.map((e, i) => (entryKey(e, i) === key ? { ...e, enabled: !enable } : e)));
      showBanner('error', errMsg(err, 'Não foi possível alterar a entrada.'), 8000);
    } finally {
      if (aliveRef.current) {
        setPending((p) => { const n = new Set(p); n.delete(key); return n; });
      }
    }
  };

  const q = query.trim().toLowerCase();
  const visible = entries
    .map((e, i) => ({ e, key: entryKey(e, i) }))
    .filter(({ e }) => {
      if (filter === 'enabled' && !e.enabled) return false;
      if (filter === 'disabled' && e.enabled) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.command || '').toLowerCase().includes(q) ||
        (e.source || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const ia = IMPACT_ORDER[a.e.impact || 'Desconhecido'] ?? 3;
      const ib = IMPACT_ORDER[b.e.impact || 'Desconhecido'] ?? 3;
      if (ia !== ib) return ia - ib;
      return a.e.name.localeCompare(b.e.name, 'pt-BR');
    });

  const enabledCount = entries.filter((e) => e.enabled).length;
  const highCount = entries.filter((e) => e.enabled && (e.impact === 'Alto' || e.impact === 'Médio')).length;

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Inicialização</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Programas configurados para iniciar com o Windows. O impacto é uma <b className="text-foreground">estimativa</b> baseada no tipo de aplicativo — desativar itens de segurança do Windows não é permitido.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">{updatedAt}</span>}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
          >
            <RefreshCcw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            {loading ? 'Atualizando…' : 'ATUALIZAR'}
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
          <Power className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-foreground">{entries.length}</span> programa(s)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-foreground">{enabledCount}</span> ativo(s)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-foreground">{highCount}</span> com impacto alto/médio ativo(s)
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--orion-icon-default)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome, comando ou origem…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg bg-[var(--orion-surface)] py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="inline-flex rounded-lg bg-[var(--orion-surface)] p-1">
          {([['all', 'Todos'], ['enabled', 'Ativos'], ['disabled', 'Desativados']] as [FilterState, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === v
                  ? 'bg-[var(--orion-selected-bg)] text-[var(--orion-hover-fg)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        {loading && entries.length === 0 && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
            <p className="text-sm text-muted-foreground">Lendo programas de inicialização…</p>
          </div>
        )}

        {!loading && loadError && (
          <p className="p-4 text-center text-sm text-red-400">{loadError}</p>
        )}

        {!loading && !loadError && entries.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">Nenhum programa de inicialização detectado.</p>
        )}

        {entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Programa</th>
                  <th className="py-2 pr-3 font-semibold">Origem</th>
                  <th className="py-2 pr-3 font-semibold">Escopo</th>
                  <th className="py-2 pr-3 font-semibold">Impacto (estimado)</th>
                  <th className="py-2 pr-3 font-semibold">Comando</th>
                  <th className="py-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum programa corresponde ao filtro.</td>
                  </tr>
                )}
                {visible.map(({ e, key }) => {
                  const impact = e.impact || 'Desconhecido';
                  const isPending = pending.has(key);
                  const disabled = !!e.protected || isPending || e.kind === 'folder';
                  const title = e.protected
                    ? 'Item essencial — não pode ser desativado'
                    : e.kind === 'folder'
                      ? 'Atalhos na pasta Inicializar não possuem estado "desativado"'
                      : 'Ativa/desativa sem apagar a entrada';
                  return (
                    <tr key={key} className="border-t border-[var(--orion-selected-bg)] align-middle transition-colors hover:bg-[var(--orion-selected-bg)]/40">
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{e.name}</span>
                          {e.protected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--orion-selected-bg)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--orion-icon-active)]">
                              <ShieldCheck className="h-3 w-3" />PROTEGIDO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{e.source || '—'}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{e.scope || '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${IMPACT_CLASS[impact] || IMPACT_CLASS.Desconhecido}`}>
                          {impact}
                        </span>
                        {(impact === 'Alto' || impact === 'Médio') && (
                          <small className="ml-1.5 text-[0.65rem] text-muted-foreground">(estimativa)</small>
                        )}
                      </td>
                      <td className="max-w-[260px] py-2.5 pr-3">
                        <span className="block truncate text-xs text-muted-foreground" title={e.command || ''}>{short(e.command, 60) || '—'}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Toggle
                          checked={!!e.enabled}
                          disabled={disabled}
                          busy={isPending}
                          title={title}
                          onChange={(v) => setEnabled(e, key, v)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Subcomponentes ----------

function Toggle({
  checked, disabled, busy, title, onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`inline-flex items-center justify-end gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} title={title}>
      <span className="text-xs text-muted-foreground">{checked ? 'Ativo' : 'Desativado'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[var(--orion-icon-active)]' : 'bg-[var(--orion-selected-bg)]'
        }`}
      >
        {busy ? (
          <Loader2 className={'mx-auto h-3 w-3 animate-spin ' + (checked ? 'text-black' : 'text-foreground')} />
        ) : (
          <span
            className={`inline-block h-4 w-4 rounded-full transition-transform ${
              checked ? 'translate-x-[18px] bg-black' : 'translate-x-0.5 bg-[var(--orion-icon-default)]'
            }`}
          />
        )}
      </button>
    </label>
  );
}
