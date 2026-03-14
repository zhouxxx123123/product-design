/**
 * frontend/src/views/SurveyWorkspaceView.test.tsx
 *
 * Unit tests for SurveyWorkspaceView.
 * useWorkspaceSession is mocked directly to isolate the view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ── Module mocks (must come before imports of mocked modules) ──────────────

vi.mock('../hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: vi.fn(),
}));

vi.mock('../services/outline', () => ({
  outlineApi: { generate: vi.fn() },
}));

vi.mock('../hooks/useInsightExtract', () => ({
  useInsightExtract: vi.fn(),
}));

vi.mock('../services/llm', () => ({
  llmApi: { chat: vi.fn() },
}));

vi.mock('../services/asr', () => ({
  recognizeAudioFile: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import SurveyWorkspaceView from './SurveyWorkspaceView';
import { useWorkspaceSession } from '../hooks/useWorkspaceSession';
import { useInsightExtract } from '../hooks/useInsightExtract';
import { outlineApi } from '../services/outline';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockSession = {
  id: 's-001',
  title: '测试访谈',
  status: 'in_progress' as const,
  clientId: 'c-1',
  interviewDate: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const defaultWorkspaceReturn = {
  session: mockSession,
  segments: [],
  isLoadingSession: false,
  isLoadingSegments: false,
  endSessionMutation: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  },
  persistSegments: vi.fn(),
};

const defaultInsightReturn = {
  isLoading: false,
  result: null,
  extract: vi.fn(),
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView(
  onBack = vi.fn(),
  onViewChange = vi.fn(),
  initialEntry = '/sessions/s-001',
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/sessions/:id"
            element={<SurveyWorkspaceView onBack={onBack} onViewChange={onViewChange} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SurveyWorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspaceSession).mockReturnValue(defaultWorkspaceReturn as any);
    vi.mocked(useInsightExtract).mockReturnValue(defaultInsightReturn as any);
    vi.mocked(outlineApi.generate).mockResolvedValue({ data: { sections: [] } } as any);
  });

  it('renders session title', () => {
    renderView();
    expect(screen.getByText('测试访谈')).toBeTruthy();
  });

  it('shows loading state when isLoadingSession is true', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      ...defaultWorkspaceReturn,
      session: undefined,
      isLoadingSession: true,
    } as any);

    renderView();
    expect(screen.getByText('加载中...')).toBeTruthy();
  });

  it('renders status badge for in_progress session', () => {
    renderView();
    expect(screen.getByText('进行中')).toBeTruthy();
  });

  it('"结束访谈" button calls endSessionMutation.mutateAsync then onBack', async () => {
    const onBack = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useWorkspaceSession).mockReturnValue({
      ...defaultWorkspaceReturn,
      endSessionMutation: { mutateAsync, isPending: false },
    } as any);

    renderView(onBack);

    const endButton = screen.getByText('结束访谈');
    fireEvent.click(endButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});
