import { useState, useCallback, useRef } from 'react';
import { llmApi } from '../services/llm';
import type { ChatMessage, StreamStatus } from '../types';

export interface LLMChatState {
  status: StreamStatus;
  content: string;
  error: string | null;
}

interface SendOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function useLLMChat() {
  const [state, setState] = useState<LLMChatState>({
    status: 'idle',
    content: '',
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const send = useCallback(async (
    messages: ChatMessage[],
    options?: SendOptions,
  ) => {
    // Abort any in-flight stream before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ status: 'streaming', content: '', error: null });

    await llmApi.chatStream(
      messages,
      options ?? {},
      {
        onDelta: (delta) => {
          if (controller.signal.aborted) return;
          setState((prev) => ({ ...prev, content: prev.content + delta }));
        },
        onDone: () => {
          if (controller.signal.aborted) return;
          setState((prev) => ({ ...prev, status: 'done' }));
        },
        onError: (error) => {
          if (controller.signal.aborted) return;
          setState({ status: 'error', content: '', error });
        },
      },
      controller.signal,
    );
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({ status: 'idle', content: '', error: null });
  }, []);

  return { ...state, send, reset };
}
