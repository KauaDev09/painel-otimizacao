export interface LicenseState {
  active: boolean;
  key?: string | null;
  plan?: string | null;
  expiresAt?: string | null;
  blockReason?: string | null;
}

export interface AppMeta {
  appName?: string;
  version?: string;
  officialUrl?: string;
}

export interface MonitorSnapshot {
  ts?: string;
  cpu?: number | null;
  ramPercent?: number | null;
  ramUsedMB?: number | null;
  ramTotalMB?: number | null;
  diskPercent?: number | null;
  netRxKbps?: number | null;
  netTxKbps?: number | null;
  processCount?: number | null;
  tempC?: number | null;
  /** Origem real: acpi | lhm | gpu — null quando indisponível */
  tempSource?: 'acpi' | 'lhm' | 'gpu' | string | null;
  gpu?: {
    percent?: number | null;
    usagePercent?: number | null;
    vramUsedMB?: number | null;
    vramTotalMB?: number | null;
    tempC?: number | null;
    clockMhz?: number | null;
    label?: string;
    vendor?: string | null;
  } | null;
}

export interface OptimizationOperation {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  ts?: number | string;
  icon?: string;
}

/** Contrato da API disponível no renderer (preload no Electron, mock no preview). */
export interface OrionApi {
  getAppMeta(): Promise<AppMeta | undefined>;
  openExternal(url: string): Promise<void>;
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onWindowMaximized(cb: (value: boolean) => void): (() => void) | void;

  licenseGetState(): Promise<LicenseState>;
  licenseActivate(key: string): Promise<{ ok?: boolean }>;
  licenseRefresh(): Promise<LicenseState>;
  licenseLogout(): Promise<{ ok?: boolean }>;
  onLicenseChanged(cb: (state: LicenseState) => void): (() => void) | void;

  analyze(): Promise<{ overall?: number; historyId?: string; scores?: { overall: number } }>;
  getLast(): Promise<AnalysisResultLike>;
  onServiceStep(cb: (step: unknown) => void): void;
  monitorSnapshot(): Promise<MonitorSnapshot>;
  engineListOperations(): Promise<OptimizationOperation[]>;
  displayMonitors(): Promise<unknown>;
  displayBrightnessGet(): Promise<{ supported: boolean; percent: number | null }>;
  displayBrightnessSet(percent: number): Promise<{ applied: boolean; percent?: number }>;
  displayScreenRamp(opts: {
    saturation?: number;
    contrast?: number;
    brightness?: number;
    gamma?: number;
    temperature?: number;
    monitorId?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    forceDdc?: boolean;
  }): Promise<{ applied: boolean; overlay?: boolean; brightnessMode?: string }>;

  // ---- Jogos (Game Boost) ----
  gameBoostListGames(): Promise<GameEntry[]>;
  gameBoostAddGame(payload: {
    path: string;
    name?: string;
    launch?: string | null;
    platform?: string;
    artworkPath?: string | null;
  }): Promise<GameEntry>;
  gameBoostRemoveGame(id: string): Promise<{ ok: boolean }>;
  gameBoostSessionStatus(): Promise<GameSessionStatus>;
  gameBoostStartSession(id: string): Promise<GameStartResult>;
  gameBoostStopSession(): Promise<{ ok: boolean; message?: string }>;
  gameBoostPickExe(): Promise<string | null>;
  gameBoostGetIcon(exePath: string): Promise<{ ok?: boolean; dataUrl?: string | null }>;
  gameBoostListLibrary(): Promise<GameEntry[]>;
  gameBoostGetArtwork(artworkPath: string): Promise<{ ok?: boolean; dataUrl?: string | null }>;
  gameBoostAnalyze(): Promise<unknown>;
  onGameBoostSession(cb: (payload: GameSessionEvent) => void): (() => void) | void;

  // ---- Tela (display) ----
  settingsGet(): Promise<SettingsLike>;
  settingsSet(patch: unknown): Promise<unknown>;

  [method: string]: unknown;
}

export interface GameEntry {
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

export interface GameSessionStatus {
  running?: boolean;
  pending?: boolean;
  session?: { running?: boolean; pid?: number; processName?: string; gameName?: string } | null;
}

export interface GameStartResult {
  ok?: boolean;
  pending?: boolean;
  gameName?: string;
  message?: string;
  error?: string;
}

export interface GameSessionEvent {
  state?: string;
  message?: string;
}

// Representação aproximada do perfil/resultado de análise (dados reais do backend).
export interface AnalysisResultLike {
  profile?: Record<string, unknown>;
  scores?: { overall?: number; categories?: Record<string, { percent?: number }> };
  counts?: { critical?: number; recommended?: number; optional?: number };
  recommendations?: unknown[];
}

export interface SettingsLike {
  display?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    gamma?: number;
    temperature?: number;
    selectedMonitorId?: string | null;
    perMonitor?: Record<string, Partial<DisplayStateLike>>;
    presets?: Record<string, Partial<DisplayStateLike>>;
  };
}

export interface DisplayStateLike {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  temperature?: number;
}