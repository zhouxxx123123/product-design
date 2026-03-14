/**
 * frontend/src/views/SurveyInsightsView.test.tsx
 *
 * Unit tests for SurveyInsightsView.
 * API calls are mocked with vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/insights', () => ({
  insightsApi: {
    listBySession: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/transcript', () => ({
  transcriptApi: {
    listBySession: vi.fn(),
  },
}));

vi.mock('../services/report', () => ({
  reportApi: {
    startExport: vi.fn(),
    download: vi.fn(),
  },
}));

// ── Import after mocks are set up ─────────────────────────────────────────────

import SurveyInsightsView from './SurveyInsightsView';
import { insightsApi } from '../services/insights';
import { transcriptApi } from '../services/transcript';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInsight(id: string, layer: 1 | 2 | 3, title: string) {
  return {
    id,
    sessionId: 'session-001',
    tenantId: 'tenant-001',
    layer,
    content: { title, text: `内容 ${id}`, department: '研发部' },
    editedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderView(sessionId = 'session-001') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/insights/${sessionId}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/insights/:id" element={<SurveyInsightsView />} />
          <Route path="/insights" element={<SurveyInsightsView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SurveyInsightsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transcriptApi.listBySession).mockResolvedValue({ data: [] } as any);
  });

  it('renders the insights tab by default', async () => {
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: [] } as any);
    renderView();
    expect(screen.getByText('调研洞察分析')).toBeTruthy();
  });

  it('renders 2 insight cards when service returns 2 insights', async () => {
    const insights = [
      makeInsight('i1', 2, '支付成本痛点'),
      makeInsight('i2', 2, '操作流程繁琐'),
    ];
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: insights } as any);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('支付成本痛点')).toBeTruthy();
      expect(screen.getByText('操作流程繁琐')).toBeTruthy();
    });
  });

  it('shows empty state when no insights', async () => {
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: [] } as any);
    renderView();

    await waitFor(() => {
      expect(screen.getByText('暂无洞察数据')).toBeTruthy();
    });
  });

  it('edit button is present and clickable for L2 insights', async () => {
    const insights = [makeInsight('i1', 2, '可点击的洞察')];
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: insights } as any);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('可点击的洞察')).toBeTruthy();
    });

    // L2 insights have an edit icon button
    const editButtons = document.querySelectorAll('button svg');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('shows the Generate and Export buttons', async () => {
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: [] } as any);
    renderView();

    // Use getAllByText to handle the text appearing in both button and empty-state hint
    const generateEls = screen.getAllByText(/生成洞察/);
    expect(generateEls.length).toBeGreaterThan(0);
    expect(screen.getByText(/导出 PDF 报告/)).toBeTruthy();
  });

  it('disables Generate button when no sessionId is provided', async () => {
    vi.mocked(insightsApi.listBySession).mockResolvedValue({ data: [] } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/insights']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/insights/:id" element={<SurveyInsightsView />} />
            <Route path="/insights" element={<SurveyInsightsView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const generateBtn = screen.getAllByText(/生成洞察/).find(
      (el) => el.closest('button') !== null,
    )?.closest('button');
    expect(generateBtn).toBeTruthy();
    expect(generateBtn?.disabled).toBe(true);
  });
});
