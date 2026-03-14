import { useAuthStore } from '../stores/authStore';

export interface AsrSegment {
  text: string;
  begin_time: number;
  end_time: number;
  speaker_tag: number;
  confidence: number;
}

export interface AsrResult {
  status: 'completed' | 'partial';
  duration: number;
  segments: AsrSegment[];
}

/**
 * 上传音频文件进行 ASR 语音识别，经由 NestJS ai-proxy 转发到 AI 服务。
 * 使用 fetch 而非 axios，方便直接传 FormData（multipart/form-data）。
 */
export async function recognizeAudioFile(file: File): Promise<AsrResult> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append('file', file, file.name);

  const response = await fetch('/api/v1/ai/asr/recognize', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`ASR 识别失败 (${response.status}): ${text}`);
  }

  return response.json() as Promise<AsrResult>;
}
