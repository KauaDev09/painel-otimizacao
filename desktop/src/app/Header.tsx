import React from 'react';
import { User } from 'lucide-react';
import { useApi } from '@/api';
import { viewTitle } from './nav';

interface HeaderProps {
  view: string;
  collapsed: boolean;
  onMenu: () => void;
}

function windowGlyph(kind: 'min' | 'max' | 'restore' | 'close') {
  if (kind === 'min') return <path d="M5 12h14" strokeLinecap="round" />;
  if (kind === 'max') return <rect x="5" y="5" width="14" height="14" rx="2" />;
  if (kind === 'restore')
    return (
      <path d="M9 5h10v10M5 9h10v10H5z" strokeLinecap="round" strokeLinejoin="round" />
    );
  return <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />;
}

export function Header({ view, collapsed, onMenu }: HeaderProps) {
  const api = useApi();
  const title = viewTitle(view);
  const [maximized, setMaximized] = React.useState(false);
  const [plan, setPlan] = React.useState<string>('');

  React.useEffect(() => {
    let alive = true;
    api.windowIsMaximized?.().then((v) => alive && setMaximized(!!v)).catch(() => {});
    api.onWindowMaximized?.((v) => alive && setMaximized(!!v));
    const applyLic = (st: { active?: boolean; plan?: string | null } | null | undefined) => {
      if (!alive) return;
      setPlan(st?.active ? String(st.plan || 'Ativa') : 'Sem licença');
    };
    api.licenseGetState?.().then(applyLic).catch(() => {});
    api.onLicenseChanged?.(applyLic);
    return () => {
      alive = false;
    };
  }, [api]);

  const win = {
    min: () => api.windowMinimize?.(),
    max: () => api.windowMaximize?.(),
    close: () => api.windowClose?.(),
  };

  const controls: { key: 'min' | 'max' | 'close'; icon: React.ReactNode; label: string }[] = [
    { key: 'min', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{windowGlyph('min')}</svg>, label: 'Minimizar' },
    { key: 'max', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{windowGlyph(maximized ? 'restore' : 'max')}</svg>, label: maximized ? 'Restaurar' : 'Maximizar' },
    { key: 'close', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{windowGlyph('close')}</svg>, label: 'Fechar' },
  ];

  return (
    <header className="drag-region relative z-20 flex h-14 shrink-0 items-center justify-between bg-[var(--orion-bg)] px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenu}
          className="no-drag rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
          title="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <nav className="no-drag flex items-center gap-2 text-sm" aria-label="Tela atual">
          <span className="text-[var(--orion-text-secondary)]">Orion</span>
          <span className="text-[var(--orion-text-secondary)]/50">/</span>
          <h1 className="m-0 text-[1.05rem] font-semibold text-[var(--orion-text-primary)]">{title}</h1>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="no-drag inline-flex items-center gap-1.5 rounded-full bg-[var(--orion-surface)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--orion-text-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--orion-icon-default)]" />
          {plan || '…'}
        </span>

        <div className="no-drag flex items-center gap-0.5">
          {controls.map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={win[key]}
              className="orion-win-btn flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-[var(--orion-icon-default)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
              aria-label={label}
            >
              {icon}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="no-drag orion-icon-violet rounded-full p-1.5 transition-colors hover:text-[var(--orion-hover-fg)]"
          aria-label="Perfil"
        >
          <User className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}