import React from 'react';
import { Cpu, MemoryStick, HardDrive, Play, History, Flag, AlertTriangle, X, Gauge } from 'lucide-react';
import { useApi } from '@/api';

// ---------------------------------------------------------------------------
// Tipos locais (métodos ainda não tipados em OrionApi)
// ---------------------------------------------------------------------------

type BenchKind = 'cpu' | 'ram' | 'disk';

interface BenchCpu {
  threads?: number | null;
  singleScore?: number | null;
  multiScore?: number | null;
  speedup?: number | null;
  note?: string;
}
interface BenchRam {
  gbPerSec?: number | null;
  note?: string;
}
interface BenchDisk {
  readMBps?: number | null;
  writeMBps?: number | null;
  sizeMB?: number | null;
  note?: string;
}

/** Formato do backend real (benchmarkService.js). */
interface BenchEntryRaw {
  id?: string;
  date?: string | number;
  ts?: number;
  label?: string;
  cpu?: BenchCpu | null;
  ram?: BenchRam | null;
  disk?: BenchDisk | null;
  // Formato do mock-api.js (achatado)
  cpuSingle?: number;
  cpuMulti?: number;
  ramGBs?: number;
  diskReadMBs?: number;
  diskWriteMBs?: number;
}

interface BenchEntry {
  id: string;
  date: Date;
  label: string;
  cpu: BenchCpu | null;
  ram: BenchRam | null;
  disk: BenchDisk | null;
}

