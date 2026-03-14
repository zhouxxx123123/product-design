const AI_BASE_URL = 'http://10.0.2.2:8000/api/v1';

export interface AsrSegment {
  text: string;
  begin_time: number;
  end_time: number;
  speaker_tag: number;
}

export interface AsrResponse {
  segments: AsrSegment[];
}

export const asrApi = {
  recognizeFile: async (filePath: string, filename: string): Promise<AsrResponse> => {
    const formData = new FormData();
    formData.append('file', {
      uri: filePath,
      name: filename,
      type: 'audio/m4a',
    } as unknown as Blob);

    const response = await fetch(`${AI_BASE_URL}/asr/recognize/file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ASR request failed with status ${response.status}`);
    }

    return response.json() as Promise<AsrResponse>;
  },
};
