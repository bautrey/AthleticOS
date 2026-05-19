import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock the api/client module BEFORE importing the hook under test.
// The hook calls `api.get('/auth/me')` on mount and `api.post('/auth/login')`
// on login. We replace the axios instance with a vi.fn-based shim.
const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

// Import AFTER mocking.
import { AuthProvider, useAuth } from './useAuth';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    localStorage.clear();
  });

  it('starts with loading=true and user=null when no token is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    // After the effect runs with no token, loading should become false.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('fetches /auth/me when a token is in localStorage', async () => {
    localStorage.setItem('accessToken', 'stored-token');
    getMock.mockResolvedValueOnce({
      data: {
        data: { id: 'u1', email: 'a@b.com', schools: [{ id: 's1', name: 'X', role: 'ADMIN' }] },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getMock).toHaveBeenCalledWith('/auth/me');
    expect(result.current.user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      schools: [{ id: 's1', name: 'X', role: 'ADMIN' }],
    });
  });

  it('clears tokens when /auth/me fails (token revoked / expired)', async () => {
    localStorage.setItem('accessToken', 'bad-token');
    localStorage.setItem('refreshToken', 'also-bad');
    getMock.mockRejectedValueOnce(new Error('401 from /auth/me'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('login() stores tokens and populates user from the profile response', async () => {
    // No bootstrap call — no stored token.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    postMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'access-1', refreshToken: 'refresh-1' } },
    });
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u1', email: 'a@b.com', schools: [] } },
    });

    await act(async () => {
      await result.current.login('a@b.com', 'pw');
    });

    expect(postMock).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pw' });
    expect(localStorage.getItem('accessToken')).toBe('access-1');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com', schools: [] });
  });

  it('register() forwards optional name and inviteToken to the API', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    postMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'a', refreshToken: 'r' } },
    });
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u2', email: 'new@b.com', schools: [{ id: 's', name: 'School', role: 'PARENT' }] } },
    });

    await act(async () => {
      await result.current.register('new@b.com', 'pw', 'Pat', 'invite-123');
    });

    expect(postMock).toHaveBeenCalledWith('/auth/register', {
      email: 'new@b.com',
      password: 'pw',
      name: 'Pat',
      inviteToken: 'invite-123',
    });
    expect(result.current.user?.schools).toHaveLength(1);
  });

  it('logout() clears tokens and resets the user', async () => {
    localStorage.setItem('accessToken', 't');
    localStorage.setItem('refreshToken', 'r');
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u1', email: 'a@b.com', schools: [] } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    // renderHook without wrapper → no provider.
    // We expect the error to surface synchronously.
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
