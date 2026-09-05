import React from 'react';
import { Cpu, HardDrive, MemoryStick, Monitor, RefreshCcw, CircuitBoard, Lock, ShieldCheck, Gauge } from 'lucide-react';
import { useApi } from '@/api';
import { Sparkline } from '@/components/Sparkline';
import type { MonitorSnapshot } from '@/api/types';

interface SystemProfile {
  os?: { caption?: string; build?: string; arch?: string; edition?: string; pcType?: string } | null;
  cpu?: { name?: string; brand?: string; cores?: number; threads?: number; baseClockMhz?: number; currentClockMhz?: number; boostClockMhz?: number; socket?: string; architecture?: string } | null;
  ram?: { totalGB?: number; count?: number; ddrType?: string; maxConfigMHz?: number; maxRatedMHz?: number; dualChannelLikely?: boolean; slotsTotal?: number } | null;
  motherboard?: { vendorDisplay?: string; boardProduct?: string; chipset?: string; version?: string; formFactor?: string } | null;
  bios?: { version?: string; dateISO?: string; ageYears?: number; name?: string; vendor?: string } | null;
  gpu?: { name?: string; vendor?: string; vramMB?: number; driver?: string; isIntegrated?: boolean }[] | null;
  boot?: { mode?: string } | null;
  secureBoot?: string | null;
  tpm?: { stateLabel?: string; state?: string; specVersion?: string } | null;
}

interface AnalysisResult {
  profile?: SystemProfile;
  scores?: { overall?: number; categories?: Record<string, { percent?: number }> };
  counts?: { critical?: number; recommended?: number; optional?: number };
  recommendations?: { id?: string; name?: string; effectiveLevel?: string; reason?: string }[];
}

function gpuPercent(snap: MonitorSnapshot | null): number | null {
  const gpu = snap?.gpu;
  if (!gpu) return null;
  if (typeof gpu.percent === 'number') return gpu.percent;
  if (typeof gpu.usagePercent === 'number') return gpu.usagePercent;
  if (typeof gpu.vramUsedMB === 'number' && typeof gpu.vramTotalMB === 'number' && gpu.vramTotalMB > 0) {
    return Math.round((gpu.vramUsedMB / gpu.vramTotalMB) * 100);
  }
  return null;
}

function nd(val: unknown, unit = ''): string {
  if (val == null || val === false) return 'N/D';
  const n = Number(val);
  if (unit === '' && Number.isFinite(n) && n === 0) return 'N/D';
  return unit === 'GB' ? `${Number(val).toFixed(1)} ${unit}` : unit ? `${val} ${unit}` : String(val);
}

function ScoreRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? 'var(--orion-icon-active)' : value >= 50 ? 'var(--orion-icon-default)' : '#ef4444';
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="38" fill="none" stroke="var(--orion-surface)" strokeWidth="4" />
        <circle cx="40" cy="40" r="38" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function Sistema({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi();
  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);
  const [snap, setSnap] = React.useState<MonitorSnapshot | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const hist = React.useRef<{ cpu: number[]; temp: number[] }>({ cpu: [], temp: [] });
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const loadLast = React.useCallback(async () => {
    try {
      const last = (await api.getLast?.()) as AnalysisResult | null;
      if (last?.profile) {
        setAnalysis(last);
        setUpdatedAt(last.profile?.os?.build ? new Date().toLocaleTimeString() : null);
      }
    } catch { /* ok */ }
  }, [api]);

  React.useEffect(() => {
    loadLast();
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.monitorSnapshot();
        if (!alive) return;
        setSnap(s);
        if (s?.cpu != null) { hist.current.cpu.push(s.cpu); if (hist.current.cpu.length > 40) hist.current.cpu.shift(); }
        if (s?.tempC != null) { hist.current.temp.push(s.tempC); if (hist.current.temp.length > 40) hist.current.temp.shift(); }
        force();
      } catch { /* ok */ }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(t); };
  }, [api, loadLast]);

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await api.analyze() as { overall?: number; historyId?: string } | null;
      await loadLast();
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch { /* ok */ }
    setAnalyzing(false);
  };

  const profile = analysis?.profile;
  const score = analysis?.scores?.overall ?? null;
  const counts = analysis?.counts;
  const cpu = profile?.cpu;
  const ram = profile?.ram;
  const mobo = profile?.motherboard;
  const bios = profile?.bios;
  const gpus = profile?.gpu ?? [];
  const primaryGpu = gpus.find((g) => !g.isIntegrated) || gpus[0] || null;

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">Diagnóstico completo do hardware, firmware e saúde do PC.</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">{updatedAt}</span>}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:opacity-60"
          >
            <RefreshCcw className={'h-4 w-4 ' + (analyzing ? 'animate-spin' : '')} />
            {analyzing ? 'Analisando…' : 'ATUALIZAR'}
          </button>
        </div>
      </div>

      {!analysis && !analyzing && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Nenhuma análise disponível. Execute a análise para ver o diagnóstico do sistema.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)]"
          >
            <RefreshCcw className="h-4 w-4" />
            EXECUTAR ANÁLISE
          </button>
        </div>
      )}

      {analyzing && (
        <div className="rounded-lg bg-[var(--orion-surface)] p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Analisando sistema…</p>
        </div>
      )}

      {profile && (
        <>
          {/* Resumo compacto */}
          <div className="flex flex-wrap items-center gap-6 rounded-lg bg-[var(--orion-surface)] px-5 py-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[var(--orion-icon-default)]" />
              <span className="text-foreground">{cpu?.brand || 'CPU'}</span>
              {cpu?.cores && <span>{cpu.cores}C/{cpu.threads}T</span>}
            </span>
            <span className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-[var(--orion-icon-default)]" />
              {ram?.totalGB ? <span className="text-foreground">{ram.totalGB} GB</span> : <span>RAM N/D</span>}
              {ram?.ddrType && <span>{ram.ddrType}</span>}
            </span>
            <span className="flex items-center gap-2">
              <CircuitBoard className="h-4 w-4 text-[var(--orion-icon-default)]" />
              {mobo?.vendorDisplay ? <span className="text-foreground">{mobo.vendorDisplay}</span> : <span>Placa-mãe N/D</span>}
              {mobo?.chipset && <span>{mobo.chipset}</span>}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />
              <span>{profile?.boot?.mode || 'Modo boot N/D'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Coluna esquerda */}
            <div className="space-y-5 lg:col-span-2">
              {/* Processador */}
              <Section title="Processador" icon={<Cpu className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <InfoRow label="Modelo" value={nd(cpu?.name)} />
                <InfoRow label="Núcleos / Threads" value={cpu?.cores ? `${cpu.cores} / ${cpu.threads}` : 'N/D'} />
                <InfoRow label="Clock base" value={nd(cpu?.baseClockMhz, 'MHz')} />
                <InfoRow label="Clock atual" value={nd(cpu?.currentClockMhz, 'MHz')} />
                <InfoRow label="Boost" value={nd(cpu?.boostClockMhz, 'MHz')} />
                <InfoRow label="Socket" value={nd(cpu?.socket)} />
                <InfoRow label="Arquitetura" value={nd(cpu?.architecture)} />
              </Section>

              {/* Indicadores de CPU ao vivo */}
              <Section title="Indicadores de CPU" icon={<Gauge className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <div className="grid grid-cols-3 gap-4">
                  <LiveStat label="Uso" value={snap?.cpu != null ? Math.round(snap.cpu) : null} unit="%" hist={hist.current.cpu} />
                  <LiveStat label="Clock" value={cpu?.currentClockMhz ? Math.round(cpu.currentClockMhz / 1000 * 10) / 10 : null} unit=" GHz" hist={[]} />
                  <LiveStat label="Temp." value={snap?.tempC != null ? Math.round(snap.tempC) : null} unit="°C" hist={hist.current.temp} />
                </div>
              </Section>

              {/* Memória */}
              <Section title="Memória" icon={<MemoryStick className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <InfoRow label="Capacidade total" value={nd(ram?.totalGB, 'GB')} />
                <InfoRow label="Módulos" value={ram?.count ? `${ram.count} / ${ram.slotsTotal ?? '?'}` : 'N/D'} />
                <InfoRow label="Tipo" value={nd(ram?.ddrType)} />
                <InfoRow label="Velocidade config." value={nd(ram?.maxConfigMHz, 'MHz')} />
                <InfoRow label="Velocidade anunciada" value={nd(ram?.maxRatedMHz, 'MHz')} />
                <InfoRow label="Dual Channel" value={ram?.dualChannelLikely === true ? 'Provável' : ram?.dualChannelLikely === false ? 'Não' : 'N/D'} />
              </Section>

              {/* Placa-mãe e BIOS */}
              <Section title="Placa-mãe e BIOS" icon={<CircuitBoard className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <InfoRow label="Fabricante" value={nd(mobo?.vendorDisplay)} />
                <InfoRow label="Modelo" value={nd(mobo?.boardProduct)} />
                <InfoRow label="Chipset" value={nd(mobo?.chipset)} />
                <InfoRow label="Versão BIOS" value={nd(bios?.version)} />
                <InfoRow label="Data BIOS" value={bios?.dateISO || 'N/D'} />
                <InfoRow label="Tipo de chassis" value={nd(mobo?.formFactor)} />
              </Section>
            </div>

            {/* Coluna direita */}
            <div className="space-y-5">
              {/* GPU */}
              <Section title="GPU" icon={<Monitor className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                {gpus.length === 0 && <p className="text-sm text-muted-foreground">N/D</p>}
                {gpus.map((g, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-sm font-medium text-foreground">{g.name || 'N/D'}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.vendor && `${g.vendor} · `}{g.vramMB ? `${(g.vramMB / 1024).toFixed(1)} GB VRAM` : 'VRAM N/D'}
                    </p>
                  </div>
                ))}
              </Section>

              {/* Firmware */}
              <Section title="Firmware" icon={<Lock className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                <InfoRow label="Modo de boot" value={nd(profile?.boot?.mode)} />
                <InfoRow label="Secure Boot" value={nd(profile?.secureBoot)} />
                <InfoRow label="TPM" value={nd(profile?.tpm?.stateLabel)} />
                {profile?.tpm?.specVersion && <InfoRow label="Versão TPM" value={profile.tpm.specVersion} />}
              </Section>

              {/* System Health */}
              {score != null && (
                <Section title="System Health" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                  <div className="flex flex-col items-center py-2">
                    <ScoreRing value={score} />
                    <p className="mt-2 text-xs text-muted-foreground">Índice geral de saúde do sistema</p>
                  </div>
                </Section>
              )}

              {/* Recomendações */}
              {counts && (
                <Section title="Recomendações" icon={<Gauge className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
                  <div className="flex gap-4 text-sm">
                    {counts.critical ? <span className="text-red-400">{counts.critical} críticas</span> : null}
                    {counts.recommended ? <span className="text-amber-400">{counts.recommended} recomendadas</span> : null}
                    {counts.optional ? <span className="text-muted-foreground">{counts.optional} opcionais</span> : null}
                    {!counts.critical && !counts.recommended && !counts.optional && <span className="text-green-400">Nenhuma recomendação</span>}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </>
      )}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function LiveStat({ label, value, unit, hist }: { label: string; value: number | null; unit: string; hist: number[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">
        {value != null ? value : '—'}
        <small className="text-xs font-medium text-muted-foreground">{unit}</small>
      </span>
      {hist.length > 1 && (
        <div className="h-7 overflow-hidden">
          <Sparkline values={hist.slice(-30)} width={100} height={28} />
        </div>
      )}
    </div>
  );
}