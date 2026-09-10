import React from 'react';
import { Monitor as MonitorIcon, RotateCcw, Save } from 'lucide-react';
import { useApi } from '@/api';
import { Slider } from '@/components/ui/slider';

const PRESET_NAMES = ['Padrão', 'Gamer', 'FPS', 'Competitivo', 'Filme'] as const;

interface MonitorInfo {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  refreshRate?: number;
  connected?: boolean;
  isPrimary?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}

interface DisplayState {
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  temperature: number;
}

const DEFAULTS: DisplayState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  gamma: 100,
  temperature: 100,
};

const BUILTIN_PRESETS: Record<string, DisplayState> = {
  Padrão: { ...DEFAULTS },
  Gamer: { brightness: 110, contrast: 118, saturation: 125, gamma: 95, temperature: 110 },
  FPS: { brightness: 120, contrast: 128, saturation: 112, gamma: 88, temperature: 125 },
  Competitivo: { brightness: 128, contrast: 135, saturation: 108, gamma: 82, temperature: 135 },
  Filme: { brightness: 90, contrast: 108, saturation: 118, gamma: 112, temperature: 72 },
};

function kelvinOf(temp: number): number {
  return Math.round(4000 + (temp / 100) * 2500);
}

function formatValue(key: keyof DisplayState, value: number): string {
  if (key === 'gamma') return (value / 100).toFixed(2);
  if (key === 'temperature') return `${kelvinOf(value)} K`;
  return `${Math.round(value)}%`;
}

