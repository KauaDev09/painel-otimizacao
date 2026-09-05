import React from 'react';
import { cn } from '@/lib/utils';
import { NAV } from './nav';
import logoUrl from '../ui/assets/logo.jpeg';

interface SidebarProps {
  view: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  version: string;
}

export function Sidebar({ view, onNavigate, collapsed, onToggle, version }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-[var(--orion-bg)] transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div
        className={cn(
          'drag-region flex items-center gap-3 px-4 py-5',
          collapsed && 'justify-center px-2'
        )}
      >
        <img src={logoUrl} alt="Orion" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        {!collapsed && (
          <div className="leading-none">
            <div className="text-sm font-bold tracking-[0.16em] text-foreground">ORION</div>
            <div className="mt-1 text-[0.62rem] font-semibold tracking-[0.32em] text-muted-foreground">
              OPTIMIZER
            </div>
          </div>
        )}
      </div>

      <nav className="no-drag flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const active = view === item.view;
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  type="button"
                  title={collapsed ? item.label : undefined}
                  onClick={() => onNavigate(item.view)}
                  className={cn(
                    'mb-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--orion-selected-bg)] text-[var(--orion-text-primary)]'
                      : 'text-[var(--orion-text-secondary)] hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active ? 'orion-icon-active' : 'orion-icon-violet'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="no-drag px-4 py-3">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] text-muted-foreground">{version}</span>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-md p-1 text-[var(--orion-text-secondary)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
              title="Recolher menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="mx-auto block rounded-md p-1.5 text-[var(--orion-text-secondary)] transition-colors hover:bg-[var(--orion-selected-bg)] hover:text-[var(--orion-hover-fg)]"
            title="Expandir menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}