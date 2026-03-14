/**
 * frontend/src/views/MemoryManagementView.test.tsx
 *
 * Unit tests for MemoryManagementView including memory list, search, deletion, and export.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock services
vi.mock('../services/memories', () => ({
  memoriesApi: {
    list: vi.fn(),
    deleteOne: vi.fn(),
    deleteAll: vi.fn(),
    export: vi.fn(),
  },
  MemoryType: {
    preference: 'preference',
    learning: 'learning',
    conversation: 'conversation',
    setting: 'setting',
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import MemoryManagementView from './MemoryManagementView';
import { memoriesApi } from '../services/memories';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockMemoriesResponse = {
  data: {
    data: [
      {
        id: 'm-001',
        type: 'preference' as const,
        content: '用户偏好使用简洁的界面设计',
        source: '用户反馈',
        createdAt: '2024-03-12 10:00:00',
        userId: 'u1',
        tenantId: 't1',
      },
      {
        id: 'm-002',
        type: 'learning' as const,
        content: '学会了如何使用AI生成调研问题',
        source: '系统学习',
        createdAt: '2024-03-11 15:30:00',
        userId: 'u1',
        tenantId: 't1',
      },
      {
        id: 'm-003',
        type: 'conversation' as const,
        content: '讨论了关于金融科技行业的调研方法',
        source: null,
        createdAt: '2024-03-10 09:15:00',
        userId: 'u1',
        tenantId: 't1',
      },
    ],
    total: 3,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

const mockExportResponse = {
  data: mockMemoriesResponse.data.data,
};

// Mock URL.createObjectURL and related DOM methods
const mockUrl = 'blob:mock-url';
window.URL.createObjectURL = vi.fn(() => mockUrl);
window.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for download
const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(),
};
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName) => {
  if (tagName === 'a') return mockAnchor as any;
  return originalCreateElement.call(document, tagName);
});

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MemoryManagementView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MemoryManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(memoriesApi.list).mockResolvedValue(mockMemoriesResponse as any);
  });

  it('renders "记忆管理" heading', () => {
    renderView();
    expect(screen.getByText('记忆管理')).toBeTruthy();
  });

  it('shows memory count after data loads', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('共 3 条记忆')).toBeTruthy();
    });
  });

  it('renders memory data after loading', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('用户偏好使用简洁的界面设计')).toBeTruthy();
      expect(screen.getByText('学会了如何使用AI生成调研问题')).toBeTruthy();
      expect(screen.getByText('讨论了关于金融科技行业的调研方法')).toBeTruthy();
    });
  });

  it('"清空全部" button shows confirm modal', async () => {
    renderView();

    const clearButton = screen.getByText('清空全部');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('清空全部记忆')).toBeTruthy();
      expect(screen.getByText(/这将删除您的所有 3 条记忆/)).toBeTruthy();
    });
  });

  it('confirm modal "确认清空" button calls memoriesApi.deleteAll', async () => {
    vi.mocked(memoriesApi.deleteAll).mockResolvedValue({ data: { success: true } } as any);
    renderView();

    // Open confirm modal
    fireEvent.click(screen.getByText('清空全部'));

    await waitFor(() => {
      expect(screen.getByText('清空全部记忆')).toBeTruthy();
    });

    // Click confirm
    const confirmButton = screen.getByText('确认清空');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(memoriesApi.deleteAll).toHaveBeenCalledTimes(1);
    });
  });

  it('"导出" button calls memoriesApi.export and downloads file', async () => {
    vi.mocked(memoriesApi.export).mockResolvedValue(mockExportResponse as any);
    renderView();

    const exportButton = screen.getByText('导出');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(memoriesApi.export).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockAnchor.download).toBe('memories.json');
      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });
  });

  it('search input filters memories', async () => {
    renderView();

    // Wait for memories to load
    await waitFor(() => {
      expect(screen.getByText('用户偏好使用简洁的界面设计')).toBeTruthy();
    });

    // Search for specific content
    const searchInput = screen.getByPlaceholderText('搜索记忆内容...');
    fireEvent.change(searchInput, { target: { value: 'AI生成' } });

    await waitFor(() => {
      expect(memoriesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'AI生成',
        })
      );
    });
  });

  it('type filter buttons call memoriesApi.list with correct type', async () => {
    renderView();

    // Click on "偏好记忆" filter button
    const preferenceButton = screen.getByText('偏好记忆');
    fireEvent.click(preferenceButton);

    await waitFor(() => {
      expect(memoriesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'preference',
        })
      );
    });
  });
});