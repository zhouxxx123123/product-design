/**
 * useRealtimeASR
 *
 * 实时语音识别 hook：
 * - getUserMedia 获取麦克风流
 * - 通过 WebSocket 连接 Python ASR 服务（经 Vite proxy /ws-ai/stream）
 * - MediaRecorder 每 2 秒触发 ondataavailable，将音频块发送到 WS
 * - 服务端累积 ~3 秒缓冲后返回识别结果，通过 onSegment 回调传递给调用方
 */

import { useCallback, useRef, useState } from 'react';

export interface AsrSegment {
  text: string;
  is_final: boolean;
  begin_time: number;
  end_time: number;
}

export interface UseRealtimeASROptions {
  onSegment: (seg: AsrSegment) => void;
  onError?: (msg: string) => void;
}

export interface UseRealtimeASRResult {
  isRecording: boolean;
  recordingSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

// MediaRecorder 采样间隔（ms）— 每 2 秒发送一个音频块
const SLICE_MS = 2000;

// 停止录音后等待最后一批数据发送完成，再关闭 WS
const STOP_DRAIN_DELAY_MS = 300;

export function useRealtimeASR(options: UseRealtimeASROptions): UseRealtimeASRResult {
  const { onSegment, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    // 1. 获取麦克风权限
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError?.('无法访问麦克风，请检查浏览器权限');
      return;
    }
    streamRef.current = stream;

    // 2. 建立 WebSocket 连接
    // 浏览器直连 Python（绕过 Vite proxy），这样浏览器会自动带 Origin 头，
    // 避免 Starlette CORSMiddleware 对无 Origin 请求返回 403。
    const aiPort = import.meta.env.VITE_AI_PORT ?? '8000';
    const wsUrl = `ws://${location.hostname}:${aiPort}/api/v1/asr/stream`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      // 3. WS 连接建立后启动 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
          const buffer = await e.data.arrayBuffer();
          ws.send(buffer);
        } catch {
          // WS may have closed between readyState check and send; ignore
        }
      };

      mediaRecorder.start(SLICE_MS);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    };

    // 4. 接收识别结果
    ws.onmessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
        const msg = JSON.parse(data) as AsrSegment & { status?: string };
        // 标准化：服务端用 status:"final"/"partial" 或 is_final: boolean
        const seg: AsrSegment = {
          text: msg.text ?? '',
          is_final: msg.is_final ?? msg.status === 'final',
          begin_time: msg.begin_time ?? 0,
          end_time: msg.end_time ?? 0,
        };
        onSegment(seg);
      } catch {
        // 忽略无法解析的消息（如 "pong"）
      }
    };

    ws.onerror = () => {
      onError?.('语音识别服务连接失败，请检查 AI 服务是否启动');
      cleanup();
      setIsRecording(false);
      setRecordingSeconds(0);
    };

    ws.onclose = () => {
      cleanup();
      setIsRecording(false);
    };
  }, [isRecording, onError, onSegment, cleanup]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    // 停止计时
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 停止 MediaRecorder（会触发最后一次 ondataavailable）
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }

    // 停止麦克风轨道
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;

    // 等最后一批数据发送完毕再关 WS
    const ws = wsRef.current;
    if (ws) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'recording stopped');
        }
        wsRef.current = null;
      }, STOP_DRAIN_DELAY_MS);
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  }, [isRecording]);

  return { isRecording, recordingSeconds, startRecording, stopRecording };
}
