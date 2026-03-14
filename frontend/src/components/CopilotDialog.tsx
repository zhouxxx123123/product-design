/**
 * CopilotDialog — floating AI assistant with SSE streaming and tool-call support.
 *
 * SSE stream events handled:
 *   - `data: {...choices...}` — plain text delta
 *   - `event: tool_call\ndata: {...}` — structured ToolCall payload
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, X, Send, Mic, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../stores/authStore';
import type {
  CopilotMessage,
  ComponentSchema,
  ToolCall,
  ToolCallState,
} from '../types/copilot';
import ComponentRenderer from './copilot/ComponentRenderer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Markdown detection ──

function hasMarkdown(text: string): boolean {
  return /^#{1,6}\s|\*\*.+?\*\*|^[*-]\s|^\d+\.\s|`[^`]+`|^>\s|\[.+?\]\(.+?\)|^\|.+\|/m.test(
    text,
  );
}

// ── Message text renderer ──

const MessageContent: React.FC<{ message: CopilotMessage }> = ({ message }) => {
  if (!message.content) return null;

  if (message.role === 'user' || !hasMarkdown(message.content)) {
    return <div className="whitespace-pre-line">{message.content}</div>;
  }

  return (
    <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded prose-a:text-indigo-600">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
};

// ── History compression ──

function compressHistory(msgs: CopilotMessage[]): CopilotMessage[] {
  const MAX = 20;
  if (msgs.length <= MAX) return msgs;
  const sys = msgs.filter((m) => m.role === 'system');
  const rest = msgs.filter((m) => m.role !== 'system').slice(-(MAX - sys.length));
  return [...sys, ...rest];
}

// ── SSE parser types ──

interface SseBlock {
  event: string | null;
  data: string;
}

/** Parse a buffer chunk into complete SSE message blocks. Returns blocks + leftover. */
function parseSseBuffer(buffer: string): { blocks: SseBlock[]; remainder: string } {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  const blocks = parts
    .map((part): SseBlock => {
      const lines = part.split('\n');
      let event: string | null = null;
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          data = line.slice(6).trim();
        }
      }
      return { event, data };
    })
    .filter((b) => b.data !== '');
  return { blocks, remainder };
}

// ── CopilotDialog ──

const CopilotDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInput, setLastInput] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content:
        '你好！我是 OpenClaw 智能助手。我可以帮你：\n• 创建调研会话\n• 搜索案例库\n• 分析客户数据\n• 生成调研报告\n\n请告诉我你需要什么帮助？',
      type: 'text',
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Message state helpers ──

  const updateMessage = useCallback(
    (id: string, patch: Partial<CopilotMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  // ── Tool call execution ──

  const executeToolCall = useCallback(
    async (
      messageId: string,
      toolCall: ToolCall,
      formData?: Record<string, unknown>,
    ): Promise<void> => {
      const { component } = toolCall;

      // Display-only components don't need an API call
      if (
        component.type === 'search_results' ||
        component.type === 'nav_button' ||
        component.type === 'result_card'
      ) {
        updateMessage(messageId, { toolCallState: 'done' });
        return;
      }

      updateMessage(messageId, { toolCallState: 'executing' });

      const token = useAuthStore.getState().accessToken;

      try {
        // Parse action string, e.g. "POST /api/v1/sessions"
        const actionStr =
          'action' in component ? (component as { action: string }).action : '';
        const [method, ...pathParts] = actionStr.trim().split(' ');
        const path = pathParts.join(' ');

        const baseData =
          'data' in component
            ? (component as { data?: Record<string, unknown> }).data ?? {}
            : {};
        const payload = { ...baseData, ...(formData ?? {}) };

        const response = await fetch(path, {
          method: method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = (await response.json()) as Record<string, unknown>;
        updateMessage(messageId, {
          toolCallState: 'done',
          toolCallResult: result,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '执行失败';
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'system',
            content: `操作失败：${errMsg}`,
            type: 'text',
          },
        ]);
        updateMessage(messageId, { toolCallState: 'pending' });
      }
    },
    [updateMessage],
  );

  const cancelToolCall = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { toolCallState: 'cancelled' });
    },
    [updateMessage],
  );

  // ── Background component generation ──

  const triggerComponentGeneration = useCallback(
    async (messageId: string, description: string): Promise<void> => {
      const token = useAuthStore.getState().accessToken;
      try {
        const response = await fetch('/api/v1/ai/component/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ description }),
        });

        if (!response.ok) return;

        const schema = (await response.json()) as ComponentSchema;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId || !m.toolCall) return m;
            const component = m.toolCall.component;
            if (component.type !== 'generated') return m;
            return {
              ...m,
              toolCall: {
                ...m.toolCall,
                component: { ...component, schema },
              },
            };
          }),
        );
      } catch {
        // Generation failure is non-fatal; component stays in loading state
      }
    },
    [],
  );

  // ── Send handler ──

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: '请先登录后再使用 AI 助手。',
          type: 'text',
        },
      ]);
      return;
    }

    const inputValue = input;
    setLastInput(inputValue);

    const userMessage: CopilotMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      type: 'text',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const aiMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, role: 'ai', content: '', type: 'text' },
    ]);

    try {
      const response = await fetch('/api/v1/ai/llm/chat/copilot/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'moonshot-v1-8k',
          messages: compressHistory([
            ...messages.filter((m) => m.role !== 'system'),
            { id: 'current-user', role: 'user', content: inputValue, type: 'text' },
          ]).map((m) => ({
            role: m.role === 'ai' ? ('assistant' as const) : (m.role as 'user' | 'assistant'),
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const reading = true;

      while (reading) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { blocks, remainder } = parseSseBuffer(buffer);
        buffer = remainder;

        for (const block of blocks) {
          if (block.data === '[DONE]') break;

          if (block.event === 'tool_call') {
            // Structured tool call event
            try {
              const payload = JSON.parse(block.data) as {
                tool_call: ToolCall;
              };
              const toolCall = payload.tool_call;
              const companionText = toolCall.text ?? '';

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        type: 'tool_call' as const,
                        content: companionText,
                        toolCall,
                        toolCallState: 'pending' as ToolCallState,
                      }
                    : m,
                ),
              );

              // Auto-execute low-risk tool calls
              if (toolCall.risk === 'low') {
                void executeToolCall(aiMessageId, toolCall);
              }

              // Background generation for 'generated' components
              if (toolCall.component.type === 'generated') {
                void triggerComponentGeneration(
                  aiMessageId,
                  toolCall.component.description,
                );
              }
            } catch {
              // Malformed tool_call payload; ignore
            }
          } else {
            // Plain text delta
            try {
              const parsed = JSON.parse(block.data) as {
                choices?: Array<{
                  delta?: { content?: string };
                  finish_reason?: string;
                }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                );
              }
            } catch {
              // Malformed JSON; skip
            }
          }
        }
      }
    } catch {
      const errorMsg: CopilotMessage = {
        id: aiMessageId,
        role: 'ai',
        content: '请求失败，请检查网络连接。',
        type: 'text',
      };
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== aiMessageId),
        errorMsg,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Render ──

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <div className="relative">
              <Bot className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-600 animate-pulse" />
            </div>
            <span className="font-bold">OpenClaw</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Dialog */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            />

            {/* Dialog Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-6 right-6 z-50 w-[420px] h-[620px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">OpenClaw 助手</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-xs text-white/80">在线</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    {message.role !== 'user' && (
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[85%] text-sm',
                        message.type === 'tool_call'
                          ? 'w-full'
                          : cn(
                              'p-3 rounded-2xl',
                              message.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-md'
                                : message.role === 'system'
                                  ? 'bg-white border border-slate-200 text-slate-600 rounded-bl-md'
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm',
                            ),
                      )}
                    >
                      {message.type === 'tool_call' && message.toolCall ? (
                        <div className="space-y-2">
                          {message.content && (
                            <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-md shadow-sm text-slate-800">
                              <MessageContent message={message} />
                            </div>
                          )}
                          <ComponentRenderer
                            toolCall={message.toolCall}
                            state={message.toolCallState ?? 'pending'}
                            onConfirm={(formData) =>
                              void executeToolCall(
                                message.id,
                                message.toolCall!,
                                formData,
                              )
                            }
                            onCancel={() => cancelToolCall(message.id)}
                          />
                        </div>
                      ) : (
                        <>
                          <MessageContent message={message} />
                          {message.role === 'ai' &&
                            message.content.includes('请求失败') &&
                            lastInput && (
                              <button
                                onClick={() => {
                                  setInput(lastInput);
                                  setLastInput(null);
                                }}
                                className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                              >
                                点击重试
                              </button>
                            )}
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-md shadow-sm">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入指令或问题..."
                      className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <button
                      disabled
                      title="语音输入即将上线"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-300 cursor-not-allowed"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || isProcessing}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  按 Enter 发送，Shift+Enter 换行
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default CopilotDialog;
