export const TOKEN_KEY = 's4_token';
const LEGACY_TOKEN_KEY = 'orion_token';

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const INSTALLER_DOWNLOAD_URL = '/api/v1/public/installer';

export const PUBLIC_INSTALLER = {
  version: '2.1.17',
  filename: 'SevenOptimizer-Setup-2.1.17.exe',
  url: INSTALLER_DOWNLOAD_URL,
  releaseNotes:
    'Instalador público para Windows 10 e 11. O download inicia sem cadastro e a ativação do painel continua sendo feita por key.',
  size: '~107 MB',
};

export type DownloadInfo = {
  version: string;
  filename?: string;
  url: string;
  releaseNotes?: string;
  size?: string;
};

export type Plan = {
  id: number;
  slug: string;
  name: string;
  price: number;
  description?: string;
  features?: string[];
};

export type Coupon = {
  code: string;
  discountPercent: number;
};

export type User = {
  name?: string;
  email?: string;
};

export type License = {
  key?: string;
  chave?: string;
  plan?: string;
  status?: string;
  activations?: number;
  maxActivations?: number | null;
  expiresAt?: string;
  order_id?: string;
};

export type Order = {
  uuid?: string;
  order_uuid?: string;
  order_id?: string;
  plan?: string;
  plan_name?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

export type Payment = {
  qr_code?: string;
  qr_code_text?: string;
  external_link?: string;
  checkoutUrl?: string;
};

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getToken(): string | null {
  const current = localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthed() {
  return !!getToken();
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || data.ok === false) {
    throw new ApiError(
      (data.message as string) || 'Erro na requisição',
      data.code as string | undefined,
      (data.status as number | undefined) || res.status,
    );
  }

  return data as T;
}

export const API = {
  get<T>(path: string, auth = false) {
    return req<T>('GET', path, undefined, auth);
  },
  post<T>(path: string, body?: unknown, auth = false) {
    return req<T>('POST', path, body, auth);
  },
};
