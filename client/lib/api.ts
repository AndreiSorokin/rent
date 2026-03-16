export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token');
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    let parsedMessage: string | undefined;
    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[] };
      parsedMessage = Array.isArray(parsed.message)
        ? parsed.message.join(', ')
        : parsed.message;
    } catch {
      // Ignore JSON parse errors and fall back to raw response text below.
    }

    throw new Error(parsedMessage || errorText || 'API error');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!rawText.trim()) {
    return undefined as T;
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(rawText) as T;
  }

  return rawText as T;
}
