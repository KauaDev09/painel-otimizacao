import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Home } from '@/views/Home';
import { Sistema } from '@/views/Sistema';
import { Jogos } from '@/views/Jogos';
import { Tela } from '@/views/Tela';
import { Windows } from '@/views/Windows';
import { Limpeza } from '@/views/Limpeza';
import { Bios } from '@/views/Bios';
import { Seguranca } from '@/views/Seguranca';
import { Benchmark } from '@/views/Benchmark';
import { Rede } from '@/views/Rede';
import { Inicializacao } from '@/views/Inicializacao';
import { Processos } from '@/views/Processos';
import { Restauracao } from '@/views/Restauracao';
import { Historico } from '@/views/Historico';
import { Configuracoes } from '@/views/Configuracoes';
import { Licenca } from '@/views/Licenca';
import { Suporte } from '@/views/Suporte';
import { ComingSoon } from '@/views/ComingSoon';
import { OrionReactiveCore } from '@/components/orion-reactive-core';
import { useApi } from '@/api';

class ViewErrorBoundary extends React.Component<
  { view: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { view: string }) {
    if (prev.view !== this.props.view && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="view-appear rounded-lg bg-[var(--orion-surface)] p-8">
          <h2 className="m-0 text-lg font-semibold text-foreground">Não foi possível abrir esta tela</h2>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MIGRATED_VIEWS: Record<string, React.ComponentType<{ onNavigate: (view: string) => void }>> = {
  home: Home,
  dashboard: Sistema,
  gameboost: Jogos,
  display: Tela,
  optimize: Windows,
  maintenance: Limpeza,
  recs: Bios,
  security: Seguranca,
  benchmark: Benchmark,
  network: Rede,
  startup: Inicializacao,
  processes: Processos,
  restore: Restauracao,
  history: Historico,
  settings: Configuracoes,
  activation: Licenca,
  support: Suporte,
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
  const props = { onNavigate: setView, view };

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
              <ViewErrorBoundary view={view}>
                <Content {...props} />
              </ViewErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}