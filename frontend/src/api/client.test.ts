// frontend/src/api/client.test.ts
// Covers the axios interceptors in api/client.ts:
//   - Request interceptor injects Authorization from localStorage.
//   - Response interceptor refreshes the token + retries on 401.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock axios BEFORE importing the client. We capture the axios.create() instance
// and any interceptors registered on it, plus the bare axios.post used by the
// refresh flow.
const requestInterceptors: ((cfg: { headers?: Record<string, string> }) => unknown)[] = [];
const responseSuccessHandlers: ((res: unknown) => unknown)[] = [];
const responseErrorHandlers: ((err: unknown) => unknown)[] = [];

const instanceRequest = vi.fn();
const fakeInstance = {
  interceptors: {
    request: { use: (fn: (cfg: { headers?: Record<string, string> }) => unknown) => { requestInterceptors.push(fn); } },
    response: {
      use: (
        success: (res: unknown) => unknown,
        error: (err: unknown) => unknown
      ) => {
        responseSuccessHandlers.push(success);
        responseErrorHandlers.push(error);
      },
    },
  },
  request: (cfg: unknown) => instanceRequest(cfg),
};

const axiosPostMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => fakeInstance,
    post: (...args: unknown[]) => axiosPostMock(...args),
  },
}));

beforeEach(async () => {
  requestInterceptors.length = 0;
  responseSuccessHandlers.length = 0;
  responseErrorHandlers.length = 0;
  instanceRequest.mockReset();
  axiosPostMock.mockReset();
  localStorage.clear();
  // Force re-evaluation of the module under test so interceptors re-register
  // against our freshly-cleared arrays.
  vi.resetModules();
  await import('./client');
});

afterEach(() => {
  // window.location.href is set on terminal refresh failure; jsdom assigns it
  // but doesn't navigate.
});

describe('api client request interceptor', () => {
  it('does NOT add Authorization when no token is stored', () => {
    const cfg = { headers: {} as Record<string, string> };
    const out = requestInterceptors[0](cfg) as typeof cfg;
    expect(out.headers.Authorization).toBeUndefined();
  });

  it('adds Bearer Authorization when accessToken is stored', () => {
    localStorage.setItem('accessToken', 'tok-123');
    const cfg = { headers: {} as Record<string, string> };
    const out = requestInterceptors[0](cfg) as typeof cfg;
    expect(out.headers.Authorization).toBe('Bearer tok-123');
  });
});

describe('api client response interceptor (401 refresh)', () => {
  function fakeError(originalConfig: Record<string, unknown> = {}) {
    return {
      response: { status: 401 },
      config: { headers: {} as Record<string, string>, ...originalConfig },
    };
  }

  it('refreshes the token and retries the original request on 401', async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    axiosPostMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
    });
    instanceRequest.mockResolvedValueOnce({ status: 200, data: 'retried' });

    const result = await responseErrorHandlers[0](fakeError());
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/refresh$/),
      { refreshToken: 'old-refresh' }
    );
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(instanceRequest).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 200, data: 'retried' });
  });

  it('clears tokens when refresh itself fails', async () => {
    localStorage.setItem('refreshToken', 'expired-refresh');
    localStorage.setItem('accessToken', 'expired-access');
    axiosPostMock.mockRejectedValueOnce(new Error('refresh denied'));

    // The terminal branch sets window.location.href in real code — jsdom allows
    // the assignment, so we just confirm tokens were cleared and the error
    // propagates (interceptor re-throws via Promise.reject in normal flow).
    await responseErrorHandlers[0](fakeError()).catch(() => undefined);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('does NOT attempt refresh when there is no refreshToken', async () => {
    // 401 with no refresh token — the interceptor rejects directly.
    const err = fakeError();
    await expect(responseErrorHandlers[0](err)).rejects.toEqual(err);
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors unchanged', async () => {
    const err = { response: { status: 500 }, config: { headers: {} } };
    await expect(responseErrorHandlers[0](err)).rejects.toBe(err);
    expect(axiosPostMock).not.toHaveBeenCalled();
  });
});
