import { apiFetch } from './api';

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('adds auth header when token exists and returns parsed json', async () => {
    localStorage.setItem('token', 'token-123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch('/stores/my');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/stores/my`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
  });

  it('returns undefined for 204 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }) as unknown as typeof fetch;

    const result = await apiFetch('/stores/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('extracts backend error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Bad payload' }),
    }) as unknown as typeof fetch;

    await expect(apiFetch('/some-endpoint')).rejects.toThrow('Bad payload');
  });
});
