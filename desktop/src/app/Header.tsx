import React from 'react';
import { Minus, Square, User, X } from 'lucide-react';
import { useApi } from '@/api';
import { viewTitle } from './nav';

interface HeaderProps {
  view: string;
  collapsed: boolean;
  onMenu: () => void;
}

function windowGlyph(icon: 'min' | 'max' | 'close') {
  if (icon === 'min')
    return <path d="M5 12h14" strokeLinecap="round" />;
  if (icon === 'max')
    return <rect x="5" y="5" width="14" height="14" rx="2" />;
  return <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />;
}

export function Header({ view, collapsed, onMenu }: HeaderProps) {
  const api = useApi();
  const title = viewTitle(view);

  const win = {
    min: () => api.windowMinimize?.(),
    max: () => api.windowMaximize?.(),
    close: () => api.windowClose?.(),
  };

  return (
    <header className="drag-region relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenu}
          className="no-drag rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <nav className="no-drag flex items-center gap-2 text-sm" aria-label="Tela atual">
          <span className="text-muted-foreground">Orion</span>
          <span className="text-muted-foreground/50">/</span>
          <h1 className="m-0 text-[1.05rem] font-semibold text-foreground">{title}</h1>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="no-drag inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Pro
        </span>

        <div className="no-drag flex items-center gap-0.5 border-l border-border pl-2">
          {(
            [
              ['min', Minus] as const,
              ['max', Square] as const,
              ['close', X] as const,
            ]
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={win[key]}
              className={
                'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors ' +
                (key === 'close'
                  ? 'hover:bg-destructive/15 hover:text-destructive'
                  : 'hover:bg-muted hover:text-foreground')
              }
              aria-label={key === 'min' ? 'Minimizar' : key === 'max' ? 'Maximizar' : 'Fechar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {windowGlyph(key)}
              </svg>
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