/**
 * frontend/src/hooks/useSession.test.ts
 *
 * Unit tests for useSession, useSessions, useCreateSession, useUpdateSession.
 * sessionsApi is mocked; React Query is wired with a real QueryClient.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/sessions', () => ({
  sessionsApi: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import {
  useSession,
  useSessions,
  useCreateSession,
  useUpdateSession,
} from './useSession';
import { sessionsApi, type Session } from '../services/sessions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

function makeSession(id: string, title = 'Test Session'): Session {
  return {
    id,
    title,
    clientId: `client-${id}`,
    status: 'scheduled',
    interviewDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

// ── useSession ────────────────────────────────────────────────────────────────

describe('useSession', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = makeQueryClient();
  });

  it('fetches session by id', async () => {
    const session = makeSession('s-001');
    vi.mocked(sessionsApi.get).mockResolvedValueOnce({ data: session } as any);

    const { result } = renderHook(() => useSession('s-001'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(session);
    expect(vi.mocked(sessionsApi.get)).toHaveBeenCalledWith('s-001');
  });

  it('does not fetch when sessionId is undefined', () => {
    const { result } = renderHook(() => useSession(undefined), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(vi.mocked(sessionsApi.get)).not.toHaveBeenCalled();
  });

  it('returns error state on failure', async () => {
    vi.mocked(sessionsApi.get).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useSession('s-404'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

// ── useSessions ───────────────────────────────────────────────────────────────

describe('useSessions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = makeQueryClient();
  });

  it('fetches session list', async () => {
    const paginated = {
      data: [makeSession('s-001'), makeSession('s-002')],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    };
    vi.mocked(sessionsApi.list).mockResolvedValueOnce({ data: paginated } as any);

    const { result } = renderHook(() => useSessions(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(vi.mocked(sessionsApi.list)).toHaveBeenCalled();
  });

  it('passes params to sessionsApi.list', async () => {
    vi.mocked(sessionsApi.list).mockResolvedValueOnce({
      data: { data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } },
    } as any);

    const { result } = renderHook(
      () => useSessions({ page: 2, limit: 10, status: 'in_progress' }),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(sessionsApi.list)).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      status: 'in_progress',
    });
  });
});

// ── useCreateSession ──────────────────────────────────────────────────────────

describe('useCreateSession', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = makeQueryClient();
  });

  it('calls sessionsApi.create with dto', async () => {
    const newSession = makeSession('s-new', 'New Session');
    vi.mocked(sessionsApi.create).mockResolvedValueOnce({ data: newSession } as any);

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'New Session',
        clientId: 'client-x',
        interviewDate: new Date().toISOString(),
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(sessionsApi.create)).toHaveBeenCalledWith({
      title: 'New Session',
      clientId: 'client-x',
      interviewDate: expect.any(String),
    });
    expect(result.current.data).toEqual(newSession);
  });

  it('propagates error on create failure', async () => {
    vi.mocked(sessionsApi.create).mockRejectedValueOnce(new Error('Conflict'));

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: makeWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ title: 'x', clientId: 'y', interviewDate: new Date().toISOString() });
      }),
    ).rejects.toThrow('Conflict');
  });
});

// ── useUpdateSession ──────────────────────────────────────────────────────────

describe('useUpdateSession', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = makeQueryClient();
  });

  it('calls sessionsApi.update with sessionId and dto', async () => {
    const updated = makeSession('s-001', 'Updated Title');
    vi.mocked(sessionsApi.update).mockResolvedValueOnce({ data: updated } as any);

    const { result } = renderHook(() => useUpdateSession('s-001'), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: 'Updated Title' });
    });

    expect(vi.mocked(sessionsApi.update)).toHaveBeenCalledWith('s-001', {
      title: 'Updated Title',
    });
  });
});
