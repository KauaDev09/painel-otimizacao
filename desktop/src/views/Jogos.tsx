import React from 'react';
import { Gamepad2, Plus, Trash2, Power, Activity, ChevronRight } from 'lucide-react';
import { useApi } from '@/api';

interface GameEntry {
  id: string;
  name: string;
  path: string;
  addedAt?: string;
  isDefault?: boolean;
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
  return `linear-gradient(135deg, hsl(${hue}, 40%, 14%), hsl(${(hue + 30) % 360}, 35%, 8%))`;
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
  const [selected, setSelected] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<SessionState>('idle');
  const [sessionMsg, setSessionMsg] = React.useState('');
  const [analyze, setAnalyze] = React.useState<AnalyzeResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);

  const active = games.find((g) => g.id === selected) || null;

  const loadGames = React.useCallback(async () => {
    try {
      const list = (await api.gameBoostListGames?.()) as GameEntry[] | null;
      if (list) {
        setGames(list);
        setSelected((prev) => prev || (list.length ? list[0].id : null));
      }
    } catch { /* ok */ }
  }, [api]);

  const pollStatus = React.useCallback(async () => {
    try {
      const st = (await api.gameBoostSessionStatus?.()) as { running?: boolean; pending?: boolean; session?: { gameName?: string } } | null;
      if (st) {
        if (st.running) setSession('running');
        else if (st.pending) setSession('pending');
        else if (session !== 'idle') setSession('idle');
      }
    } catch { /* ok */ }
  }, [api]);

  React.useEffect(() => {
    loadGames();
    pollStatus();
    let alive = true;
    let msgCleanup: (() => void) | undefined;

    api.onGameBoostSession?.((payload: { state?: string; message?: string }) => {
      if (!alive) return;
      if (payload.state === 'running') setSession('running');
      else if (payload.state === 'ended') setSession('ended');
      else if (payload.state === 'cancelled') setSession('cancelled');
      else if (payload.state === 'stopped') setSession('idle');
      if (payload.message) setSessionMsg(payload.message);
    });

    const t = setInterval(pollStatus, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [api, loadGames, pollStatus]);

  const addGame = async () => {
    const path = (await api.gameBoostPickExe?.()) as string | null;
    if (!path) return;
    try {
      const item = (await api.gameBoostAddGame?.({ path })) as GameEntry | null;
      await loadGames();
      if (item) setSelected(item.id);
    } catch { /* ok */ }
  };

  const removeGame = async (id: string) => {
    if (!window.confirm('Remover este jogo da lista?')) return;
    await api.gameBoostRemoveGame?.(id);
    await loadGames();
  };

  const startSession = async () => {
    if (!active || busy) return;
    setBusy(true);
    setSession('pending');
    setSessionMsg('Preparando boost…');
    try {
      const res = (await api.gameBoostStartSession?.(active.id)) as { ok?: boolean; pending?: boolean; message?: string; error?: string } | null;
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
      if (res?.ok) setAnalyze(res);
    } catch { /* ok */ }
    setAnalyzeBusy(false);
  };

  return (
    <div className="view-appear flex h-full gap-5 overflow-hidden">
      {/* Sidebar da lista */}
      <div className="flex w-56 shrink-0 flex-col rounded-lg bg-[var(--orion-surface)] px-3 py-4">
        <div className="mb-3 flex items-center gap-2 px-2">
          <Gamepad2 className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Jogos</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {games.map((g) => {
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
                  <span className="line-clamp-1 flex-1 font-medium">{g.name}</span>
                  {!g.isDefault && (
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

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-[var(--orion-surface)] p-10 text-center">
            <Gamepad2 className="mb-4 h-10 w-10 text-[var(--orion-icon-default)]/40" />
            <p className="mb-1 text-lg font-semibold text-foreground">Nenhum jogo selecionado</p>
            <p className="mb-5 text-sm text-muted-foreground">Adicione um jogo ou aplicativo para usar o Game Boost.</p>
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
            {/* Banner */}
            <div
              className="relative mb-5 flex flex-1 items-end rounded-lg p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
              style={{ background: gradientForName(active.name), minHeight: 180 }}
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {active.name}
                </p>
                <p className="mb-1 max-w-lg truncate text-xs text-muted-foreground/70">{active.path}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${STATUS_COLOR[session]}`}>
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                    {STATUS_LABELS[session]}
                  </span>
                </div>
                {sessionMsg && <p className="mt-2 max-w-lg text-xs text-muted-foreground">{sessionMsg}</p>}
              </div>
            </div>

            {/* Botões */}
            <div className="mb-5 flex flex-wrap gap-3">
              {session !== 'running' && session !== 'pending' ? (
                <button
                  type="button"
                  onClick={startSession}
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

            {/* Resultado da análise */}
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
          </>
        )}
      </div>
    </div>
  );
}