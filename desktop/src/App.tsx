import React from 'react';
import { ApiProvider, useApi, useApiBootstrap } from '@/api';
import type { LicenseState } from '@/api/types';
import { Login } from '@/app/Login';
import { Shell } from '@/app/Shell';

function Splash() {
  return (
    <div className="flex h-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Orion Optimizer</span>
      </div>
    </div>
  );
}

function Root() {
  const [lic, setLic] = React.useState<LicenseState | null>(null);
  const api = useApi();

  React.useEffect(() => {
    api
      .licenseGetState()
      .then(setLic)
      .catch(() => setLic({ active: false }));
    api.onLicenseChanged?.((st) => setLic(st));
  }, [api]);

  if (!lic) return <Splash />;
  if (!lic.active) return <Login />;
  return <Shell />;
}

export default function App() {
  const { api, error } = useApiBootstrap();

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black p-6 text-center">
        <span className="text-2xl">⚠️</span>
        <p className="text-sm text-foreground">Não foi possível iniciar o painel.</p>
        <pre className="max-w-lg overflow-auto text-xs text-muted-foreground">{String(error)}</pre>
      </div>
    );
  }

  if (!api) return <Splash />;

  return (
    <ApiProvider api={api}>
      <Root />
    </ApiProvider>
  );
}