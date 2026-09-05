import React, { createContext, useContext } from 'react';
import type { OrionApi } from './types';

declare global {
  interface Window {
    OrionAPI?: OrionApi;
  }
}

let singleton: OrionApi | null = null;

/** Obtém a API real (Electron) ou o mock de preview de forma singleton. */
export async function getOrionApi(): Promise<OrionApi> {
  if (singleton) return singleton;
  if (window.OrionAPI) {
    singleton = window.OrionAPI;
    return singleton;
  }
  // Browser/preview sem o preload: carrega o mock (ele publica window.OrionAPI).
  await import('../ui/mock-api.js');
  singleton = window.OrionAPI ?? ({} as OrionApi);
  return singleton;
}

const ApiContext = createContext<OrionApi | null>(null);

export function ApiProvider({ api, children }: { api: OrionApi; children: React.ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): OrionApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi deve ser usado dentro de <ApiProvider>');
  return api;
}

/** Hook que resolve a API e a publica no contexto. */
export function useApiBootstrap() {
  const [api, setApi] = React.useState<OrionApi | null>(null);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    getOrionApi()
      .then((a) => setApi(a))
      .catch((e) => setError(e));
  }, []);

  return { api, error };
}