import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Home } from '@/views/Home';
import { Sistema } from '@/views/Sistema';
import { Jogos } from '@/views/Jogos';
import { Tela } from '@/views/Tela';
import { ComingSoon } from '@/views/ComingSoon';
import { OrionReactiveCore } from '@/components/orion-reactive-core';
import { useApi } from '@/api';

const MIGRATED_VIEWS: Record<string, React.ComponentType<{ onNavigate: (view: string) => void }>> = {
  home: Home,
  dashboard: Sistema,
  gameboost: Jogos,
  display: Tela,
};

export function Shell() {
  const api = useApi();
  const [view, setView] = React.useState('home');
  const [collapsed, setCollapsed] = React.useState(false);
  const [version, setVersion] = React.useState('v2.0.7');

  React.useEffect(() => {
    api
      .getAppMeta?.()
      .then((meta) => {
        if (meta?.version) setVersion(`v${meta.version}`);
      })
      .catch(() => {});
  }, [api]);

  const Content = MIGRATED_VIEWS[view] ?? ComingSoon;
  const props = { onNavigate: setView };

  return (
    <div className="relative isolate flex h-full overflow-hidden bg-background">
      {/* Núcleo reativo compacto atrás de todo o conteúdo do painel (§9/§10). */}
      <OrionReactiveCore compact className="absolute inset-0 z-0" />
      <div className="relative z-10 flex h-full min-w-0 flex-1 overflow-hidden">
        <Sidebar
          view={view}
          onNavigate={setView}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          version={version}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header view={view} collapsed={collapsed} onMenu={() => setCollapsed((c) => !c)} />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full p-6">
              <Content {...props} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}