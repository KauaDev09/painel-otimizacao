import React from 'react';
import { Settings, SlidersHorizontal, Activity, Download, ShieldCheck, RefreshCcw, X, Check, Info, ChevronDown } from 'lucide-react';
import { useApi } from '@/api';
import { Switch } from '@/components/ui/switch';

// ---------------------------------------------------------------------------
// Tipos locais (formato do settingsService / updaterService / licenseService)
// ---------------------------------------------------------------------------

interface AppSettings {
  general: { startWithWindows: boolean; minimizeToTray: boolean; notifications: boolean };
  optimization: { createRestorePoint: boolean; confirmChanges: boolean; defaultProfile: string };
  monitoring: { intervalSec: number; metrics?: string[] };
  updates: { autoCheck: boolean };
  privacy?: { syncHistoryWhenLicensed?: boolean };
}

type SettingsPatch = { [section: string]: { [key: string]: unknown } };

interface UpdateInfo {
  version: string;
  url?: string;
  changelog?: string;
  mandatory?: boolean;
  releasedAt?: string | null;
  price?: number | string | null;
  storeUrl?: string | null;
}

interface UpdateCheckResult {
  available: boolean;
  requiresPurchase?: boolean;
  update?: UpdateInfo;
  currentVersion?: string;
}

interface DownloadProgress { percent: number; received: number; total: number }

interface LicenseInfo {
  active: boolean;
  key?: string | null;
  plan?: string | null;
  expiresAt?: string | null;
  daysLeft?: number | null;
  offlineGrace?: boolean;
  reason?: string | null;
  authorizedVersion?: string | null;
}

interface AppMetaInfo { appName?: string; version?: string; officialUrl?: string }

interface LocalApi {
  settingsGet(): Promise<Partial<AppSettings> | null>;
  settingsSet(patch: SettingsPatch): Promise<unknown>;
  updateCheck(): Promise<UpdateCheckResult>;
  updateDownload(url: string): Promise<{ ok?: boolean; filePath?: string } | null>;
  updateInstall(filePath: string): Promise<{ ok?: boolean; code?: string; message?: string } | null>;
  updateCancel(): Promise<unknown>;
  onDownloadProgress(cb: (p: DownloadProgress) => void): void;
  onInstalling(cb: (info: { message?: string }) => void): void;
  onUpdateAvailable(cb: (res: UpdateCheckResult) => void): void;
  getAppMeta(): Promise<AppMetaInfo | undefined>;
  licenseGetState(): Promise<LicenseInfo>;
  openExternal?(url: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constantes / helpers
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  general: { startWithWindows: false, minimizeToTray: true, notifications: true },
  optimization: { createRestorePoint: true, confirmChanges: true, defaultProfile: 'balanced' },
  monitoring: { intervalSec: 2 },
  updates: { autoCheck: true },
};

const PROFILE_OPTIONS = [
  { value: 'safe', label: 'Seguro' },
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'performance', label: 'Desempenho' },
  { value: 'gaming', label: 'Gamer' },
  { value: 'work', label: 'Trabalho' },
  { value: 'laptop', label: 'Notebook' },
];

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 segundo' },
  { value: 2, label: '2 segundos' },
  { value: 5, label: '5 segundos' },
];

function mergeSettings(base: AppSettings, extra: Partial<AppSettings> | null | undefined): AppSettings {
  if (!extra) return base;
  return {
    general: { ...base.general, ...(extra.general || {}) },
    optimization: { ...base.optimization, ...(extra.optimization || {}) },
    monitoring: { ...base.monitoring, ...(extra.monitoring || {}) },
    updates: { ...base.updates, ...(extra.updates || {}) },
    privacy: { ...(base.privacy || {}), ...(extra.privacy || {}) },
  };
}

