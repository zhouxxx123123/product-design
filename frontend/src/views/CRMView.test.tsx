/**
 * frontend/src/views/CRMView.test.tsx
 *
 * Unit tests for CRMView.
 * clientsApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/clients', () => ({
  clientsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

// CRMView imports CustomerDetailView inside it, which also uses clientsApi
// If CustomerDetailView causes import errors, mock it:
vi.mock('./CustomerDetailView', () => ({
  default: () => <div data-testid="customer-detail-stub" />,
}));

// Mock toastStore
// CRMView calls useToastStore(s => s.addToast) — selector pattern.
// The mock must invoke the selector when one is provided.
const mockAddToast = vi.fn();
vi.mock('../stores/toastStore', () => ({
  useToastStore: vi.fn((selector?: (s: any) => any) => {
    const store = { addToast: mockAddToast };
    return typeof selector === 'function' ? selector(store) : store;
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import CRMView from './CRMView';
import { clientsApi } from '../services/clients';
import http from '../services/http';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockClientsResponse = {
  data: {
    data: [
      {
        id: 'c-001',
        companyName: '测试科技有限公司',
        industry: '金融科技',
        size: '100-500人',
        status: 'active',
        tags: ['重点客户'],
        contacts: [{ name: '张三', email: 'zhang@test.com', phone: '13800000001' }],
        lastInteraction: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView(onViewChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CRMView onViewChange={onViewChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CRMView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.list).mockResolvedValue(mockClientsResponse as any);

    // Mock dictionary API calls (returns empty array for fallback options)
    vi.mocked(http.get).mockResolvedValue({ data: [] } as any);
  });

  it('renders "客户档案" heading', () => {
    renderView();
    expect(screen.getByText('客户档案')).toBeTruthy();
  });

  it('renders client data after loading', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('测试科技有限公司')).toBeTruthy();
    });
  });

  it('calls clientsApi.list with search parameter when search input changes', async () => {
    renderView();

    const searchInput = screen.getByPlaceholderText('搜索公司名称、行业或联系人...');
    fireEvent.change(searchInput, { target: { value: '科技' } });

    await waitFor(() => {
      expect(clientsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '科技',
        })
      );
    });
  });

  it('"创建客户档案" button opens modal', async () => {
    renderView();

    const addButton = screen.getByText('创建客户档案');
    fireEvent.click(addButton);

    await waitFor(() => {
      // Modal heading — there are two "创建客户档案" texts (button + modal h2)
      const headings = screen.getAllByText('创建客户档案');
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('form submit calls clientsApi.create with correct payload', async () => {
    vi.mocked(clientsApi.create).mockResolvedValue({
      data: {
        id: 'c-new',
        companyName: '新测试公司',
        industry: '金融科技',
        status: 'potential',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as any);

    renderView();

    // Open modal
    fireEvent.click(screen.getByText('创建客户档案'));

    await waitFor(() => {
      expect(screen.getAllByText('创建客户档案').length).toBeGreaterThanOrEqual(2);
    });

    // Check if modal form is present
    await waitFor(() => {
      expect(screen.getByPlaceholderText('例如: 北京中科琉光科技有限公司')).toBeInTheDocument();
    });

    // Fill in company name
    const companyNameInput = screen.getByPlaceholderText('例如: 北京中科琉光科技有限公司');
    fireEvent.change(companyNameInput, { target: { value: '新测试公司' } });

    // Instead of trying to select an industry, just submit the form with default values
    // The test should expect industry to be empty string or undefined since no industry was selected
    const submitButton = screen.getByText('保存档案');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(clientsApi.create).toHaveBeenCalled();
      const callArg = vi.mocked(clientsApi.create).mock.calls[0][0] as any;
      expect(callArg.companyName).toBe('新测试公司');
      // Expect empty industry since no selection was made
      expect(callArg.industry).toBeUndefined();
      expect(callArg.status).toBe('potential');
    });
  });
});