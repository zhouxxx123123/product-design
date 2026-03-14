import { useState, useCallback } from 'react';
import http from '../services/http';
import type { InsightResponse, InsightExtractRequest } from '../types';

export interface InsightExtractState {
  isLoading: boolean;
  result: InsightResponse | null;
  error: string | null;
}

export function useInsightExtract() {
  const [state, setState] = useState<InsightExtractState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const extract = useCallback(async (dto: InsightExtractRequest) => {
    setState({ isLoading: true, result: null, error: null });
    try {
      const res = await http.post<InsightResponse>('/ai/insight/extract', dto);
      setState({ isLoading: false, result: res.data, error: null });
      return res.data;
    } catch (err) {
      const error = err instanceof Error ? err.message : '洞察提取失败';
      setState({ isLoading: false, result: null, error });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  return { ...state, extract, reset };
}
