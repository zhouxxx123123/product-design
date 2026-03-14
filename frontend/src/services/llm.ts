import http from './http';
import { useAuthStore } from '../stores/authStore';
import type { ChatMessage, ChatResponse } from '../types';

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  systemPrompt?: string;
}

interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

interface StreamChunkParsed {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
  }>;
}

const SYSTEM_PROMPT = '你是 OpenClaw Copilot，中科琉光调研工具的 AI 助手。请用中文回复。';

export const llmApi = {
  /**
   * Non-streaming chat request via axios http client.
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const systemContent = options.systemPrompt ?? SYSTEM_PROMPT;
    const res = await http.post<ChatResponse>('/ai/llm/chat', {
      messages: [
        { role: 'system', content: systemContent },
        ...messages,
      ],
      model: options.model ?? 'moonshot-v1-8k',
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });
    return res.data;
  },

  /**
   * Streaming chat request using fetch + ReadableStream.
   * The NestJS backend proxies SSE from the Python AI service.
   * Pass an AbortSignal to cancel the stream and close the connection.
   */
  async chatStream(
    messages: ChatMessage[],
    options: ChatOptions = {},
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = useAuthStore.getState().accessToken;

    let response: Response;
    try {
      response = await fetch('/api/v1/ai/llm/chat/stream', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
          ],
          model: options.model ?? 'moonshot-v1-8k',
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err.message : '网络连接失败');
      return;
    }

    if (!response.ok || !response.body) {
      callbacks.onError(`请求失败 (${response.status})`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const reading = true;

    try {
      while (reading) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data) as StreamChunkParsed;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) callbacks.onDelta(delta);
            if (parsed.choices?.[0]?.finish_reason === 'stop') {
              callbacks.onDone();
              return;
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      callbacks.onDone();
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : '流读取失败');
    }
  },
};
