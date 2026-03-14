import http from './http';
import type { OutlineRequest, OutlineResponse } from '../types';

interface OptimizeOutlineDto extends OutlineRequest {
  feedback?: string;
}

export const outlineApi = {
  generate: (dto: OutlineRequest) =>
    http.post<OutlineResponse>('/ai/outline/generate', dto),

  optimize: (dto: OptimizeOutlineDto) =>
    http.post<OutlineResponse>('/ai/outline/optimize', dto),
};
