import {
  Activity,
  AppWindow,
  Boxes,
  Cpu,
  Gamepad2,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Monitor,
  RotateCcw,
  Settings,
  ShieldCheck,
  Timer,
  WandSparkles,
  Wifi,
} from 'lucide-react';

export interface NavItem {
  view: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'principal',
    items: [{ view: 'home', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'otimização',
    items: [
      { view: 'optimize', label: 'Windows', icon: AppWindow },
      { view: 'gameboost', label: 'Jogos', icon: Gamepad2 },
      { view: 'dashboard', label: 'Sistema', icon: Activity },
      { view: 'maintenance', label: 'Limpeza', icon: WandSparkles },
      { view: 'recs', label: 'BIOS', icon: Cpu },
      { view: 'security', label: 'Segurança', icon: ShieldCheck },
    ],
  },
  {
    title: 'monitoramento',
    items: [
      { view: 'display', label: 'Tela', icon: Monitor },
      { view: 'benchmark', label: 'Benchmark', icon: Gauge },
      { view: 'network', label: 'Rede', icon: Wifi },
    ],
  },
  {
    title: 'ferramentas',
    items: [
      { view: 'startup', label: 'Inicialização', icon: Timer },
      { view: 'processes', label: 'Processos', icon: Boxes },
      { view: 'restore', label: 'Restauração', icon: RotateCcw },
      { view: 'history', label: 'Histórico', icon: History },
    ],
  },
  {
    title: 'configurações',
    items: [
      { view: 'settings', label: 'Configurações', icon: Settings },
      { view: 'activation', label: 'Licença', icon: KeyRound },
      { view: 'support', label: 'Suporte', icon: LifeBuoy },
    ],
  },
];

export function viewTitle(view: string): string {
  for (const section of NAV) {
    const found = section.items.find((i) => i.view === view);
    if (found) return found.label;
  }
  return view;
}