export function Tela({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi();
  const [monitors, setMonitors] = React.useState<MonitorInfo[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<DisplayState>(DEFAULTS);
  const [perMonitor, setPerMonitor] = React.useState<Record<string, DisplayState>>({});
  const [presets, setPresets] = React.useState<Record<string, Partial<DisplayState>>>({});
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>('Padrão');
  const [busy, setBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [applyHint, setApplyHint] = React.useState<string | null>(null);
  const lastApplied = React.useRef(0);
  const applyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = React.useRef<DisplayState>(DEFAULTS);
  const valuesRef = React.useRef<DisplayState>(DEFAULTS);
  const selectedRef = React.useRef<string | null>(null);
  const perMonitorRef = React.useRef<Record<string, DisplayState>>({});

  React.useEffect(() => {
    let alive = true;
    const init = async () => {
      let loadedPer: Record<string, DisplayState> = {};
      let loadedSelected: string | null = null;
      try {
        const s = (await api.settingsGet?.()) as {
          display?: Partial<DisplayState> & {
            presets?: Record<string, Partial<DisplayState>>;
            selectedMonitorId?: string;
            perMonitor?: Record<string, Partial<DisplayState>>;
          };
        } | null;
        if (alive && s?.display) {
          const d = s.display;
          const next = {
            brightness: d.brightness ?? DEFAULTS.brightness,
            contrast: d.contrast ?? DEFAULTS.contrast,
            saturation: d.saturation ?? DEFAULTS.saturation,
            gamma: d.gamma ?? DEFAULTS.gamma,
            temperature: d.temperature ?? DEFAULTS.temperature,
          };
          setValues(next);
          valuesRef.current = next;
          pendingRef.current = next;
          if (d.presets) setPresets(d.presets);
          if (d.perMonitor) {
            loadedPer = Object.fromEntries(
              Object.entries(d.perMonitor).map(([id, v]) => [id, { ...DEFAULTS, ...v }])
            );
            setPerMonitor(loadedPer);
            perMonitorRef.current = loadedPer;
          }
          loadedSelected = d.selectedMonitorId || null;
        }
      } catch { /* ok */ }

      try {
        const mon = (await api.displayMonitors?.()) as { monitors?: MonitorInfo[] } | null;
        if (alive && mon?.monitors) {
          const list = mon.monitors.filter((m) => m.connected !== false);
          setMonitors(list);
          const pick = list.find((m) => m.id === loadedSelected)
            || list.find((m) => m.isPrimary)
            || list[0]
            || null;
          const id = pick?.id || null;
          setSelectedId(id);
          selectedRef.current = id;
          if (id && loadedPer[id]) {
            setValues(loadedPer[id]);
            valuesRef.current = loadedPer[id];
            pendingRef.current = loadedPer[id];
          }
        }
      } catch { /* ok */ }
    };
    init();
    return () => {
      alive = false;
      if (applyTimer.current) clearTimeout(applyTimer.current);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [api]);

  const persist = React.useCallback((next: DisplayState, monitorId: string | null, map: Record<string, DisplayState>) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      api.settingsSet?.({
        display: {
          ...next,
          selectedMonitorId: monitorId,
          perMonitor: map,
        },
      }).catch(() => {});
    }, 900);
  }, [api]);

  const applyValues = React.useCallback(async (next: DisplayState, forceDdc = false) => {
    valuesRef.current = next;
    setValues(next);
    const monitor = monitors.find((m) => m.id === selectedRef.current) || monitors.find((m) => m.isPrimary) || monitors[0];
    try {
      const res = await api.displayScreenRamp?.({
        brightness: next.brightness,
        contrast: next.contrast,
        saturation: next.saturation,
        gamma: next.gamma,
        temperature: next.temperature,
        monitorId: monitor?.id,
        bounds: monitor?.bounds,
        forceDdc,
      }) as { applied?: boolean; method?: string; ddc?: boolean; gamma?: boolean } | null;
      if (res?.applied) {
        const via = res.ddc ? 'monitor (DDC) + gama' : res.gamma || res.method === 'gamma-ramp' ? 'curva de gama' : (res.method || 'sistema');
        setApplyHint(`Aplicado via ${via}`);
      } else if (res) {
        setApplyHint('Ajuste enviado — alguns monitores limitam DDC/CI');
      }
    } catch { /* ok */ }
  }, [api, monitors]);

  const throttledApply = React.useCallback((next: DisplayState) => {
    pendingRef.current = next;
    valuesRef.current = next;
    setValues(next);
    if (selectedRef.current) {
      const map = { ...perMonitorRef.current, [selectedRef.current]: next };
      perMonitorRef.current = map;
      setPerMonitor(map);
      persist(next, selectedRef.current, map);
    }
    const flush = () => {
      applyTimer.current = null;
      lastApplied.current = Date.now();
      applyValues(pendingRef.current);
    };
    const now = Date.now();
    if (now - lastApplied.current >= 160) {
      flush();
    } else if (!applyTimer.current) {
      applyTimer.current = setTimeout(flush, 160);
    }
  }, [applyValues, persist]);

  const handleChange = (key: keyof DisplayState, val: number) => {
    throttledApply({ ...valuesRef.current, [key]: Math.round(val) });
    setSelectedPreset(null);
  };

  const resetAll = async () => {
    setBusy(true);
    setSelectedPreset('Padrão');
    // Só gamma ramp (software). Nunca reescrever OSD do monitor no REDEFINIR.
    await applyValues(DEFAULTS, false);
    if (selectedRef.current) {
      const map = { ...perMonitorRef.current, [selectedRef.current]: DEFAULTS };
      perMonitorRef.current = map;
      setPerMonitor(map);
      persist(DEFAULTS, selectedRef.current, map);
    }
    setBusy(false);
  };

  const savePreset = async () => {
    const name = window.prompt('Nome do perfil:', selectedPreset || '');
    if (!name) return;
    const next = { ...presets, [name]: { ...values } };
    setPresets(next);
    setSelectedPreset(name);
    try { await api.settingsSet?.({ display: { presets: next } }); } catch { /* ok */ }
    setSaveMsg(`Perfil "${name}" salvo.`);
    setTimeout(() => setSaveMsg(null), 2000);
  };

  const restorePreset = async (name: string) => {
    const p = { ...(BUILTIN_PRESETS[name] || DEFAULTS), ...(presets[name] || {}) };
    const next: DisplayState = {
      brightness: p.brightness ?? 100,
      contrast: p.contrast ?? 100,
      saturation: p.saturation ?? 100,
      gamma: p.gamma ?? 100,
      temperature: p.temperature ?? 100,
    };
    setSelectedPreset(name);
    // Presets usam só a curva de gama (reversível). Não alteram o OSD do monitor.
    await applyValues(next, false);
    if (selectedRef.current) {
      const map = { ...perMonitorRef.current, [selectedRef.current]: next };
      perMonitorRef.current = map;
      setPerMonitor(map);
      persist(next, selectedRef.current, map);
    }
  };

  const selectMonitor = (id: string) => {
    if (id === selectedRef.current) return;
    selectedRef.current = id;
    setSelectedId(id);
    const stored = perMonitorRef.current[id] || DEFAULTS;
    valuesRef.current = stored;
    pendingRef.current = stored;
    setValues(stored);
    setSelectedPreset(null);
    applyValues(stored, false);
    persist(stored, id, perMonitorRef.current);
  };

  const selected = monitors.find((m) => m.id === selectedId) || monitors.find((m) => m.isPrimary) || monitors[0];

  return (
    <div className="view-appear space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Tela</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustes de brilho, cor e gama via software (curva de gama). Não altera as configurações salvas no monitor.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          REDEFINIR
        </button>
      </div>

      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <MonitorIcon className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Telas ({monitors.length || 1})
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {(monitors.length ? monitors : [{ id: 'default', name: 'Monitor padrão', connected: true, isPrimary: true }]).map((m, i) => {
            const active = (m.id || String(i)) === (selected?.id || selectedId);
            const res = m.width && m.height ? `${m.width}×${m.height}` : '';
            const hz = m.refreshRate ? `${Math.round(m.refreshRate)} Hz` : '';
            return (
              <button
                key={m.id || i}
                type="button"
                onClick={() => m.id && selectMonitor(m.id)}
                className={`min-w-[140px] flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                  active
                    ? 'border-[var(--orion-icon-active)] bg-[var(--orion-selected-bg)]'
                    : 'border-white/10 bg-black/30 hover:border-white/25'
                }`}
              >
                <div className="mb-2 flex h-14 items-center justify-center rounded bg-black/40 text-lg font-bold text-foreground">
                  {i + 1}{m.isPrimary ? <span className="ml-1 text-xs text-[var(--orion-icon-active)]">*</span> : null}
                </div>
                <p className="truncate text-sm font-medium text-foreground">{m.name || `Monitor ${i + 1}`}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {res}{hz ? ` · ${hz}` : ''}{m.isPrimary ? ' · Primário' : ''}
                </p>
              </button>
            );
          })}
        </div>
        {selected && (
          <p className="mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Controle ativo em {selected.name || 'monitor selecionado'}
            </span>
            {applyHint && <span className="text-[var(--orion-icon-active)]">{applyHint}</span>}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <ControlSlider label="Brilho" value={values.brightness} display={formatValue('brightness', values.brightness)} onChange={(v) => handleChange('brightness', v)} />
        <ControlSlider label="Contraste" value={values.contrast} display={formatValue('contrast', values.contrast)} onChange={(v) => handleChange('contrast', v)} />
        <ControlSlider label="Saturação" value={values.saturation} display={formatValue('saturation', values.saturation)} onChange={(v) => handleChange('saturation', v)} />
        <ControlSlider label="Gama" value={values.gamma} min={50} max={200} display={formatValue('gamma', values.gamma)} onChange={(v) => handleChange('gamma', v)} />
        <ControlSlider label="Temperatura de Cor" value={values.temperature} display={formatValue('temperature', values.temperature)} onChange={(v) => handleChange('temperature', v)} />
      </div>

      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Perfil</span>
          <button
            type="button"
            onClick={savePreset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--orion-icon-active)] transition-colors hover:text-[var(--orion-hover-fg)]"
          >
            <Save className="h-3.5 w-3.5" />
            SALVAR PERFIL
          </button>
        </div>
        {saveMsg && <p className="mb-2 text-xs text-green-400">{saveMsg}</p>}
        <div className="flex flex-wrap gap-2">
          {PRESET_NAMES.map((name) => {
            const isActive = selectedPreset === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => restorePreset(name)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--orion-icon-active)] text-black'
                    : 'bg-black/40 text-muted-foreground hover:bg-[var(--orion-selected-bg)] hover:text-foreground'
                }`}
              >
                {name}
              </button>
            );
          })}
          {Object.keys(presets).filter((n) => !PRESET_NAMES.includes(n as typeof PRESET_NAMES[number])).map((name) => {
            const isActive = selectedPreset === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => restorePreset(name)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--orion-icon-active)] text-black'
                    : 'bg-black/40 text-muted-foreground hover:bg-[var(--orion-selected-bg)] hover:text-foreground'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ControlSlider({ label, value, display, onChange, min = 0, max = 200 }: {
  label: string;
  value: number;
  display: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}
