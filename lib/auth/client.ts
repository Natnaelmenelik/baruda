'use client';

export function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('token');

  if (!token || token === 'null' || token === 'undefined') return null;

  return token;
}

export function getClientUser(): any | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isClientAdmin(): boolean {
  const user = getClientUser();

  return Boolean(
    user?.isAdmin === true ||
      user?.is_admin === true ||
      user?.role === 'admin' ||
      user?.role === 'ADMIN'
  );
}

export function setClientSession(token: string, user: any): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));

  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearClientSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

export function authHeaders(): Record<string, string> {
  const token = getClientToken();

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});

  const token = getClientToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });
}
