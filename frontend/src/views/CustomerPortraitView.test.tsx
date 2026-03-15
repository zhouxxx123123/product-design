import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Hoisted mocks (available inside vi.mock factories) ─────────────────────────
const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock services
vi.mock('../services/clients', () => ({
  clientsApi: {
    get: vi.fn(),
  },
}));

vi.mock('../services/llm', () => ({
  llmApi: {
    chat: vi.fn(),
  },
}));

// Mock toastStore
// CustomerPortraitView calls useToastStore.getState().addToast() — static Zustand pattern.
// Use vi.hoisted so mockAddToast is available inside the factory.
vi.mock('../stores/toastStore', () => {
  const mockFn = vi.fn((selector?: (s: any) => any) => {
    const store = { addToast: mockAddToast };
    return typeof selector === 'function' ? selector(store) : store;
  }) as any;
  mockFn.getState = () => ({ addToast: mockAddToast });
  return { useToastStore: mockFn };
});

import CustomerPortraitView from './CustomerPortraitView';
import { clientsApi } from '../services/clients';
import { llmApi } from '../services/llm';

const mockClient = {
  id: 'c-001',
  companyName: '测试科技有限公司',
  industry: '金融科技',
  status: 'active',
  size: '100-500人',
  tags: ['重点客户'],
  contacts: [{ name: '张三', email: 'zhang@test.com', phone: '13800000001', position: '总监' }],
  website: 'https://test.com',
  address: '上海市',
  notes: '测试备注',
  lastInteraction: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPortraitJson = JSON.stringify({
  summary: "测试摘要：该客户具有强烈的数字化转型意愿",
  traits: [
    { label: "决策周期", level: 70, color: "indigo" },
    { label: "预算弹性", level: 55, color: "emerald" },
    { label: "技术接受度", level: 80, color: "amber" },
    { label: "合作意向", level: 90, color: "indigo" }
  ],
  needs: ["需求分析", "技术咨询", "实施支持"],
  risks: ["预算限制", "决策周期长"],
  score: 82
});

function renderView(customerId = 'c-001', onBack = vi.fn(), onViewChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CustomerPortraitView
          customerId={customerId}
          onBack={onBack}
          onViewChange={onViewChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerPortraitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.get).mockResolvedValue({ data: mockClient } as any);
  });

  it('应该加载并显示客户名称在标题中', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    expect(clientsApi.get).toHaveBeenCalledWith('c-001');
  });

  it('返回按钮应该调用onBack回调', async () => {
    const mockOnBack = vi.fn();
    renderView('c-001', mockOnBack);

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    // Find the button with ArrowLeft icon (the back button)
    const backButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg')
    );
    const backButton = backButtons[0]; // First button with icon should be the back button

    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('AI生成之前应该显示占位文本', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    expect(screen.getByText('点击「AI 生成画像」按钮开始分析')).toBeInTheDocument();
  });

  it('没有画像时点击导出PDF应该显示警告toast', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /导出 PDF/ });
    fireEvent.click(exportButton);

    expect(mockAddToast).toHaveBeenCalledWith('请先生成客户画像', 'warning');
  });

  it('没有画像时点击分享报告应该显示警告toast', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    const shareButton = screen.getByRole('button', { name: /分享报告/ });
    fireEvent.click(shareButton);

    expect(mockAddToast).toHaveBeenCalledWith('请先生成客户画像', 'warning');
  });

  it('点击AI生成画像按钮应该调用llmApi.chat', async () => {
    vi.mocked(llmApi.chat).mockResolvedValue({ content: mockPortraitJson } as any);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /AI 生成画像/ });
    fireEvent.click(generateButton);

    // Verify llmApi.chat was called
    expect(llmApi.chat).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(llmApi.chat).mock.calls[0];
    expect(callArgs[0]).toEqual([
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('基于以下客户信息生成深度客户画像')
      })
    ]);

    // After AI generation, the portrait summary should be displayed
    await waitFor(() => {
      expect(screen.getByText('测试摘要：该客户具有强烈的数字化转型意愿')).toBeInTheDocument();
    });
  });

  it('AI生成画像后应该显示画像内容和评分', async () => {
    vi.mocked(llmApi.chat).mockResolvedValue({ content: mockPortraitJson } as any);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司 - 深度客户画像')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /AI 生成画像/ });
    fireEvent.click(generateButton);

    await waitFor(() => {
      // Check portrait summary is displayed
      expect(screen.getByText('测试摘要：该客户具有强烈的数字化转型意愿')).toBeInTheDocument();
      // Check score is displayed
      expect(screen.getByText('82')).toBeInTheDocument();
      // Check needs are displayed — getAllByText handles duplicates (sidebar + main)
      expect(screen.getAllByText('技术咨询').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('实施支持').length).toBeGreaterThanOrEqual(1);
      // Check risks are displayed
      expect(screen.getByText('预算限制')).toBeInTheDocument();
      expect(screen.getByText('决策周期长')).toBeInTheDocument();
    });
  });
});