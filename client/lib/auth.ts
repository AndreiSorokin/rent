function decodeJwtPayload(token: string) {
  const payloadPart = token.split('.')[1];
  if (!payloadPart) {
    throw new Error('Invalid token payload');
  }

  const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(paddedBase64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as {
    sub?: number;
    id?: number;
    email?: string;
    name?: string | null;
  };
}

export function getCurrentUserFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = decodeJwtPayload(token);
    return {
      id: payload.sub ?? payload.id,
      email: payload.email,
      name: payload.name || null,
    };
  } catch (e) {
    console.error('Invalid token');
    return null;
  }
}
