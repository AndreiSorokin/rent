export function getCurrentUserFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name || null,
    };
  } catch (e) {
    console.error('Invalid token');
    return null;
  }
}