function fmtPrice(price: number | string | null | undefined): string {
  if (price == null || price === '') return 'R$ 15';
  const n = Number(price);
  return Number.isFinite(n) ? `R$ ${n.toFixed(0)}` : String(price);
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function errMsg(err: unknown, fallback: string): string {
  const m = (err as { message?: string })?.message;
  return m ? String(m) : fallback;
}

type Toast = { kind: 'ok' | 'err' | 'info'; text: string } | null;
type UpdatePhase = 'idle' | 'checking' | 'available' | 'purchase' | 'downloading' | 'installing' | 'uptodate' | 'error';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function Configuracoes({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const api = useApi() as unknown as LocalApi;
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = React.useState(false);
  const [toast, setToast] = React.useState<Toast>(null);
  const [meta, setMeta] = React.useState<AppMetaInfo | null>(null);
  const [lic, setLic] = React.useState<LicenseInfo | null>(null);

  // Atualizações
  const [phase, setPhase] = React.useState<UpdatePhase>('idle');
  const [updateMsg, setUpdateMsg] = React.useState('');
  const [update, setUpdate] = React.useState<UpdateCheckResult | null>(null);
  const [progress, setProgress] = React.useState<DownloadProgress>({ percent: 0, received: 0, total: 0 });
  const [installMsg, setInstallMsg] = React.useState('Instalando atualização...');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api.settingsGet();
        if (alive) setSettings(mergeSettings(DEFAULT_SETTINGS, s));
      } catch {
        if (alive) setToast({ kind: 'err', text: 'Não foi possível carregar as configurações.' });
      }
      if (alive) setLoaded(true);
    })();
    api.getAppMeta?.().then((m) => { if (alive && m) setMeta(m); }).catch(() => {});
    api.licenseGetState?.().then((st) => { if (alive) setLic(st); }).catch(() => {});

    // Listeners do preload não devolvem unsubscribe → protegidos pela flag `alive`.
    try {
      api.onDownloadProgress?.((p) => {
        if (!alive || !p) return;
        setProgress((prev) => ({
          percent: p.percent >= 0 ? p.percent : prev.percent,
          received: p.received ?? prev.received,
          total: p.total > 0 ? p.total : prev.total,
        }));
      });
      api.onInstalling?.((info) => {
        if (!alive) return;
        setPhase('installing');
        setInstallMsg(info?.message || 'Instalando...');
      });
      api.onUpdateAvailable?.((res) => {
        if (!alive || !res?.available) return;
        setUpdate(res);
        setPhase(res.requiresPurchase ? 'purchase' : 'available');
        setUpdateMsg(
          res.requiresPurchase
            ? `Atualização v${res.update?.version} disponível para licença vitalícia (${fmtPrice(res.update?.price)}).`
            : `Nova versão disponível: v${res.update?.version}`
        );
      });
    } catch { /* ok */ }

    return () => { alive = false; };
  }, [api]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------- salvar --------------------
  const save = React.useCallback(
    async (section: keyof AppSettings, key: string, value: boolean | string | number) => {
      const prev = settings;
      setSettings((cur) => ({ ...cur, [section]: { ...((cur[section] || {}) as Record<string, unknown>), [key]: value } }) as AppSettings);
      try {
        await api.settingsSet({ [section]: { [key]: value } });
        setToast({ kind: 'ok', text: 'Configuração salva.' });
      } catch (err) {
        setSettings(prev);
        setToast({ kind: 'err', text: `Não foi possível salvar: ${errMsg(err, 'erro desconhecido')}` });
      }
    },
    [api, settings]
  );

  // -------------------- atualizações --------------------
  const checkUpdates = async () => {
    if (phase === 'checking' || phase === 'downloading' || phase === 'installing') return;
    setPhase('checking');
    setUpdateMsg('Consultando servidor...');
    setUpdate(null);
    try {
      const res = await api.updateCheck();
      if (res?.available && res.requiresPurchase) {
        setUpdate(res);
        setPhase('purchase');
        setUpdateMsg(
          `Atualização v${res.update?.version} disponível para licença vitalícia (${fmtPrice(res.update?.price)}). Compre o pacote na sua conta da loja.`
        );
      } else if (res?.available) {
        setUpdate(res);
        setPhase('available');
        setUpdateMsg(`Nova versão disponível: v${res.update?.version}`);
      } else {
        setPhase('uptodate');
        setUpdateMsg('Você já está na versão mais recente.');
      }
    } catch (err) {
      setPhase('error');
      setUpdateMsg(`Não foi possível verificar agora (${(err as { code?: string })?.code || 'erro de rede'}).`);
    }
  };

  const startDownload = async () => {
    const url = update?.update?.url;
    if (!url) {
      setToast({ kind: 'err', text: 'URL de download não disponível.' });
      return;
    }
    setPhase('downloading');
    setProgress({ percent: 0, received: 0, total: 0 });
    try {
      const result = await api.updateDownload(url);
      if (result?.ok && result.filePath) {
        setPhase('installing');
        setInstallMsg('Instalando atualização...');
        try {
          const inst = await api.updateInstall(result.filePath);
          if (inst && inst.ok === false) {
            setPhase('available');
            setToast({ kind: 'err', text: inst.message || 'Não foi possível aplicar a atualização.' });
          }
          // Se ok === true, o app fecha e reabre automaticamente.
        } catch (err) {
          setPhase('available');
          setToast({ kind: 'err', text: `Erro na instalação: ${errMsg(err, 'erro desconhecido')}` });
        }
      } else {
        setPhase('available');
        setToast({ kind: 'err', text: 'O download não foi concluído.' });
      }
    } catch (err) {
      setPhase('available');
      const m = errMsg(err, '');
      if (m.toLowerCase().includes('cancel')) setToast({ kind: 'info', text: 'Download cancelado.' });
      else setToast({ kind: 'err', text: `Falha ao baixar: ${m || 'erro desconhecido'}` });
    }
  };

  const cancelDownload = async () => {
    try { await api.updateCancel(); } catch { /* ok */ }
    setPhase('available');
    setToast({ kind: 'info', text: 'Download cancelado.' });
  };

  const dismissUpdate = () => {
    setPhase('idle');
    setUpdateMsg('');
  };

  const openStore = () => {
    const url = update?.update?.storeUrl || 'https://orion-store-dun.vercel.app';
    api.openExternal?.(url)?.catch(() => {});
  };

  const currentVersion = update?.currentVersion || meta?.version || null;
  const updateMsgClass =
    phase === 'error' ? 'text-red-400'
      : phase === 'purchase' ? 'text-amber-400'
        : phase === 'available' || phase === 'uptodate' ? 'text-green-400'
          : 'text-muted-foreground';

  const primaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-icon-active)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg bg-[var(--orion-surface)] px-4 py-2 text-sm font-semibold text-[var(--orion-icon-active)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="view-appear space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold text-foreground">Configurações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preferências do aplicativo, otimização, monitoramento e atualizações.</p>
        </div>
        {meta?.version && (
          <span className="rounded-full bg-[var(--orion-surface)] px-3 py-1 text-xs font-semibold text-muted-foreground">
            {meta.appName || 'Orion Optimizer'} · v{meta.version}
          </span>
        )}
      </div>

      {/* Toast inline */}
      {toast && (
        <div
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
            toast.kind === 'err'
              ? 'bg-red-500/10 text-red-300'
              : toast.kind === 'ok'
                ? 'bg-green-500/10 text-green-300'
                : 'bg-[var(--orion-selected-bg)] text-foreground'
          }`}
        >
          {toast.kind === 'ok' ? <Check className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Coluna esquerda */}
        <div className="space-y-5 lg:col-span-2">
          {/* Geral */}
          <Section title="Geral" icon={<Settings className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <ToggleRow
              title="Iniciar com o Windows"
              desc="Abre o aplicativo minimizado ao ligar o computador."
              checked={settings.general.startWithWindows}
              disabled={!loaded}
              onChange={(v) => save('general', 'startWithWindows', v)}
            />
            <ToggleRow
              title="Minimizar para a bandeja"
              desc="Fechar a janela mantém o app ativo na bandeja."
              checked={settings.general.minimizeToTray}
              disabled={!loaded}
              onChange={(v) => save('general', 'minimizeToTray', v)}
            />
            <ToggleRow
              title="Notificações do aplicativo"
              desc="Alertas sobre licença, atualizações e resultados."
              checked={settings.general.notifications}
              disabled={!loaded}
              onChange={(v) => save('general', 'notifications', v)}
              last
            />
          </Section>

          {/* Otimização */}
          <Section title="Otimização" icon={<SlidersHorizontal className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <ToggleRow
              title="Criar ponto de restauração por padrão"
              desc="Marcado automaticamente ao aplicar otimizações."
              checked={settings.optimization.createRestorePoint}
              disabled={!loaded}
              onChange={(v) => save('optimization', 'createRestorePoint', v)}
            />
            <ToggleRow
              title="Pedir confirmação antes de alterações"
              desc="Confirmação extra antes de aplicar qualquer otimização."
              checked={settings.optimization.confirmChanges}
              disabled={!loaded}
              onChange={(v) => save('optimization', 'confirmChanges', v)}
            />
            <SelectRow
              title="Perfil padrão recomendado"
              desc="Perfil pré-selecionado ao abrir a otimização do Windows."
              value={settings.optimization.defaultProfile || 'balanced'}
              options={PROFILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              disabled={!loaded}
              onChange={(v) => save('optimization', 'defaultProfile', v)}
              last
            />
          </Section>

          {/* Monitoramento */}
          <Section title="Monitoramento" icon={<Activity className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <SelectRow
              title="Intervalo de atualização do Monitor"
              desc="Frequência de coleta das métricas em tempo real."
              value={String(settings.monitoring.intervalSec || 2)}
              options={INTERVAL_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              disabled={!loaded}
              onChange={(v) => save('monitoring', 'intervalSec', Number(v))}
              last
            />
          </Section>

          {/* Atualizações */}
          <Section title="Atualizações" icon={<Download className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Versão instalada: <strong className="text-foreground">{currentVersion ? `v${currentVersion}` : '—'}</strong>
              </span>
              {updateMsg && <span className={updateMsgClass}>{updateMsg}</span>}
            </div>
            <ToggleRow
              title="Verificar atualizações automaticamente"
              desc="Consulta o servidor ao iniciar; avisa quando houver nova versão."
              checked={settings.updates.autoCheck}
              disabled={!loaded}
              onChange={(v) => save('updates', 'autoCheck', v)}
              last
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={checkUpdates}
                disabled={phase === 'checking' || phase === 'downloading' || phase === 'installing'}
                className={secondaryBtn}
              >
                <RefreshCcw className={'h-4 w-4 ' + (phase === 'checking' ? 'animate-spin' : '')} />
                {phase === 'checking' ? 'Verificando…' : 'VERIFICAR ATUALIZAÇÕES AGORA'}
              </button>
            </div>

            {/* Painel: atualização disponível */}
            {(phase === 'available' || phase === 'purchase') && update?.update && (
              <div className="mt-4 rounded-lg bg-black/30 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--orion-selected-bg)] px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Instalada: <strong className="text-foreground">v{update.currentVersion || meta?.version || '?'}</strong>
                  </span>
                  <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-green-400">
                    Nova: <strong>v{update.update.version}</strong>
                  </span>
                  {update.update.mandatory && (
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-amber-400">
                      Obrigatória
                    </span>
                  )}
                </div>
                <p className="m-0 whitespace-pre-line text-sm text-foreground">
                  {update.update.changelog || 'Sem changelog disponível.'}
                </p>
                {update.update.releasedAt && (
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Liberada em: {new Date(update.update.releasedAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {phase === 'purchase' ? (
                    <button type="button" onClick={openStore} className={primaryBtn}>
                      <Download className="h-4 w-4" />
                      COMPRAR PACOTE ({fmtPrice(update.update.price)})
                    </button>
                  ) : (
                    <button type="button" onClick={startDownload} className={primaryBtn}>
                      <Download className="h-4 w-4" />
                      BAIXAR ATUALIZAÇÃO
                    </button>
                  )}
                  <button type="button" onClick={dismissUpdate} className={secondaryBtn}>
                    MAIS TARDE
                  </button>
                </div>
              </div>
            )}

            {/* Painel: progresso do download */}
            {phase === 'downloading' && (
              <div className="mt-4 rounded-lg bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
                  <span className="flex-1 text-sm text-foreground">Baixando atualização...</span>
                  <button
                    type="button"
                    onClick={cancelDownload}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    CANCELAR
                  </button>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--orion-selected-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--orion-icon-active)] transition-[width] duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>{progress.percent >= 0 ? `${progress.percent}%` : '…'}</span>
                  <span>{progress.total > 0 ? `${fmtMB(progress.received)} MB / ${fmtMB(progress.total)} MB` : 'Iniciando...'}</span>
                </div>
              </div>
            )}

            {/* Painel: instalando */}
            {phase === 'installing' && (
              <div className="mt-4 rounded-lg bg-black/30 p-4">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--orion-icon-default)] border-t-transparent" />
                  <span className="text-sm text-foreground">{installMsg}</span>
                </div>
                <p className="m-0 mt-2 text-xs text-muted-foreground">O aplicativo será reiniciado automaticamente após a instalação.</p>
              </div>
            )}
          </Section>
        </div>

        {/* Coluna direita */}
        <div className="space-y-5">
          {/* Licença (resumo) */}
          <Section title="Licença" icon={<ShieldCheck className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            {lic === null ? (
              <p className="text-sm text-muted-foreground">Verificando…</p>
            ) : lic.active ? (
              <>
                <InfoRow label="Situação" value={lic.offlineGrace ? 'Ativa (offline)' : 'Ativa'} valueClass="text-green-400" />
                <InfoRow label="Plano" value={(lic.plan || '—').toString().toUpperCase()} />
                <InfoRow label="Key" value={lic.key || '—'} mono />
                <InfoRow
                  label="Válida até"
                  value={lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('pt-BR') : 'Nunca (vitalícia)'}
                  valueClass={lic.daysLeft != null && lic.daysLeft <= 7 ? 'text-amber-400' : undefined}
                />
                {lic.authorizedVersion && <InfoRow label="Versão autorizada" value={`v${lic.authorizedVersion}`} />}
              </>
            ) : lic.key ? (
              <>
                <InfoRow label="Situação" value="Inativa" valueClass="text-red-400" />
                <InfoRow label="Key" value={lic.key} mono />
              </>
            ) : (
              <>
                <InfoRow label="Situação" value="Sem licença" valueClass="text-red-400" />
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma key ativada neste computador.</p>
              </>
            )}
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('activation')} className={`mt-3 w-full justify-center ${secondaryBtn}`}>
                <ShieldCheck className="h-4 w-4" />
                GERENCIAR LICENÇA
              </button>
            )}
          </Section>

          {/* Sobre */}
          <Section title="Sobre o aplicativo" icon={<Info className="h-4 w-4 text-[var(--orion-icon-default)]" />}>
            <InfoRow label="Aplicativo" value={meta?.appName || 'Orion Optimizer'} />
            <InfoRow label="Versão" value={meta?.version ? `v${meta.version}` : '—'} />
            <InfoRow label="Configurações" value="%APPDATA%/orion-optimizer" mono />
            <p className="mt-3 text-xs text-muted-foreground">
              As preferências são salvas localmente e aplicadas imediatamente. Ações com efeito no sistema (iniciar com o Windows) são
              registradas pelo próprio Windows.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

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

function ToggleRow({
  title,
  desc,
  checked,
  disabled,
  onChange,
  last,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? '' : 'border-b border-[var(--orion-selected-bg)]'}`}>
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <p className="m-0 text-sm font-medium text-foreground">{title}</p>
        <p className="m-0 mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[var(--orion-icon-active)] data-[state=unchecked]:bg-[var(--orion-selected-bg)]"
      />
    </div>
  );
}

function SelectRow({
  title,
  desc,
  value,
  options,
  disabled,
  onChange,
  last,
}: {
  title: string;
  desc?: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? '' : 'border-b border-[var(--orion-selected-bg)]'}`}>
      <label htmlFor={id} className="flex-1">
        <p className="m-0 text-sm font-medium text-foreground">{title}</p>
        {desc && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border border-[var(--orion-selected-bg)] bg-black/40 py-1.5 pl-3 pr-8 text-sm text-foreground outline-none transition-colors focus:border-[var(--orion-hover-border)] disabled:opacity-60"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[var(--orion-surface)] text-foreground">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass, mono }: { label: string; value: string; valueClass?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate text-right font-medium ${valueClass || 'text-foreground'} ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
      </span>
    </div>
  );
}
