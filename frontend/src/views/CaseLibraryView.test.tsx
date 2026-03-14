/**
 * frontend/src/views/CaseLibraryView.test.tsx
 *
 * Unit tests for CaseLibraryView.
 * casesApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/cases', () => ({
  casesApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import CaseLibraryView from './CaseLibraryView';
import { casesApi } from '../services/cases';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockCasesResponse = {
  data: {
    data: [
      {
        id: 'case-001',
        title: '跨境支付优化案例',
        industry: '金融',
        status: '已完成',
        tags: ['支付', 'B2B'],
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CaseLibraryView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CaseLibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(casesApi.list).mockResolvedValue(mockCasesResponse as any);
  });

  it('renders "案例库" heading', () => {
    renderView();
    expect(screen.getByText('案例库')).toBeTruthy();
  });

  it('renders case title after data loads', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('跨境支付优化案例')).toBeTruthy();
    });
  });

  it('"创建新案例" button opens modal', async () => {
    renderView();

    const createButton = screen.getByText('创建新案例');
    fireEvent.click(createButton);

    await waitFor(() => {
      // After clicking, a modal with an h2 heading should appear
      const headings = document.querySelectorAll('h2');
      const modalHeading = Array.from(headings).find(h => h.textContent?.includes('创建新案例'));
      expect(modalHeading).toBeTruthy();
    });
  });

  it('modal submit calls casesApi.create with correct payload', async () => {
    vi.mocked(casesApi.create).mockResolvedValue({
      data: {
        id: 'case-new',
        title: '新案例标题',
        status: '草稿',
        createdAt: new Date().toISOString(),
      },
    } as any);

    renderView();

    // Open modal
    fireEvent.click(screen.getByText('创建新案例'));

    await waitFor(() => {
      const headings = document.querySelectorAll('h2');
      const modalHeading = Array.from(headings).find(h => h.textContent?.includes('创建新案例'));
      expect(modalHeading).toBeTruthy();
    });

    // Fill in the title input
    const titleInput = screen.getByPlaceholderText('输入案例标题');
    fireEvent.change(titleInput, { target: { value: '新案例标题' } });

    // Fill in the required content field
    const contentInput = screen.getByPlaceholderText('描述案例的详细内容...');
    fireEvent.change(contentInput, { target: { value: '案例详细内容示例' } });

    // Click create button
    const submitButton = screen.getByText('创建案例');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(casesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: '新案例标题' }),
      );
    });
  });
});
