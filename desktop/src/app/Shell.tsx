import React, { Suspense, lazy } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Home } from '@/views/Home';
import { ComingSoon } from '@/views/ComingSoon';
import { OrionReactiveCore } from '@/components/orion-reactive-core';
import { useApi } from '@/api';

// Views pesadas sob demanda — menos RAM na abertura do painel.
const Sistema = lazy(() => import('@/views/Sistema').then((m) => ({ default: m.Sistema })));
const Jogos = lazy(() => import('@/views/Jogos').then((m) => ({ default: m.Jogos })));
const Tela = lazy(() => import('@/views/Tela').then((m) => ({ default: m.Tela })));
const Windows = lazy(() => import('@/views/Windows').then((m) => ({ default: m.Windows })));
const Limpeza = lazy(() => import('@/views/Limpeza').then((m) => ({ default: m.Limpeza })));
const Bios = lazy(() => import('@/views/Bios').then((m) => ({ default: m.Bios })));
const Seguranca = lazy(() => import('@/views/Seguranca').then((m) => ({ default: m.Seguranca })));
const Benchmark = lazy(() => import('@/views/Benchmark').then((m) => ({ default: m.Benchmark })));
const Rede = lazy(() => import('@/views/Rede').then((m) => ({ default: m.Rede })));
const Inicializacao = lazy(() => import('@/views/Inicializacao').then((m) => ({ default: m.Inicializacao })));
const Processos = lazy(() => import('@/views/Processos').then((m) => ({ default: m.Processos })));
const Restauracao = lazy(() => import('@/views/Restauracao').then((m) => ({ default: m.Restauracao })));
const Historico = lazy(() => import('@/views/Historico').then((m) => ({ default: m.Historico })));
const Configuracoes = lazy(() => import('@/views/Configuracoes').then((m) => ({ default: m.Configuracoes })));
const Licenca = lazy(() => import('@/views/Licenca').then((m) => ({ default: m.Licenca })));
const Suporte = lazy(() => import('@/views/Suporte').then((m) => ({ default: m.Suporte })));

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

function ViewFallback() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Carregando…
    </div>
  );
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
                <Suspense fallback={<ViewFallback />}>
                  <Content {...props} />
                </Suspense>
              </ViewErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
