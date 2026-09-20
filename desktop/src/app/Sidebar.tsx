import React from 'react';
import { cn } from '@/lib/utils';
import { NAV } from './nav';
import logoUrl from '../ui/assets/s4-icon.png';
import logoFullUrl from '../ui/assets/s4-logo-horizontal-dark.png';

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
        's4-rail flex shrink-0 flex-col border-r border-[var(--s4-glass-border)] transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div
        className={cn(
          'drag-region flex items-center gap-3 px-4 py-5',
          collapsed && 'justify-center px-2'
        )}
      >
        {collapsed ? (
          <img src={logoUrl} alt="SevenOptimizer" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        ) : (
          <img
            src={logoFullUrl}
            alt="SevenOptimizer"
            className="h-8 w-auto max-w-[168px] object-contain"
          />
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
                    's4-nav-item mb-0.5 flex w-full items-center gap-3 rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none',
                    active
                      ? 'bg-[var(--s4-selected-bg)] text-[var(--s4-text-primary)]'
                      : 'bg-transparent text-[var(--s4-text-secondary)] hover:bg-[rgba(255,59,63,0.08)] hover:text-[var(--s4-hover-fg)]',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active ? 's4-icon-active' : 's4-icon-accent'
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
              className="rounded-md p-1 text-[var(--s4-text-secondary)] transition-colors hover:bg-[var(--s4-selected-bg)] hover:text-[var(--s4-hover-fg)]"
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
            className="mx-auto block rounded-md p-1.5 text-[var(--s4-text-secondary)] transition-colors hover:bg-[var(--s4-selected-bg)] hover:text-[var(--s4-hover-fg)]"
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