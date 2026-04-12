import { getApiUrl } from '@/lib/query-client';

let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredHandler(handler: () => void) {
  onAuthExpired = handler;
}

export class ApiResponseError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.payload = payload;
  }
}

export async function authFetch(
  token: string | null,
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined | null | number>; signal?: AbortSignal } = {}
) {
  if (!token) throw new Error('Not authenticated');
  const base = getApiUrl();
  const url = new URL(path, base);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null && String(v) !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (res.status === 401) {
    if (onAuthExpired) onAuthExpired();
    throw new ApiResponseError(401, 'Session expired. Please sign in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new ApiResponseError(res.status, data.message || `Request failed (${res.status})`, data);
  return data;
}
