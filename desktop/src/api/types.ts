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
  gpu?: {
    percent?: number | null;
    usagePercent?: number | null;
    vramUsedMB?: number | null;
    vramTotalMB?: number | null;
    tempC?: number | null;
    label?: string;
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

  licenseGetState(): Promise<LicenseState>;
  licenseActivate(key: string): Promise<{ ok?: boolean }>;
  licenseRefresh(): Promise<LicenseState>;
  licenseLogout(): Promise<{ ok?: boolean }>;
  onLicenseChanged(cb: (state: LicenseState) => void): void;

  analyze(): Promise<{ overall: number; scores: { overall: number } }>;
  getLast(): Promise<unknown>;
  monitorSnapshot(): Promise<MonitorSnapshot>;
  engineListOperations(): Promise<OptimizationOperation[]>;
  displayMonitors(): Promise<unknown>;
  displayBrightnessGet(): Promise<{ supported: boolean; percent: number | null }>;
  displayBrightnessSet(percent: number): Promise<{ applied: boolean; percent?: number }>;
  displayScreenRamp(opts: {
    saturation?: number;
    contrast?: number;
    brightness?: number;
  }): Promise<{ applied: boolean; overlay?: boolean; brightnessMode?: string }>;

  [method: string]: unknown;
}