export const TOKEN_KEY = 'orion_token';

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

export const PUBLIC_INSTALLER = {
  version: '2.1.10',
  filename: 'ORION.OPTIMIZER.Setup-2.1.10.exe',
  url: 'https://github.com/KauaDev09/painel-otimizacao/releases/download/v2.1.10/ORION.OPTIMIZER.Setup-2.1.10.exe',
  releaseNotes:
    'Discord oficial no suporte. Fonte Inter. Login e Configurações com o novo canal. Instalador público; o painel abre com a key.',
  size: '~108 MB',
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
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
