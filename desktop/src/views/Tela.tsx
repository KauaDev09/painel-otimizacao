import React from 'react';
import { Monitor as MonitorIcon, RotateCcw, Save } from 'lucide-react';
import { useApi } from '@/api';
import { Slider } from '@/components/ui/slider';

const PRESET_NAMES = ['Padrão', 'Gamer', 'FPS', 'Competitivo', 'Filme'] as const;

interface MonitorInfo {
  name?: string;
  width?: number;
  height?: number;
  refreshRate?: number;
  connected?: boolean;
  isPrimary?: boolean;
}

interface DisplayState {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface MethodInfo {
  brightnessMethod: string;
  contrastMethod: string;
  saturationMethod: string;
}

function methodLabel(m: string | undefined): string {
  if (m === 'gamma' || m === 'gamma-ramp') return 'GPU';
  if (m === 'overlay') return 'Sistema (overlay)';
  if (m === 'blocked') return 'Sem suporte';
  if (m === 'wmi') return 'Hardware';
  if (m === 'none') return 'Sistema';
  return m || '—';
}

const DEFAULTS: DisplayState = { brightness: 100, contrast: 100, saturation: 100 };

export function Tela({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi();
  const [monitors, setMonitors] = React.useState<MonitorInfo[]>([]);
  const [values, setValues] = React.useState<DisplayState>(DEFAULTS);
  const [methods, setMethods] = React.useState<MethodInfo>({ brightnessMethod: '', contrastMethod: '', saturationMethod: '' });
  const [presets, setPresets] = React.useState<Record<string, Partial<DisplayState>>>({});
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const lastApplied = React.useRef(Date.now());
  const applyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const mon = (await api.displayMonitors?.()) as { monitors?: MonitorInfo[] } | null;
        if (alive && mon?.monitors) setMonitors(mon.monitors.filter((m) => m.connected));
      } catch { /* ok */ }

      try {
        const bri = (await api.displayBrightnessGet?.()) as { supported?: boolean; percent?: number | null } | null;
        if (alive && bri?.supported && bri.percent != null) {
          setValues((v) => ({ ...v, brightness: bri.percent! }));
        }
      } catch { /* ok */ }

      try {
        const s = (await api.settingsGet?.()) as { display?: Partial<DisplayState> & { presets?: Record<string, Partial<DisplayState>> } } | null;
        if (alive && s?.display) {
          const d = s.display;
          setValues((v) => ({
            brightness: d.brightness ?? v.brightness,
            contrast: d.contrast ?? v.contrast,
            saturation: d.saturation ?? v.saturation,
          }));
          if (d.presets) setPresets(d.presets);
        }
      } catch { /* ok */ }
    };
    init();
    return () => { alive = false; };
  }, [api]);

  const applyValues = React.useCallback(async (next: DisplayState) => {
    try {
      const res = (await api.displayScreenRamp?.({
        brightness: next.brightness,
        contrast: next.contrast,
        saturation: next.saturation,
      })) as {
        brightnessMode?: string;
        saturationMode?: string;
        contrastMode?: string;
      } | null;
      if (res) {
        setMethods({
          brightnessMethod: res.brightnessMode || '',
          contrastMethod: res.contrastMode || '',
          saturationMethod: res.saturationMode || '',
        });
      }
    } catch { /* ok */ }
  }, [api]);

  const throttledApply = React.useCallback((next: DisplayState) => {
    setValues(next);
    const now = Date.now();
    if (now - lastApplied.current >= 120) {
      lastApplied.current = now;
      applyValues(next);
    } else if (!applyTimer.current) {
      applyTimer.current = setTimeout(() => {
        applyTimer.current = null;
        lastApplied.current = Date.now();
        applyValues(next);
      }, 120);
    }
  }, [applyValues]);

  const handleChange = (key: keyof DisplayState, val: number[]) => {
    const v = Math.round(val[0]);
    throttledApply({ ...values, [key]: v });
    setSelectedPreset(null);
  };

  const resetAll = async () => {
    setBusy(true);
    setSelectedPreset('Padrão');
    await applyValues(DEFAULTS);
    try {
      await api.settingsSet?.({ display: { brightness: DEFAULTS.brightness, contrast: DEFAULTS.contrast, saturation: DEFAULTS.saturation } });
    } catch { /* ok */ }
    setBusy(false);
  };

  const savePreset = async () => {
    const name = window.prompt('Nome do perfil:', selectedPreset || '');
    if (!name) return;
    const next = { ...presets, [name]: { brightness: values.brightness, contrast: values.contrast, saturation: values.saturation } };
    setPresets(next);
    setSelectedPreset(name);
    try { await api.settingsSet?.({ display: { presets: next } }); } catch { /* ok */ }
    setSaveMsg(`Perfil "${name}" salvo.`);
    setTimeout(() => setSaveMsg(null), 2000);
  };

  const restorePreset = async (name: string) => {
    const p = presets[name];
    if (!p) return;
    const next: DisplayState = {
      brightness: p.brightness ?? 100,
      contrast: p.contrast ?? 100,
      saturation: p.saturation ?? 100,
    };
    setSelectedPreset(name);
    await applyValues(next);
  };

  const primary = monitors[0];
  const resLabel = primary?.width && primary?.height ? `${primary.width}×${primary.height}` : 'N/D';
  const hzLabel = primary?.refreshRate ? `${primary.refreshRate} Hz` : '';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Tela</h2>
          <p className="mt-1 text-sm text-muted-foreground">Controle avançado do seu monitor.</p>
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

      {/* Monitor */}
      <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <MonitorIcon className="h-4 w-4 text-[var(--orion-icon-default)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Monitor Principal</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <span className="text-foreground">{primary?.name || 'Monitor padrão'}</span>
          <span>{resLabel}{hzLabel ? ` · ${hzLabel}` : ''}</span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Conectado
          </span>
        </div>
      </div>

      {/* Controles */}
      <div className="space-y-5">
        <ControlSlider
          label="Brilho"
          value={values.brightness}
          method={methods.brightnessMethod}
          onChange={(v) => handleChange('brightness', [v])}
        />
        <ControlSlider
          label="Contraste"
          value={values.contrast}
          method={methods.contrastMethod}
          onChange={(v) => handleChange('contrast', [v])}
        />
        <ControlSlider
          label="Saturação"
          value={values.saturation}
          method={methods.saturationMethod}
          onChange={(v) => handleChange('saturation', [v])}
        />
        <ControlSlider
          label="Gama"
          value={null}
          method=""
          disabled
          note="Não suportado neste sistema"
        />
        <ControlSlider
          label="Temperatura de Cor"
          value={null}
          method=""
          disabled
          note="Não suportado neste sistema"
        />
      </div>

      {/* Perfis */}
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

function ControlSlider({ label, value, method, onChange, disabled, note }: {
  label: string;
  value: number | null;
  method: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--orion-surface)] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {method && <span className="rounded bg-black/40 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">{methodLabel(method)}</span>}
          {note && <span className="text-xs text-muted-foreground/70">{note}</span>}
        </div>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {disabled ? '—' : `${value ?? 100}%`}
        </span>
      </div>
      {disabled ? (
        <div className="h-6 w-full rounded-full bg-black/30" />
      ) : (
        <Slider
          value={[value ?? 100]}
          min={0}
          max={200}
          step={1}
          onValueChange={onChange ? ([v]) => onChange(v) : undefined}
          className="w-full"
        />
      )}
    </div>
  );
}