import React from 'react';
import { Gamepad2, Plus, Trash2, Power, Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import { useApi } from '@/api';

interface GameEntry {
  id: string;
  name: string;
  path: string;
  addedAt?: string;
  isDefault?: boolean;
  platform?: string;
  artworkPath?: string | null;
  launch?: string | null;
  source?: string;
}

type SessionState = 'idle' | 'pending' | 'running' | 'ended' | 'cancelled' | 'error';

interface BoostCheck {
  key: string;
  label: string;
  value: boolean | null;
  text: string;
}

interface AnalyzeResult {
  ok?: boolean;
  score?: number;
  checks?: BoostCheck[];
  recommendations?: { id?: string; name?: string; recommendation?: string; effectiveLevel?: string; risk?: string }[];
  counts?: { critical?: number; recommended?: number; optional?: number };
}

function gradientForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const hue = ((Math.abs(h) % 360) + 260) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 42%, 16%), hsl(${(hue + 28) % 360}, 32%, 8%))`;
}

const STATUS_LABELS: Record<SessionState, string> = {
  idle: 'PRONTO PARA INICIAR',
  pending: 'PREPARANDO BOOST',
  running: 'EM EXECUÇÃO',
  ended: 'JOGO ENCERRADO',
  cancelled: 'Aguardando permissão…',
  error: 'ERRO',
};

const STATUS_COLOR: Record<SessionState, string> = {
  idle: 'bg-[var(--orion-icon-default)]/20 text-[var(--orion-icon-active)]',
  pending: 'bg-amber-500/20 text-amber-400',
  running: 'bg-green-500/20 text-green-400',
  ended: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/15 text-red-400',
  error: 'bg-red-500/15 text-red-400',
};

export function Jogos({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi();
  const [games, setGames] = React.useState<GameEntry[]>([]);
  const [library, setLibrary] = React.useState<GameEntry[]>([]);
  const [showAllLibrary, setShowAllLibrary] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<SessionState>('idle');
  const [sessionMsg, setSessionMsg] = React.useState('');
  const [analyze, setAnalyze] = React.useState<AnalyzeResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);
  const [icons, setIcons] = React.useState<Record<string, string>>({});
  const [art, setArt] = React.useState<Record<string, string>>({});
  const iconQueue = React.useRef(new Set<string>());
  const railRef = React.useRef<HTMLDivElement | null>(null);

  const catalog = React.useMemo(() => {
    const map = new Map<string, GameEntry>();
    games.forEach((g) => map.set(g.id, g));
    library.forEach((g) => { if (!map.has(g.id)) map.set(g.id, g); });
    return [...map.values()];
  }, [games, library]);

  const active = catalog.find((g) => g.id === selected) || null;
  const activeIcon = active ? icons[active.path] : null;
  const activeArt = active ? (art[active.id] || (active.artworkPath ? art[active.artworkPath] : null)) : null;
  const visibleLibrary = showAllLibrary ? library : library.slice(0, 8);
  const sidebarList = games.length ? games : catalog.slice(0, 12);

  const loadGames = React.useCallback(async () => {
    try {
      const list = (await api.gameBoostListGames?.()) as GameEntry[] | null;
      if (list) {
        setGames(list);
        setSelected((prev) => prev || (list.length ? list[0].id : null));
      }
    } catch { /* ok */ }
  }, [api]);

  const loadLibrary = React.useCallback(async () => {
    try {
      const list = (await api.gameBoostListLibrary?.()) as GameEntry[] | null;
      if (Array.isArray(list)) setLibrary(list);
    } catch { /* ok */ }
  }, [api]);

  const pollStatus = React.useCallback(async () => {
    try {
      const st = (await api.gameBoostSessionStatus?.()) as { running?: boolean; pending?: boolean; session?: { gameName?: string } } | null;
      if (st) {
        if (st.running) setSession('running');
        else if (st.pending) setSession('pending');
        else setSession((prev) => (prev === 'idle' ? prev : 'idle'));
      }
    } catch { /* ok */ }
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    const priority = new Set<string>();
    if (active?.path) priority.add(active.path);
    sidebarList.forEach((g) => { if (g.path) priority.add(g.path); });
    visibleLibrary.forEach((g) => { if (g.path) priority.add(g.path); });
    const paths = [...priority].filter((p) => p && !icons[p] && !iconQueue.current.has(p));
    const run = async () => {
      const queue = paths.slice(0, 24);
      let i = 0;
      const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (i < queue.length && !cancelled) {
          const p = queue[i++];
          if (!p || iconQueue.current.has(p) || icons[p]) continue;
          iconQueue.current.add(p);
          try {
            const res = (await api.gameBoostGetIcon?.(p)) as { ok?: boolean; dataUrl?: string | null; fileUrl?: string | null } | null;
            const url = res?.fileUrl || res?.dataUrl || null;
            if (!cancelled && url) {
              setIcons((prev) => (prev[p] ? prev : { ...prev, [p]: url }));
            }
          } catch { /* sem ícone */ }
        }
      });
      await Promise.all(workers);
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selected, games, library, showAllLibrary]);

  React.useEffect(() => {
    let cancelled = false;
    const items = [active, ...visibleLibrary]
      .filter((g): g is GameEntry => !!g && !!g.artworkPath)
      .slice(0, 12);
    const run = async () => {
      for (const g of items) {
        if (cancelled || !g.artworkPath) continue;
        if (art[g.id] || art[g.artworkPath]) continue;
        try {
          const res = (await api.gameBoostGetArtwork?.(g.artworkPath)) as { ok?: boolean; dataUrl?: string | null; fileUrl?: string | null } | null;
          const url = res?.fileUrl || res?.dataUrl || null;
          if (!cancelled && url) {
            const key = g.artworkPath;
            setArt((prev) => (prev[g.id] || prev[key] ? prev : { ...prev, [g.id]: url, [key]: url }));
          }
        } catch { /* sem arte */ }
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selected, library, showAllLibrary]);

  React.useEffect(() => {
    loadGames();
    loadLibrary();
    pollStatus();
    let alive = true;
    const off = api.onGameBoostSession?.((payload: { state?: string; message?: string }) => {
      if (!alive) return;
      if (payload.state === 'running') setSession('running');
      else if (payload.state === 'ended') setSession('ended');
      else if (payload.state === 'cancelled') setSession('cancelled');
      else if (payload.state === 'stopped') setSession('idle');
      if (payload.message) setSessionMsg(payload.message);
    });
    const t = setInterval(pollStatus, 8000);
    return () => {
      alive = false;
      clearInterval(t);
      if (typeof off === 'function') off();
    };
  }, [api, loadGames, loadLibrary, pollStatus]);

  const addGame = async () => {
    const path = (await api.gameBoostPickExe?.()) as string | null;
    if (!path) return;
    try {
      const item = (await api.gameBoostAddGame?.({ path })) as GameEntry | null;
      await loadGames();
      if (item) setSelected(item.id);
    } catch { /* ok */ }
  };

  const addFromLibrary = async (entry: GameEntry) => {
    try {
      const item = (await api.gameBoostAddGame?.({
        path: entry.path,
        name: entry.name,
        launch: entry.launch,
        platform: entry.platform,
        artworkPath: entry.artworkPath,
      })) as GameEntry | null;
      await loadGames();
      if (item) setSelected(item.id);
      return item;
    } catch {
      setSelected(entry.id);
      return entry;
    }
  };

  const removeGame = async (id: string) => {
    if (!window.confirm('Remover este jogo da lista?')) return;
    await api.gameBoostRemoveGame?.(id);
    await loadGames();
  };

  const startSession = async (entry?: GameEntry | null) => {
    const target = entry || active;
    if (!target || busy) return;
    let id = games.some((g) => g.id === target.id) ? target.id : null;
    if (!id) {
      const added = await addFromLibrary(target);
      id = added?.id || null;
    }
    if (!id) return;
    setBusy(true);
    setSession('pending');
    setSessionMsg('Preparando boost…');
    try {
      const res = (await api.gameBoostStartSession?.(id)) as { ok?: boolean; pending?: boolean; message?: string; error?: string } | null;
      if (res?.error) {
        setSession('error');
        setSessionMsg(res.error);
      } else if (res?.message) {
        setSessionMsg(res.message);
      }
    } catch (err) {
      setSession('error');
      setSessionMsg((err as Error)?.message || 'Falha ao iniciar sessão.');
    }
    setBusy(false);
  };

  const stopSession = async () => {
    setBusy(true);
    try {
      await api.gameBoostStopSession?.();
      setSession('ended');
      setSessionMsg('Boost encerrado.');
    } catch { /* ok */ }
    setBusy(false);
  };

  const runAnalyze = async () => {
    if (analyzeBusy) return;
    setAnalyzeBusy(true);
    setAnalyze(null);
    try {
      const res = (await api.gameBoostAnalyze?.()) as AnalyzeResult | null;
      if (res?.ok || res?.score != null) setAnalyze(res);
    } catch { /* ok */ }
    setAnalyzeBusy(false);
  };

  return (
    <div className="view-appear flex h-full min-h-[560px] gap-5 overflow-hidden">
      <div className="flex w-56 shrink-0 flex-col rounded-lg bg-[var(--orion-surface)] px-3 py-4">
        <div className="mb-3 flex items-center gap-2 px-2">
          <Gamepad2 className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Jogos</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebarList.map((g) => {
            const isActive = g.id === selected;
            return (
              <div key={g.id} className="group mb-0.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(g.id)}
                  className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-[var(--orion-selected-bg)] text-foreground'
                      : 'text-muted-foreground hover:bg-[var(--orion-selected-bg)]/50 hover:text-foreground'
                  }`}
                >
                  {icons[g.path] ? (
                    <img src={icons[g.path]} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
                  ) : (
                    <Gamepad2 className="h-4 w-4 shrink-0 text-[var(--orion-icon-default)]" />
                  )}
                  <span className="line-clamp-1 flex-1 font-medium">{g.name}</span>
                  {!g.isDefault && games.some((x) => x.id === g.id) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeGame(g.id); }}
                      className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-red-400 group-hover:inline-flex"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addGame}
          className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          ADICIONAR JOGO
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {!active ? (
          <div className="mb-5 flex flex-col items-center justify-center rounded-lg bg-[var(--orion-surface)] p-10 text-center">
            <Gamepad2 className="mb-4 h-10 w-10 text-[var(--orion-icon-default)]/40" />
            <p className="mb-1 text-lg font-semibold text-foreground">Nenhum jogo selecionado</p>
            <p className="mb-5 text-sm text-muted-foreground">Adicione um jogo ou escolha um da biblioteca.</p>
            <button
              type="button"
              onClick={addGame}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
            >
              <Plus className="h-4 w-4" />
              ADICIONAR JOGO
            </button>
          </div>
        ) : (
          <>
            <div
              className="relative mb-5 flex min-h-[200px] items-end overflow-hidden rounded-lg p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
              style={{
                background: activeArt
                  ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.78)), url(${activeArt}) center/cover no-repeat`
                  : gradientForName(active.name),
              }}
            >
              {activeIcon && !activeArt && (
                <img
                  src={activeIcon}
                  alt={active.name}
                  className="pointer-events-none absolute right-6 top-1/2 h-28 w-28 -translate-y-1/2 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
                />
              )}
              {!activeArt && <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/80 via-black/30 to-transparent" />}
              <div className="relative z-10">
                <p className="mb-1 text-2xl font-bold uppercase tracking-wide text-white">{active.name}</p>
                <p className="mb-1 max-w-lg truncate text-xs text-white/60">{active.path}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${STATUS_COLOR[session]}`}>
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                    {STATUS_LABELS[session]}
                  </span>
                </div>
                {sessionMsg && <p className="mt-2 max-w-lg text-xs text-white/70">{sessionMsg}</p>}
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-3">
              {session !== 'running' && session !== 'pending' ? (
                <button
                  type="button"
                  onClick={() => startSession(active)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
                >
                  <Power className="h-4 w-4" />
                  INICIAR JOGO
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopSession}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-[var(--orion-selected-bg)] disabled:opacity-60"
                >
                  <Power className="h-4 w-4" />
                  ENCERRAR SESSÃO
                </button>
              )}
              <button
                type="button"
                onClick={runAnalyze}
                disabled={analyzeBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
              >
                <Activity className={'h-4 w-4 ' + (analyzeBusy ? 'animate-spin' : '')} />
                {analyzeBusy ? 'Analisando…' : 'ANALISAR GAME BOOST'}
              </button>
            </div>
          </>
        )}

        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold text-foreground">Biblioteca</h3>
            {library.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllLibrary((v) => !v)}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {showAllLibrary ? 'Recolher' : 'Exibir tudo'}
              </button>
            )}
          </div>
          {library.length === 0 ? (
            <p className="rounded-lg bg-[var(--orion-surface)] px-4 py-6 text-sm text-muted-foreground">
              Nenhum aplicativo detectado ainda. Adicione um jogo manualmente ou instale Steam/Epic para popular a biblioteca.
            </p>
          ) : (
            <div className="relative">
              <div ref={railRef} className="flex gap-3 overflow-x-auto pb-2">
                {visibleLibrary.map((g) => {
                  const cover = art[g.id] || (g.artworkPath ? art[g.artworkPath] : null);
                  const icon = icons[g.path];
                  return (
                    <div
                      key={g.id}
                      className="group relative h-44 w-36 shrink-0 overflow-hidden rounded-lg bg-[var(--orion-surface)]"
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(g.id)}
                        className="absolute inset-0"
                        style={{
                          background: cover
                            ? `url(${cover}) center/cover no-repeat`
                            : gradientForName(g.name),
                        }}
                      >
                        {!cover && icon && (
                          <img src={icon} alt="" className="absolute left-1/2 top-[38%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-lg" />
                        )}
                      </button>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-1.5 px-3 group-hover:flex">
                        <button
                          type="button"
                          onClick={() => setSelected(g.id)}
                          className="w-full rounded bg-emerald-500 px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-black"
                        >
                          Configurações
                        </button>
                        <button
                          type="button"
                          onClick={() => startSession(g)}
                          className="w-full text-[0.68rem] font-semibold uppercase tracking-wide text-white"
                        >
                          Jogar
                        </button>
                      </div>
                      <p className="absolute inset-x-0 bottom-0 z-10 truncate px-2 py-2 text-xs font-medium text-white">{g.name}</p>
                    </div>
                  );
                })}
              </div>
              {library.length > 4 && (
                <button
                  type="button"
                  onClick={() => railRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
                  className="absolute right-0 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white md:flex"
                  aria-label="Ver mais"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {library.length > 4 && (
                <button
                  type="button"
                  onClick={() => railRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
                  className="absolute left-0 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white md:flex"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {analyze && (
          <div className="rounded-lg bg-[var(--orion-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-foreground">{analyze.score}</span>
                <div className="flex flex-col gap-0.5">
                  {analyze.counts?.critical ? <span className="text-xs text-red-400">{analyze.counts.critical} críticas</span> : null}
                  {analyze.counts?.recommended ? <span className="text-xs text-amber-400">{analyze.counts.recommended} recomendadas</span> : null}
                  {analyze.counts?.optional ? <span className="text-xs text-muted-foreground">{analyze.counts.optional} opcionais</span> : null}
                </div>
              </div>
            </div>
            {analyze.checks && analyze.checks.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verificações</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {analyze.checks.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${c.value === true ? 'bg-green-500' : c.value === false ? 'bg-red-400' : 'bg-muted-foreground'}`} />
                      <span className="flex-1 text-muted-foreground">{c.label}</span>
                      <span className="text-foreground">{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {analyze.recommendations && analyze.recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recomendações</p>
                {analyze.recommendations.map((r) => (
                  <div key={r.id} className="mb-2 flex gap-3 rounded-lg bg-black/20 px-3 py-2.5 text-sm">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--orion-icon-default)]" />
                    <div>
                      <p className="font-medium text-foreground">{r.name || r.id}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
