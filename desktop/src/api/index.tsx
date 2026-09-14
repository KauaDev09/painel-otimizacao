import React, { createContext, useContext } from 'react';
import type { SevenApi } from './types';

declare global {
  interface Window {
    SevenAPI?: SevenApi;
  }
}

let singleton: SevenApi | null = null;

/** Obtém a API real (Electron) ou o mock de preview de forma singleton. */
export async function getSevenApi(): Promise<SevenApi> {
  if (singleton) return singleton;
  if (window.SevenAPI) {
    singleton = window.SevenAPI;
    return singleton;
  }
  // Browser/preview sem o preload: carrega o mock (ele publica window.SevenAPI).
  await import('../ui/mock-api.js');
  singleton = window.SevenAPI ?? ({} as SevenApi);
  return singleton;
}

const ApiContext = createContext<SevenApi | null>(null);

export function ApiProvider({ api, children }: { api: SevenApi; children: React.ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): SevenApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi deve ser usado dentro de <ApiProvider>');
  return api;
}

/** Hook que resolve a API e a publica no contexto. */
export function useApiBootstrap() {
  const [api, setApi] = React.useState<SevenApi | null>(null);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    getSevenApi()
      .then((a) => setApi(a))
      .catch((e) => setError(e));
  }, []);

  return { api, error };
}