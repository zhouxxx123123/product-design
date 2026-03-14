/**
 * frontend/src/hooks/useLLMChat.test.ts
 *
 * Unit tests for useLLMChat hook.
 * llmApi.chatStream is mocked to control streaming behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/llm', () => ({
  llmApi: {
    chatStream: vi.fn(),
  },
}));

import { useLLMChat } from './useLLMChat';
import { llmApi } from '../services/llm';

// ── Helpers ───────────────────────────────────────────────────────────────────

type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
};

/** Returns a helper that lets tests drive the stream step by step. */
function makeControllableStream() {
  let capturedCallbacks: StreamCallbacks | null = null;
  let capturedSignal: AbortSignal | undefined;
  let resolveStream: () => void;

  const streamPromise = new Promise<void>((resolve) => {
    resolveStream = resolve;
  });

  vi.mocked(llmApi.chatStream).mockImplementation(
    async (_messages, _options, callbacks, signal) => {
      capturedCallbacks = callbacks;
      capturedSignal = signal;
      await streamPromise;
    },
  );

  return {
    emit: (delta: string) => capturedCallbacks?.onDelta(delta),
    done: () => {
      capturedCallbacks?.onDone();
      resolveStream!();
    },
    error: (msg: string) => {
      capturedCallbacks?.onError(msg);
      resolveStream!();
    },
    get signal() {
      return capturedSignal;
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useLLMChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useLLMChat());

    expect(result.current.status).toBe('idle');
    expect(result.current.content).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('transitions to streaming state after send()', async () => {
    const stream = makeControllableStream();
    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'hello' }]);
    });

    await waitFor(() => expect(result.current.status).toBe('streaming'));
    expect(result.current.content).toBe('');

    await act(async () => { stream.done(); });
  });

  it('accumulates content via onDelta callbacks', async () => {
    const stream = makeControllableStream();
    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'hi' }]);
    });

    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => stream.emit('Hello'));
    act(() => stream.emit(', World'));
    act(() => stream.done());

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.content).toBe('Hello, World');
  });

  it('transitions to done and keeps content', async () => {
    const stream = makeControllableStream();
    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'ping' }]);
    });
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => {
      stream.emit('pong');
      stream.done();
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.content).toBe('pong');
    expect(result.current.error).toBeNull();
  });

  it('transitions to error state on onError', async () => {
    const stream = makeControllableStream();
    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'oops' }]);
    });
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => stream.error('服务不可用'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('服务不可用');
    expect(result.current.content).toBe('');
  });

  it('reset() returns hook to idle state', async () => {
    const stream = makeControllableStream();
    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'hello' }]);
    });
    await waitFor(() => expect(result.current.status).toBe('streaming'));
    act(() => {
      stream.emit('partial');
      stream.done();
    });
    await waitFor(() => expect(result.current.status).toBe('done'));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.content).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('abort() via send() aborts in-flight stream and starts fresh', async () => {
    // First stream — never resolves on its own
    let firstCallbacks: StreamCallbacks | null = null;
    vi.mocked(llmApi.chatStream).mockImplementationOnce(
      (_messages, _options, callbacks) =>
        new Promise<void>((resolve) => {
          firstCallbacks = callbacks;
          // Never resolves by itself
          void resolve; // prevent lint warning
        }),
    );

    const { result } = renderHook(() => useLLMChat());

    act(() => {
      void result.current.send([{ role: 'user', content: 'first' }]);
    });
    await waitFor(() => expect(result.current.status).toBe('streaming'));
    act(() => firstCallbacks?.onDelta('partial text'));

    // Set up second stream mock
    const stream2 = makeControllableStream();

    // Sending again aborts the first stream
    act(() => {
      void result.current.send([{ role: 'user', content: 'second' }]);
    });
    await waitFor(() => expect(result.current.content).toBe('')); // fresh start
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => {
      stream2.emit('new response');
      stream2.done();
    });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.content).toBe('new response');
  });
});
