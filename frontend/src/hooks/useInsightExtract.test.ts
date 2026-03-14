/**
 * frontend/src/hooks/useInsightExtract.test.ts
 *
 * Unit tests for useInsightExtract hook.
 * axios http client is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/http', () => ({
  default: {
    post: vi.fn(),
  },
}));

import { useInsightExtract } from './useInsightExtract';
import http from '../services/http';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_DTO = {
  sessionId: 'session-001',
  transcript: '用户说：手续费太高了，体验很差。',
};

const MOCK_RESPONSE = {
  status: 'success',
  themes: [
    {
      title: '手续费过高',
      description: '用户认为费用超出预期',
      evidence: ['手续费太高了'],
    },
  ],
  key_quotes: [{ text: '手续费太高了', speaker: '受访者A', insight: '价格敏感' }],
  sentiment: {
    label: 'negative' as const,
    score: -0.7,
    breakdown: { 正面: 10, 中性: 20, 负面: 70 },
  },
  summary: '用户对费用高度不满。',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInsightExtract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useInsightExtract());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets isLoading=true while request is in-flight', async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(http.post).mockReturnValueOnce(new Promise((res) => { resolve = res; }) as any);

    const { result } = renderHook(() => useInsightExtract());

    act(() => {
      void result.current.extract(MOCK_DTO);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    // settle the promise so there are no unhandled rejections
    await act(async () => {
      resolve({ data: MOCK_RESPONSE });
    });
  });

  it('sets result on success', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useInsightExtract());

    await act(async () => {
      await result.current.extract(MOCK_DTO);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(MOCK_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it('returns the insight data from extract()', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useInsightExtract());
    let returned: unknown;

    await act(async () => {
      returned = await result.current.extract(MOCK_DTO);
    });

    expect(returned).toEqual(MOCK_RESPONSE);
  });

  it('sets error state on network failure', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new Error('网络超时'));

    const { result } = renderHook(() => useInsightExtract());

    await act(async () => {
      await result.current.extract(MOCK_DTO);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('网络超时');
  });

  it('uses fallback error message for non-Error throws', async () => {
    vi.mocked(http.post).mockRejectedValueOnce('raw string error');

    const { result } = renderHook(() => useInsightExtract());

    await act(async () => {
      await result.current.extract(MOCK_DTO);
    });

    expect(result.current.error).toBe('洞察提取失败');
  });

  it('returns null on failure', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useInsightExtract());
    let returned: unknown = 'not-null';

    await act(async () => {
      returned = await result.current.extract(MOCK_DTO);
    });

    expect(returned).toBeNull();
  });

  it('reset() clears result and error', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useInsightExtract());

    await act(async () => {
      await result.current.extract(MOCK_DTO);
    });

    expect(result.current.result).not.toBeNull();

    act(() => result.current.reset());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('posts to the correct endpoint', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useInsightExtract());

    await act(async () => {
      await result.current.extract(MOCK_DTO);
    });

    expect(vi.mocked(http.post)).toHaveBeenCalledWith(
      '/ai/insight/extract',
      MOCK_DTO,
    );
  });
});
