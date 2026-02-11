export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token');

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (
      res.status === 401 &&
      path !== '/auth/login' &&
      path !== '/auth/register'
    ) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const errorText = await res.text();
    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[] };
      const message = Array.isArray(parsed.message)
        ? parsed.message.join(', ')
        : parsed.message;
      throw new Error(message || 'API error');
    } catch {
      throw new Error(errorText || 'API error');
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
