/**
 * frontend/src/hooks/useWorkspaceSession.test.ts
 *
 * Unit tests for useWorkspaceSession hook.
 * Guards the bulkCreate N+1 fix — persistSegments must call bulkCreate exactly once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Module mocks (must come before imports of mocked modules) ──────────────

vi.mock('../services/sessions', () => ({
  sessionsApi: { get: vi.fn(), updateStatus: vi.fn() },
}));

vi.mock('../services/transcript', () => ({
  transcriptApi: { listBySession: vi.fn(), bulkCreate: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useWorkspaceSession } from './useWorkspaceSession';
import { sessionsApi } from '../services/sessions';
import { transcriptApi } from '../services/transcript';
import type { Session } from '../services/sessions';
import type { TranscriptSegment, CreateSegmentDto } from '../services/transcript';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_ID = 'session-001';

function makeSession(id = SESSION_ID): Session {
  return {
    id,
    title: '测试访谈会话',
    clientId: 'client-001',
    status: 'in_progress',
    interviewDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function makeSegment(i: number): TranscriptSegment {
  return {
    id: `seg-${i}`,
    sessionId: SESSION_ID,
    tenantId: 'tenant-001',
    text: `段落文本 ${i}`,
    startMs: i * 1000,
    endMs: i * 1000 + 500,
    speaker: '说话人A',
    createdAt: new Date().toISOString(),
  };
}

function makeSegmentDto(i: number): CreateSegmentDto {
  return {
    text: `段落文本 ${i}`,
    startMs: i * 1000,
    endMs: i * 1000 + 500,
    speaker: '说话人A',
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sessionQuery fetches session data', async () => {
    const mockSession = makeSession();
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: mockSession } as any);
    vi.mocked(transcriptApi.listBySession).mockResolvedValue({ data: [] } as any);

    const { result } = renderHook(() => useWorkspaceSession(SESSION_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.session).toEqual(mockSession);
    });

    expect(sessionsApi.get).toHaveBeenCalledWith(SESSION_ID);
  });

  it('segmentsQuery fetches transcript segments', async () => {
    const mockSegments = [makeSegment(1), makeSegment(2), makeSegment(3)];
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: makeSession() } as any);
    vi.mocked(transcriptApi.listBySession).mockResolvedValue({ data: mockSegments } as any);

    const { result } = renderHook(() => useWorkspaceSession(SESSION_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.segments).toHaveLength(3);
    });

    expect(transcriptApi.listBySession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('persistSegments calls bulkCreate exactly once (N+1 regression guard)', async () => {
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: makeSession() } as any);
    vi.mocked(transcriptApi.listBySession).mockResolvedValue({ data: [] } as any);
    vi.mocked(transcriptApi.bulkCreate).mockResolvedValue({ data: [] } as any);

    const { result } = renderHook(() => useWorkspaceSession(SESSION_ID), {
      wrapper: makeWrapper(),
    });

    const segs = [makeSegmentDto(1), makeSegmentDto(2), makeSegmentDto(3)];

    await act(async () => {
      await result.current.persistSegments(segs);
    });

    expect(transcriptApi.bulkCreate).toHaveBeenCalledTimes(1);
    expect(transcriptApi.bulkCreate).toHaveBeenCalledWith(SESSION_ID, segs);
  });

  it('persistSegments does nothing when sessionId is undefined', async () => {
    const { result } = renderHook(() => useWorkspaceSession(undefined), {
      wrapper: makeWrapper(),
    });

    const segs = [makeSegmentDto(1), makeSegmentDto(2)];

    await act(async () => {
      await result.current.persistSegments(segs);
    });

    expect(transcriptApi.bulkCreate).not.toHaveBeenCalled();
  });

  it('endSessionMutation calls sessionsApi.updateStatus with completed status', async () => {
    const updatedSession = { ...makeSession(), status: 'completed' as const };
    vi.mocked(sessionsApi.get).mockResolvedValue({ data: makeSession() } as any);
    vi.mocked(transcriptApi.listBySession).mockResolvedValue({ data: [] } as any);
    vi.mocked(sessionsApi.updateStatus).mockResolvedValue({ data: updatedSession } as any);

    const { result } = renderHook(() => useWorkspaceSession(SESSION_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.endSessionMutation.mutateAsync();
    });

    expect(sessionsApi.updateStatus).toHaveBeenCalledWith(SESSION_ID, 'completed');
  });
});
