export function getToken() {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('lottery_token')
  );
}

export function getClientUser() {
  if (typeof window === 'undefined') return null;

  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export function setClientSession(token: string, user: any) {
  if (typeof window === 'undefined') return;

  localStorage.setItem('token', token);
  localStorage.setItem('auth_token', token);
  localStorage.setItem('lottery_token', token);
  localStorage.setItem('user', JSON.stringify(user || {}));

  document.cookie = `token=${token}; Path=/; SameSite=Lax`;
}

export function saveClientSession(token: string, user: any) {
  setClientSession(token, user);
}

export function clearClientSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('lottery_token');
  localStorage.removeItem('user');

  document.cookie =
    'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = getToken();

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
