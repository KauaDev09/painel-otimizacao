export const ADMIN_TOKEN_KEY = 'msAdminToken';

type AdminCallOpts = {
  method?: string;
  body?: unknown;
};

type AdminJson = Record<string, unknown> & {
  ok?: boolean;
  message?: string;
};

let onUnauthorized: (() => void) | null = null;

export function setAdminUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function getAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminCall<T extends AdminJson = AdminJson>(
  path: string,
  opts: AdminCallOpts = {},
): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const j = (await res.json().catch(() => ({
    ok: false,
    message: 'Resposta inválida',
  }))) as T;

  if (!j.ok && res.status === 401) {
    onUnauthorized?.();
    throw new Error('Sessão expirada.');
  }
  if (!j.ok) {
    throw new Error((j.message as string) || `HTTP ${res.status}`);
  }
  return j;
}
