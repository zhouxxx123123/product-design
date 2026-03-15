import http from './http';

export interface OutlineSection {
  id: string;
  title: string;
  questions: string[];
  notes?: string;
}

export interface OutlineData {
  title: string;
  sections: OutlineSection[];
  estimatedDuration?: string;
}

export interface GenerateOutlineDto {
  sessionId: string;
  researchGoals?: string[];
  clientBackground?: string;
}

export interface OptimizeOutlineDto {
  sessionId: string;
  existingOutline: OutlineSection[];
  feedback?: string;
}

interface OutlineRequest {
  sessionId: string;
  clientBackground?: string;
  researchGoals?: string[];
  existingOutline?: OutlineSection[];
}

interface OutlineResponse {
  sections: OutlineSection[];
  generatedAt: string;
}

export const outlineApi = {
  generate: (dto: GenerateOutlineDto) =>
    http.post<OutlineResponse>('/ai/outline/generate', dto),

  optimize: (dto: OptimizeOutlineDto) => {
    if (!dto.existingOutline || dto.existingOutline.length === 0) {
      return Promise.reject(new Error('optimize 需要传入非空的 existingOutline'));
    }
    return http.post<OutlineResponse>('/ai/outline/optimize', dto);
  },
};
