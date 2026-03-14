/**
 * frontend/src/services/llm.test.ts
 *
 * Unit tests for llmApi.chat and llmApi.chatStream.
 * fetch is mocked globally; useAuthStore is mocked to return a test token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ accessToken: 'test-token' })),
  },
}));

vi.mock('./http', () => ({
  default: {
    post: vi.fn(),
  },
}));

import { llmApi } from './llm';
import http from './http';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mocked ReadableStream that emits the given SSE lines one by one.
 */
function makeSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
}

// ── llmApi.chat ───────────────────────────────────────────────────────────────

describe('llmApi.chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /ai/llm/chat with messages and defaults', async () => {
    const mockResponse = {
      id: 'cmpl-001',
      choices: [{ message: { role: 'assistant', content: '你好' } }],
    };
    vi.mocked(http.post).mockResolvedValueOnce({ data: mockResponse });

    const result = await llmApi.chat([{ role: 'user', content: '你好' }]);

    expect(vi.mocked(http.post)).toHaveBeenCalledWith(
      '/ai/llm/chat',
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          { role: 'user', content: '你好' },
        ]),
        model: 'moonshot-v1-8k',
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('prepends system prompt to messages', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: {} });

    await llmApi.chat([{ role: 'user', content: 'test' }]);

    const callArgs = vi.mocked(http.post).mock.calls[0][1] as any;
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toContain('OpenClaw Copilot');
  });

  it('forwards custom model and temperature options', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: {} });

    await llmApi.chat(
      [{ role: 'user', content: 'hi' }],
      { model: 'moonshot-v1-32k', temperature: 0.5, maxTokens: 1024 },
    );

    const callArgs = vi.mocked(http.post).mock.calls[0][1] as any;
    expect(callArgs.model).toBe('moonshot-v1-32k');
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(1024);
  });
});

// ── llmApi.chatStream ─────────────────────────────────────────────────────────

describe('llmApi.chatStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  function makeMockFetchResponse(stream: ReadableStream, ok = true, status = 200) {
    return Promise.resolve({
      ok,
      status,
      body: stream,
    });
  }

  it('sends POST to /api/v1/ai/llm/chat/stream with Authorization header', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream(['data: [DONE]'])),
    );

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/ai/llm/chat/stream',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('calls onDelta for each content chunk', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":" World"},"finish_reason":null}]}',
      'data: [DONE]',
    ];
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream(sseLines)),
    );

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(callbacks.onDelta).toHaveBeenNthCalledWith(1, 'Hello');
    expect(callbacks.onDelta).toHaveBeenNthCalledWith(2, ' World');
    expect(callbacks.onDone).toHaveBeenCalledOnce();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('calls onDone on finish_reason=stop', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}',
    ];
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream(sseLines)),
    );

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(callbacks.onDone).toHaveBeenCalledOnce();
  });

  it('calls onError when response is not ok', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream([]), false, 500),
    );

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('500'));
    expect(callbacks.onDone).not.toHaveBeenCalled();
  });

  it('silently returns on AbortError (no onError)', async () => {
    // Use a plain Error with name='AbortError' for cross-environment compatibility
    const abortError = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    vi.mocked(fetch as any).mockRejectedValueOnce(abortError);

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'abort' }], {}, callbacks);

    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('calls onError on network failure (non-Abort)', async () => {
    vi.mocked(fetch as any).mockRejectedValueOnce(new Error('connection refused'));

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith('connection refused');
  });

  it('respects AbortSignal passed in', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream(['data: [DONE]'])),
    );

    const controller = new AbortController();
    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream(
      [{ role: 'user', content: 'hi' }],
      {},
      callbacks,
      controller.signal,
    );

    const callArgs = vi.mocked(fetch as any).mock.calls[0][1] as RequestInit;
    expect(callArgs.signal).toBe(controller.signal);
  });

  it('skips malformed SSE chunks without calling onError', async () => {
    const sseLines = [
      'data: {bad json}',
      'data: [DONE]',
    ];
    vi.mocked(fetch as any).mockResolvedValueOnce(
      makeMockFetchResponse(makeSseStream(sseLines)),
    );

    const callbacks = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await llmApi.chatStream([{ role: 'user', content: 'hi' }], {}, callbacks);

    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onDone).toHaveBeenCalledOnce();
  });
});
