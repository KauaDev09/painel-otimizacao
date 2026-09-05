import React from 'react';
import { Rocket, type LucideIcon } from 'lucide-react';
import { useApi } from '@/api';
import { Sparkline } from '@/components/Sparkline';
import type { MonitorSnapshot } from '@/api/types';

interface LiveCardProps {
  icon: LucideIcon | null;
  title: string;
  value: string;
  unit: string;
  desc: string;
  hist: number[];
}

function LiveCard({ icon: Icon, title, value, unit, desc, hist }: LiveCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <span>{title}</span>
      </div>
      <div className="mb-1 text-2xl font-semibold text-foreground">
        {value}
        <small className="ml-1 text-sm font-medium text-muted-foreground">{unit}</small>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{desc}</div>
      <div className="h-8 overflow-hidden">
        <Sparkline values={hist.slice(-40)} width={220} height={32} />
      </div>
    </div>
  );
}

function gpuPercent(snap: MonitorSnapshot | null): number | null {
  const gpu = snap?.gpu;
  if (!gpu) return null;
  if (typeof gpu.percent === 'number') return gpu.percent;
  if (typeof gpu.usagePercent === 'number') return gpu.usagePercent;
  if (typeof gpu.vramUsedMB === 'number' && typeof gpu.vramTotalMB === 'number' && gpu.vramTotalMB > 0) {
    return Math.round((gpu.vramUsedMB / gpu.vramTotalMB) * 100);
  }
  if (typeof gpu.vramUsedMB === 'number') return Math.min(100, gpu.vramUsedMB);
  return null;
}

interface HomeProps {
  onNavigate: (view: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const api = useApi();
  const [snap, setSnap] = React.useState<MonitorSnapshot | null>(null);
  const hist = React.useRef<{ cpu: number[]; gpu: number[]; ram: number[]; disk: number[]; temp: number[] }>({
    cpu: [],
    gpu: [],
    ram: [],
    disk: [],
    temp: [],
  });
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const push = (key: 'cpu' | 'gpu' | 'ram' | 'disk' | 'temp', v: number | null | undefined) => {
    if (!Number.isFinite(v)) return;
    const arr = hist.current[key];
    arr.push(v as number);
    if (arr.length > 40) arr.shift();
  };

  React.useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.monitorSnapshot();
        if (!alive) return;
        setSnap(s);
        push('cpu', s?.cpu);
        const gp = gpuPercent(s);
        push('gpu', gp);
        push('ram', s?.ramPercent);
        push('disk', s?.diskPercent);
        push('temp', s?.tempC);
        force();
      } catch {
        /* silencioso */
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const cpu = snap?.cpu != null ? Math.round(snap.cpu) : '—';
  const gpu = gpuPercent(snap);
  const temp = snap?.tempC != null ? Math.round(snap.tempC) : '—';
  const ramUsed = snap?.ramUsedMB != null ? `${(snap.ramUsedMB / 1024).toFixed(1)} GB usados` : 'Uso atual';

  return (
    <div className="view-appear space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Bem-vindo de volta, Orion.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor e otimize o desempenho do seu sistema em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('optimize')}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Rocket className="h-4 w-4" />
          OTIMIZAÇÃO RÁPIDA
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <LiveCard icon={null} title="CPU" value={String(cpu)} unit="%" desc="Uso atual" hist={hist.current.cpu} />
        <LiveCard
          icon={null}
          title="GPU"
          value={gpu != null ? String(gpu) : '—'}
          unit="%"
          desc={gpu != null ? 'Uso atual' : 'Indisponível'}
          hist={hist.current.gpu}
        />
        <LiveCard icon={null} title="RAM" value={snap?.ramPercent != null ? String(Math.round(snap.ramPercent)) : '—'} unit="%" desc={ramUsed} hist={hist.current.ram} />
        <LiveCard icon={null} title="Disco" value={snap?.diskPercent != null ? String(Math.round(snap.diskPercent)) : '—'} unit="%" desc="Atividade do disco" hist={hist.current.disk} />
        <LiveCard icon={null} title="Temperatura" value={String(temp)} unit="°C" desc={snap?.tempC != null ? 'Sensor ACPI' : 'Sensor indisponível'} hist={hist.current.temp} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recursos do Sistema
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            {(['cpu', 'gpu', 'ram'] as const).map((k) => {
              const values = hist.current[k];
              const last = values.length ? Math.round(values[values.length - 1]) : 0;
              return (
                <div key={k} className="flex items-center gap-4 py-2">
                  <div className="w-10 text-xs font-semibold uppercase text-foreground">{k}</div>
                  <div className="h-11 flex-1 overflow-hidden">
                    <Sparkline values={values.length ? values : [0, 0]} width={300} height={44} />
                  </div>
                  <div className="w-12 text-right text-sm font-medium text-foreground">{last}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informações do Sistema
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Os detalhes completos do hardware estarão disponíveis aqui na versão final do novo painel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}