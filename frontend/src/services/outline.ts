import http from './http';
import type { OutlineRequest, OutlineResponse, OutlineSection } from '../types';

interface OptimizeOutlineDto {
  sessionId: string;
  existingOutline: OutlineSection[];  // Required, not optional
  clientBackground?: string;
  researchGoals?: string[];
  feedback?: string;
}

export const outlineApi = {
  generate: (dto: OutlineRequest) =>
    http.post<OutlineResponse>('/ai/outline/generate', dto),

  optimize: (dto: OptimizeOutlineDto) => {
    if (!dto.existingOutline || dto.existingOutline.length === 0) {
      return Promise.reject(new Error('optimize 需要传入非空的 existingOutline'));
    }
    return http.post<OutlineResponse>('/ai/outline/optimize', dto);
  },
};
