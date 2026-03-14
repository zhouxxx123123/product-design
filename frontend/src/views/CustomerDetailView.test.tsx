import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock dayjs
vi.mock('dayjs', () => {
  const dayjs = vi.fn((_date?: any) => {
    const mockDayjs = {
      fromNow: () => '2小时前',
      toLocaleDateString: () => '2024/1/1',
    };
    return mockDayjs;
  }) as any;
  dayjs.extend = vi.fn();
  dayjs.locale = vi.fn();
  return { default: dayjs };
});

// Mock authStore
vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh-token',
      user: { id: '1', name: 'Test User' },
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    })),
  },
}));

vi.mock('../services/clients', () => ({
  clientsApi: { get: vi.fn(), update: vi.fn(), list: vi.fn() },
}));
vi.mock('../services/sessions', () => ({
  sessionsApi: { list: vi.fn() },
}));
vi.mock('../services/cases', () => ({
  casesApi: { list: vi.fn() },
}));

// Mock http service for dictionary API calls
vi.mock('../services/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
// CustomerDetailView calls useToastStore(s => s.addToast) — selector pattern.
vi.mock('../stores/toastStore', () => ({
  useToastStore: vi.fn((selector?: (s: any) => any) => {
    const store = { addToast: vi.fn() };
    return typeof selector === 'function' ? selector(store) : store;
  }),
}));

import CustomerDetailView from './CustomerDetailView';
import { clientsApi } from '../services/clients';
import { sessionsApi } from '../services/sessions';
import { casesApi } from '../services/cases';
import { useToastStore } from '../stores/toastStore';
import http from '../services/http';

const mockClient = {
  id: 'c-001',
  companyName: '测试科技有限公司',
  industry: '金融科技',
  size: '100-500人',
  status: 'active',
  tags: ['重点客户'],
  contacts: [{ name: '张三', email: 'zhang@test.com', phone: '13800000001', title: '总监' }],
  website: 'https://test.com',
  address: '上海市',
  notes: '测试备注',
  lastInteraction: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSessionsResponse = {
  data: {
    data: [
      {
        id: 's-001',
        title: '测试调研会话',
        clientId: 'c-001',
        status: 'completed',
        interviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1, page: 1, limit: 20, totalPages: 1,
  },
};

const mockCasesResponse = {
  data: {
    data: [
      {
        id: 'case-001',
        title: '测试案例',
        industry: '金融科技',
        clientBackground: '测试科技有限公司的客户背景',
        status: 'published',
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1, page: 1, limit: 20, totalPages: 1,
  },
};

const mockAddToast = vi.fn();

function renderView(customerId = 'c-001') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CustomerDetailView
          customerId={customerId}
          onBack={vi.fn()}
          onViewChange={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.get).mockResolvedValue({ data: mockClient } as any);
    vi.mocked(sessionsApi.list).mockResolvedValue(mockSessionsResponse as any);
    vi.mocked(casesApi.list).mockResolvedValue(mockCasesResponse as any);
    vi.mocked(useToastStore).mockImplementation((selector?: any) => {
      const store = { addToast: mockAddToast };
      return typeof selector === 'function' ? selector(store) : store;
    });

    // Mock dictionary API calls (returns empty array for fallback options)
    vi.mocked(http.get).mockResolvedValue({ data: [] } as any);
  });

  it('应该加载并显示客户名称', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeInTheDocument();
    });

    expect(clientsApi.get).toHaveBeenCalledWith('c-001');
  });

  it('应该显示客户状态为活跃客户', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('活跃客户')).toBeInTheDocument();
    });
  });

  it('应该能够切换到调研记录Tab并显示会话列表', async () => {
    renderView();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeInTheDocument();
    });

    // 点击调研记录Tab
    const surveysTab = screen.getByRole('button', { name: /调研记录/ });
    fireEvent.click(surveysTab);

    // 验证调研会话显示
    await waitFor(() => {
      expect(screen.getByText('测试调研会话')).toBeInTheDocument();
    });

    expect(sessionsApi.list).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      clientId: 'c-001'
    });
  });

  it('应该能够切换到关联案例Tab并显示案例内容', async () => {
    renderView();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeInTheDocument();
    });

    // 点击关联案例Tab
    const casesTab = screen.getByRole('button', { name: /关联案例/ });
    fireEvent.click(casesTab);

    // 验证案例内容显示
    await waitFor(() => {
      expect(screen.getByText('测试案例')).toBeInTheDocument();
    });

    expect(casesApi.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20
    });
  });

  it('应该能够打开编辑档案Modal', async () => {
    renderView();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeInTheDocument();
    });

    // 点击编辑档案按钮
    const editButton = screen.getByRole('button', { name: /编辑档案/ });
    fireEvent.click(editButton);

    // 验证Modal出现
    await waitFor(() => {
      expect(screen.getByText('编辑客户档案')).toBeInTheDocument();
      expect(screen.getByDisplayValue('测试科技有限公司')).toBeInTheDocument();
    });
  });

  it('应该能够提交编辑表单并调用更新API', async () => {
    vi.mocked(clientsApi.update).mockResolvedValue({ data: mockClient } as any);

    renderView();

    // 等待数据加载完成
    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeInTheDocument();
    });

    // 打开编辑Modal
    const editButton = screen.getByRole('button', { name: /编辑档案/ });
    fireEvent.click(editButton);

    // 等待Modal打开
    await waitFor(() => {
      expect(screen.getByText('编辑客户档案')).toBeInTheDocument();
    });

    // 修改公司名称
    const companyNameInput = screen.getByDisplayValue('测试科技有限公司');
    fireEvent.change(companyNameInput, { target: { value: '新测试公司' } });

    // 提交表单
    const submitButton = screen.getByRole('button', { name: /更新档案/ });
    fireEvent.click(submitButton);

    // 验证API调用
    await waitFor(() => {
      expect(clientsApi.update).toHaveBeenCalledWith('c-001', expect.objectContaining({
        companyName: '新测试公司',
        contacts: expect.arrayContaining([
          expect.objectContaining({
            name: '张三',
            title: '总监',
            email: 'zhang@test.com',
            phone: '13800000001',
          })
        ]),
      }));
    });
  });
});