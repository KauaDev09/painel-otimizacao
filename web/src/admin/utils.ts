export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function fmtDate(d: unknown): string {
  return d ? new Date(String(d)).toLocaleString('pt-BR') : '—';
}

export function daysLeft(exp: unknown): number | null {
  if (!exp) return null;
  return Math.ceil((new Date(String(exp)).getTime() - Date.now()) / 86400000);
}

export const FEAT_NAMES: Record<string, string> = {
  system_monitoring: 'Monitoramento do sistema',
  basic_cleanup: 'Limpeza essencial',
  advanced_cleanup: 'Limpeza avançada',
  fps_boost: 'FPS Boost',
  basic_fps_boost: 'FPS Boost essencial',
  gaming_mode: 'Modo gamer',
  process_optimizer: 'Otimizador de processos',
  startup_optimizer: 'Otimizador de inicialização',
  bios_optimizer: 'Otimizador de BIOS',
  xmp_optimizer: 'Otimizador XMP',
  advanced_memory_optimizer: 'Memória avançada',
  advanced_windows_optimizer: 'Windows avançado',
  realtime_telemetry: 'Telemetria em tempo real',
  priority_features: 'Recursos prioritários',
};

export function featLabel(f: string): string {
  return FEAT_NAMES[f] || String(f).replace(/_/g, ' ');
}

export function parseFeats(v: string): string[] {
  return String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const ORDER_STATUS: Record<string, string> = {
  pending: 'badge-pendente',
  paid: 'badge-ativa',
  cancelled: 'badge-inativa',
  failed: 'badge-bloqueada',
};

export const MASCOT = {
  loading: '/admin/mascot-thinking.png',
  empty: '/admin/mascot-seated.png',
  error: '/admin/mascot-support.jpg',
  success: '/admin/mascot-excited.jpg',
  hero: '/admin/mascot-pointing.jpg',
  present: '/admin/mascot-presenting.jpg',
} as const;

export type MascotType = keyof typeof MASCOT;

export function planLabel(l: { plan_slug?: string; plano?: string }): string {
  const slug = String(l.plan_slug || l.plano || '').trim();
  if (!slug) return '—';
  return slug.toUpperCase();
}

export type MsgKind = '' | 'err' | 'ok';

export function msgClass(kind: MsgKind): string {
  return kind ? `msg ${kind}` : 'msg';
}

export function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(String(raw || '[]')) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function rawHtml(html: string): { __html: string } {
  return { __html: html };
}
