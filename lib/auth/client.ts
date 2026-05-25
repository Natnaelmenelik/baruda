const AUTH_STORAGE_KEYS = [
  "token",
  "auth_token",
  "access_token",
  "refresh_token",
  "user",
  "auth_user",
  "session",
  "auth-session",
  "supabase.auth.token",
];

const LOGOUT_IN_PROGRESS_KEY = "logout_in_progress";


function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredToken(): string | null {
  if (!isBrowser()) return null;

  for (const key of AUTH_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value) return value;
    } catch {}
  }

  return null;
}

function setCookie(name: string, value: string) {
  if (!isBrowser()) return;

  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax${secure}`;
  } catch {}
}

function expireCookie(name: string) {
  if (!isBrowser()) return;

  try {
    const hostname = window.location.hostname;

    document.cookie = `${name}=; Max-Age=0; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;

    const parts = hostname.split(".");
    if (parts.length > 2) {
      const rootDomain = "." + parts.slice(-2).join(".");
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${rootDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
  } catch {}
}

function extractToken(session: any): string | null {
  return (
    session?.token ||
    session?.access_token ||
    session?.auth_token ||
    session?.data?.token ||
    session?.data?.access_token ||
    session?.data?.auth_token ||
    session?.data?.session?.access_token ||
    session?.session?.access_token ||
    null
  );
}

function extractUser(session: any): any {
  return (
    session?.user ||
    session?.data?.user ||
    session?.data?.session?.user ||
    session?.session?.user ||
    null
  );
}


export function clearLogoutInProgressFlag() {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
  } catch {}
}

export function setClientSession(session: any) {
  if (!isBrowser()) return;

  

  try {
    const logoutLocked = localStorage.getItem(LOGOUT_IN_PROGRESS_KEY) === "true";
    const isLoginPage = window.location.pathname.includes("/login");

    if (logoutLocked && !isLoginPage) {
      return;
    }

    if (logoutLocked && isLoginPage) {
      localStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
      sessionStorage.removeItem(LOGOUT_IN_PROGRESS_KEY);
    }
  } catch {}try {
    const token = extractToken(session);
    const user = extractUser(session);

    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("access_token", token);

      // Proxy/middleware reads this cookie for protected-route access.
      setCookie("token", token);
      setCookie("auth_token", token);
    }

    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("auth_user", JSON.stringify(user));
    }

    localStorage.setItem("session", JSON.stringify(session));
  } catch (err) {
    console.error("setClientSession error:", err);
  }
}

export function clearClientSession() {
  if (!isBrowser()) return;

  try {
    try {
      localStorage.setItem(LOGOUT_IN_PROGRESS_KEY, "true");
      sessionStorage.setItem(LOGOUT_IN_PROGRESS_KEY, "true");
    } catch {}
    for (const key of AUTH_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    try {
      Object.keys(localStorage).forEach((key) => {
        const lower = key.toLowerCase();

        if (
          lower.includes("token") ||
          lower.includes("auth") ||
          lower.includes("session") ||
          lower.includes("supabase")
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    try {
      sessionStorage.clear();
    } catch {}

    // Expire known auth cookies.
    [
      "token",
      "auth_token",
      "access_token",
      "refresh_token",
      "session",
      "auth-session",
      "supabase.auth.token",
    ].forEach(expireCookie);

    // Also expire any existing cookie with auth-like name.
    try {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

        if (!name) return;

        const lower = name.toLowerCase();
        if (
          lower.includes("token") ||
          lower.includes("auth") ||
          lower.includes("session") ||
          lower.includes("supabase")
        ) {
          expireCookie(name);
        }
      });
    } catch {}

    // Optional cleanup hooks, only if your app exposes them.
    try {
      // @ts-ignore
      window.__REACT_QUERY_CLIENT__?.clear?.();
    } catch {}

    try {
      // @ts-ignore
      window.supabase?.removeAllChannels?.();
    } catch {}
  } catch (err) {
    console.error("clearClientSession error:", err);
  }
}

export function logoutClientSession(redirectTo = "/login") {
  try {
    clearClientSession();

    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).finally(() => {
        window.location.replace(redirectTo);
      });
    }
  } catch {
    if (typeof window !== "undefined") {
      window.location.replace(redirectTo);
    }
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    clearClientSession();
  }

  return response;
}


export function getClientUser(): any | null {
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
