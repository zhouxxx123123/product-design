/**
 * frontend/src/services/asr.test.ts
 *
 * Unit tests for recognizeAudioFile.
 * fetch and useAuthStore are mocked globally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ accessToken: 'test-token' })),
  },
}));

import { recognizeAudioFile, type AsrResult } from './asr';
import { useAuthStore } from '../stores/authStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ASR_RESULT: AsrResult = {
  status: 'completed',
  duration: 12.5,
  segments: [
    {
      text: '你好，这是测试。',
      begin_time: 0,
      end_time: 2500,
      speaker_tag: 1,
      confidence: 0.95,
    },
  ],
};

function makeAudioFile(name = 'test.mp3', type = 'audio/mpeg', sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('recognizeAudioFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends POST to /api/v1/ai/asr/recognize with Authorization header', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ASR_RESULT),
    });

    await recognizeAudioFile(makeAudioFile());

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch as any).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/ai/asr/recognize');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('sends file in FormData body', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ASR_RESULT),
    });

    const file = makeAudioFile('audio.wav', 'audio/wav');
    await recognizeAudioFile(file);

    const [, init] = vi.mocked(fetch as any).mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const sentFile = form.get('file') as File;
    // FormData may wrap the File reference in jsdom; check identity by name
    expect(sentFile.name).toBe(file.name);
  });

  it('returns AsrResult on success', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ASR_RESULT),
    });

    const result = await recognizeAudioFile(makeAudioFile());

    expect(result).toEqual(MOCK_ASR_RESULT);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('你好，这是测试。');
  });

  it('throws on non-OK response', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: () => Promise.resolve('File too large'),
    });

    await expect(recognizeAudioFile(makeAudioFile())).rejects.toThrow(
      'ASR 识别失败 (422)',
    );
  });

  it('throws on network failure', async () => {
    vi.mocked(fetch as any).mockRejectedValueOnce(new Error('network error'));

    await expect(recognizeAudioFile(makeAudioFile())).rejects.toThrow(
      'network error',
    );
  });

  it('omits Authorization header when no token', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({ accessToken: null } as any);
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ASR_RESULT),
    });

    await recognizeAudioFile(makeAudioFile());

    const [, init] = vi.mocked(fetch as any).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('uses file.name when appending to FormData', async () => {
    vi.mocked(fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_ASR_RESULT),
    });

    const file = makeAudioFile('recording_2024.mp3');
    await recognizeAudioFile(file);

    const [, init] = vi.mocked(fetch as any).mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    const sentFile = form.get('file') as File;
    expect(sentFile.name).toBe('recording_2024.mp3');
  });
});
