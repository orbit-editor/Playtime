import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('TestPostSetsCSRFHeader', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(jsonResponse({ redeem_id: 5, status: 'pending' }));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/api/redeem', { student_id: 3, reward_id: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('/api/redeem');
    expect(call[1].method).toBe('POST');
    const headers = call[1].headers as Record<string, string>;
    expect(headers['X-Playtime']).toBe('1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(call[1].body).toBe(JSON.stringify({ student_id: 3, reward_id: 1 }));
  });

  it('Test401RaisesApiError', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'unauthorized', message: '认领过期了' } }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/bootstrap')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'unauthorized',
    } satisfies Partial<ApiError>);
  });

  it('TestNetworkFailureUsesOfflineStatus', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/bootstrap')).rejects.toMatchObject({
      status: 0,
      code: 'offline',
    });
  });
});
