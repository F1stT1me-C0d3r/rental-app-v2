const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function getToken() { try { return localStorage.getItem('token'); } catch { return null; } }
export function setToken(t) { try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); } catch { /* ignore */ } }

export async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': raw ? 'text/csv' : 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error ?? `Request failed (${res.status})`); e.data = data; throw e; }
  return data;
}

export const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
