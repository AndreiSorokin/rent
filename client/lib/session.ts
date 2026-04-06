const ACCESS_TOKEN_KEY = 'token';

let refreshPromise: Promise<string | null> | null = null;

function getApiUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetch(getApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      clearStoredAccessToken();
      return null;
    }

    let payload: { access_token?: string } = {};
    if (typeof response.json === 'function') {
      payload = (await response.json()) as { access_token?: string };
    } else if (typeof response.text === 'function') {
      const raw = await response.text();
      payload = raw ? (JSON.parse(raw) as { access_token?: string }) : {};
    }

    if (!payload.access_token) {
      clearStoredAccessToken();
      return null;
    }

    setStoredAccessToken(payload.access_token);
    return payload.access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function ensureAccessToken() {
  const existing = getStoredAccessToken();
  if (existing) return existing;
  return refreshAccessToken();
}

export async function logoutSession() {
  try {
    await fetch(getApiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore logout transport errors
  } finally {
    clearStoredAccessToken();
  }
}

export async function authorizedFetch(
  input: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
) {
  const token = await ensureAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  });
}