interface BenchmarkApi {
  benchmarkRun(payload: { kinds?: BenchKind[]; label?: string }): Promise<BenchEntryRaw>;
  benchmarkList(): Promise<BenchEntryRaw[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normaliza o resultado (backend real ou mock) para um formato único. */
function normalize(raw: BenchEntryRaw | null | undefined, idx = 0): BenchEntry | null {
  if (!raw) return null;
  const when = raw.date ?? raw.ts ?? Date.now();
  const date = new Date(when);
  const cpu: BenchCpu | null = raw.cpu
    ? raw.cpu
    : raw.cpuSingle != null || raw.cpuMulti != null
      ? {
          singleScore: raw.cpuSingle ?? null,
          multiScore: raw.cpuMulti ?? null,
          speedup: raw.cpuSingle && raw.cpuMulti ? Math.round((raw.cpuMulti / raw.cpuSingle) * 10) / 10 : null,
        }
      : null;
  const ram: BenchRam | null = raw.ram ? raw.ram : raw.ramGBs != null ? { gbPerSec: raw.ramGBs } : null;
  const disk: BenchDisk | null = raw.disk
    ? raw.disk
    : raw.diskReadMBs != null || raw.diskWriteMBs != null
      ? { readMBps: raw.diskReadMBs ?? null, writeMBps: raw.diskWriteMBs ?? null }
      : null;
  return {
    id: raw.id || `bm-${Number.isNaN(date.getTime()) ? idx : date.getTime()}-${idx}`,
    date: Number.isNaN(date.getTime()) ? new Date() : date,
    label: raw.label || 'Benchmark manual',
    cpu,
    ram,
    disk,
  };
}

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

const KIND_META: Record<BenchKind, { label: string; desc: string; icon: React.ReactNode }> = {
  cpu: {
    label: 'CPU single/multi-thread',
    desc: '~15 s · carga determinística em 1 thread e em todas',
    icon: <Cpu className="h-4 w-4 text-[var(--orion-icon-default)]" />,
  },
  ram: {
    label: 'Banda de memória',
    desc: '~2 s · cópia de memória em GB/s',
    icon: <MemoryStick className="h-4 w-4 text-[var(--orion-icon-default)]" />,
  },
  disk: {
    label: 'Disco sequencial',
    desc: '~5–20 s · grava e lê 512 MB temporários',
    icon: <HardDrive className="h-4 w-4 text-[var(--orion-icon-default)]" />,
  },
};

const ALL_KINDS: BenchKind[] = ['cpu', 'ram', 'disk'];

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Benchmark({ onNavigate }: { onNavigate?: (view: string) => void }) {
  void onNavigate;
  const api = useApi() as unknown as BenchmarkApi;
  const [history, setHistory] = React.useState<BenchEntry[]>([]);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<BenchEntry | null>(null);
  const [running, setRunning] = React.useState(false);
  const [kinds, setKinds] = React.useState<BenchKind[]>(ALL_KINDS);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [banner, setBanner] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = React.useRef(true);

  const showBanner = React.useCallback((kind: 'ok' | 'error', text: string, ms = 9000) => {
    setBanner({ kind, text });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => { if (alive.current) setBanner(null); }, ms);
  }, []);

  const loadHistory = React.useCallback(async () => {
    try {
      const list = (await api.benchmarkList()) ?? [];
      if (!alive.current) return;
      const norm = (Array.isArray(list) ? list : [])
        .map((r, i) => normalize(r, i))
        .filter((x): x is BenchEntry => x != null)
        .reverse(); // mais recente primeiro (como no legado)
      setHistory(norm);
      setHistoryError(null);
    } catch (err) {
      if (!alive.current) return;
      setHistory([]);
      setHistoryError(errMsg(err, 'Não foi possível carregar o histórico.'));
    }
  }, [api]);

  React.useEffect(() => {
    alive.current = true;
    loadHistory();
    return () => {
      alive.current = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [loadHistory]);

  const toggleKind = (k: BenchKind) => {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : ALL_KINDS.filter((x) => x === k || prev.includes(x))));
  };

  const isFull = kinds.length === ALL_KINDS.length;

  const runBenchmark = async () => {
    setConfirmOpen(false);
    if (running || kinds.length === 0) return;
    setRunning(true);
    setBanner(null);
    try {
      const payload = isFull ? {} : { kinds, label: 'Benchmark parcial' };
      const raw = await api.benchmarkRun(payload);
      if (!alive.current) return;
      const res = normalize(raw);
      setResult(res);
      await loadHistory();
      if (res) {
        const parts: string[] = [];
        if (res.cpu?.multiScore != null) parts.push(`CPU multi: ${fmtNum(res.cpu.multiScore)} pts`);
        else if (res.cpu?.singleScore != null) parts.push(`CPU single: ${fmtNum(res.cpu.singleScore)} pts`);
        if (res.ram?.gbPerSec != null) parts.push(`RAM: ${fmtNum(res.ram.gbPerSec, 2)} GB/s`);
        if (res.disk?.readMBps != null) parts.push(`Disco: ${fmtNum(res.disk.readMBps)} MB/s leitura`);
        showBanner('ok', `Benchmark concluído${parts.length ? ' — ' + parts.join(' · ') : '.'}`);
      }
    } catch (err) {
      if (alive.current) showBanner('error', `Falha no benchmark: ${errMsg(err, 'erro desconhecido')}`);
    } finally {
      if (alive.current) setRunning(false);
    }
  };

  return (
    <div className="view-appear space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Benchmark</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Medições reais de CPU (single/multi-thread), banda de memória e taxa sequencial de disco. Os índices comparam
            apenas execuções deste aplicativo — nenhum ganho de FPS é prometido ou estimado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={running || kinds.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          {isFull ? 'EXECUTAR BENCHMARK COMPLETO' : 'EXECUTAR BENCHMARK'}
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${
            banner.kind === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          <span className="flex items-center gap-2">
            {banner.kind === 'ok' ? <Flag className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {banner.text}
          </span>
          <button type="button" onClick={() => setBanner(null)} className="text-muted-foreground hover:text-foreground" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Seleção de testes */}
      <Section title="Testes a executar" icon={<Gauge className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ALL_KINDS.map((k) => {
            const meta = KIND_META[k];
            const checked = kinds.includes(k);
            return (
              <label
                key={k}
                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  checked ? 'bg-[var(--orion-selected-bg)]' : 'bg-black/20 hover:bg-[var(--orion-selected-bg)]/50'
                } ${running ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={running}
                  onChange={() => toggleKind(k)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {meta.icon}
                    {meta.label}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
        {kinds.length === 0 && <p className="mt-3 text-xs text-red-400">Selecione ao menos um teste.</p>}
      </Section>

      {/* Estado executando */}
      {running && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {isFull
              ? 'Medindo CPU, memória e disco… isso pode levar até 40 segundos.'
              : `Medindo ${kinds.map((k) => KIND_META[k].label.split(' ')[0]).join(', ')}… aguarde.`}
          </p>
        </div>
      )}

      {/* Resultado medido */}
      {result && !running && <BenchResult entry={result} />}

      {/* Histórico */}
      <Section title="Histórico de benchmarks" icon={<History className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
        {historyError && <p className="mb-3 text-xs text-red-400">{historyError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Th>Data</Th>
                <Th>CPU single</Th>
                <Th>CPU multi</Th>
                <Th>Melhoria multi</Th>
                <Th>RAM (GB/s)</Th>
                <Th>Disco leitura</Th>
                <Th>Disco gravação</Th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum benchmark executado ainda.
                  </td>
                </tr>
              ) : (
                history.map((b) => (
                  <tr key={b.id} className="border-t border-border/40 text-foreground">
                    <Td>{b.date.toLocaleString('pt-BR')}</Td>
                    <Td>{b.cpu?.singleScore != null ? <><b>{fmtNum(b.cpu.singleScore)}</b> <span className="text-muted-foreground">pts</span></> : '—'}</Td>
                    <Td>{b.cpu?.multiScore != null ? <><b>{fmtNum(b.cpu.multiScore)}</b> <span className="text-muted-foreground">pts</span></> : '—'}</Td>
                    <Td>{b.cpu?.speedup ? `×${b.cpu.speedup}` : '—'}</Td>
                    <Td>{b.ram?.gbPerSec != null ? <><b>{fmtNum(b.ram.gbPerSec, 2)}</b> <span className="text-muted-foreground">GB/s</span></> : '—'}</Td>
                    <Td>{b.disk?.readMBps != null ? `${fmtNum(b.disk.readMBps)} MB/s` : '—'}</Td>
                    <Td>{b.disk?.writeMBps != null ? `${fmtNum(b.disk.writeMBps)} MB/s` : '—'}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Diálogo de confirmação */}
      {confirmOpen && (
        <ConfirmDialog
          title={isFull ? 'Executar o benchmark completo?' : 'Executar o benchmark selecionado?'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={runBenchmark}
          confirmLabel="EXECUTAR"
        >
          <ul className="m-0 mb-3 list-none space-y-1.5 p-0 text-sm text-foreground">
            {kinds.map((k) => (
              <li key={k} className="flex items-center gap-2">
                {KIND_META[k].icon}
                <span>{KIND_META[k].label}</span>
                <span className="text-xs text-muted-foreground">({KIND_META[k].desc})</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-muted-foreground">
            Feche jogos e programas pesados para um resultado mais estável.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function BenchResult({ entry: b }: { entry: BenchEntry }) {
  const rows: { comp: string; metric: string; value: React.ReactNode }[] = [];
  if (b.cpu) {
    rows.push({ comp: 'CPU', metric: 'Single-thread', value: <><b>{fmtNum(b.cpu.singleScore)}</b> pts</> });
    rows.push({
      comp: '',
      metric: `Multi-thread${b.cpu.threads ? ` (${b.cpu.threads} threads)` : ''}`,
      value: <><b>{fmtNum(b.cpu.multiScore)}</b> pts</>,
    });
    rows.push({ comp: '', metric: 'Escala multi/single', value: b.cpu.speedup ? `×${b.cpu.speedup}` : '—' });
  }
  if (b.ram) rows.push({ comp: 'RAM', metric: 'Banda de cópia', value: <><b>{fmtNum(b.ram.gbPerSec, 2)}</b> GB/s</> });
  if (b.disk) {
    rows.push({ comp: 'Disco', metric: 'Leitura sequencial', value: <><b>{fmtNum(b.disk.readMBps)}</b> MB/s</> });
    rows.push({ comp: '', metric: 'Gravação sequencial', value: <><b>{fmtNum(b.disk.writeMBps)}</b> MB/s</> });
  }

  return (
    <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Flag className="h-4 w-4 text-[var(--orion-icon-default)]" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--orion-icon-active)]">
          Resultado medido ({b.date.toLocaleTimeString('pt-BR')})
        </span>
      </div>

      {/* Destaques */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="CPU single" value={b.cpu ? fmtNum(b.cpu.singleScore) : '—'} unit="pts" />
        <Stat label="CPU multi" value={b.cpu ? fmtNum(b.cpu.multiScore) : '—'} unit="pts" />
        <Stat label="RAM" value={b.ram ? fmtNum(b.ram.gbPerSec, 2) : '—'} unit="GB/s" />
        <Stat label="Disco (leitura)" value={b.disk ? fmtNum(b.disk.readMBps) : '—'} unit="MB/s" />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Th>Componente</Th>
            <Th>Métrica</Th>
            <Th>Valor medido</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40 text-foreground">
              <Td><b>{r.comp}</b></Td>
              <Td className="text-muted-foreground">{r.metric}</Td>
              <Td>{r.value}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-muted-foreground">
        Valores medidos agora nesta máquina. Índices de CPU são internos deste aplicativo (comparáveis apenas entre
        execuções aqui).
        {b.cpu?.speedup ? (
          <>
            {' '}O ganho multi-thread medido foi de <b className="text-foreground">×{b.cpu.speedup}</b> sobre single-thread.
          </>
        ) : null}
      </p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-lg font-semibold text-foreground">
        {value}
        <small className="ml-1 text-xs font-medium text-muted-foreground">{unit}</small>
      </div>
    </div>
  );
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 font-semibold">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className}`}>{children}</td>;
}

function ConfirmDialog({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = 'CONFIRMAR',
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--orion-surface)] p-5 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        <h3 className="m-0 mb-3 text-base font-semibold text-foreground">{title}</h3>
        <div className="mb-5">{children}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
