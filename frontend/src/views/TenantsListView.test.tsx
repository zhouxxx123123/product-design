/**
 * frontend/src/views/TenantsListView.test.tsx
 *
 * Unit tests for TenantsListView.
 * tenantsApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/tenants', () => ({
  tenantsApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

vi.mock('./TenantFormModal', () => ({
  default: () => <div data-testid="tenant-form-modal" />,
}));

vi.mock('./TenantMembersDrawer', () => ({
  default: () => <div data-testid="tenant-members-drawer" />,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import TenantsListView from './TenantsListView';
import { tenantsApi } from '../services/tenants';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockPaginatedTenants = {
  data: [
    {
      id: '1',
      name: 'Test Corp',
      slug: 'test-corp',
      aiConfig: { provider: 'moonshot', model: 'moonshot-v1-8k', temperature: 0.7 },
      settings: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const mockTenantsApi = vi.mocked(tenantsApi);

// ── Render helper ─────────────────────────────────────────────────────────────

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TenantsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantsApi.list = vi.fn().mockResolvedValue({ data: mockPaginatedTenants });
  });

  it('renders loading state initially', () => {
    mockTenantsApi.list = vi.fn().mockImplementation(() => new Promise(() => {}));
    renderWithQuery(<TenantsListView />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders tenant list after loading', async () => {
    renderWithQuery(<TenantsListView />);
    await waitFor(() => {
      expect(screen.getByText('Test Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('test-corp')).toBeInTheDocument();
  });

  it('renders the new tenant button', async () => {
    renderWithQuery(<TenantsListView />);
    await waitFor(() => {
      expect(screen.getByText('新建租户')).toBeInTheDocument();
    });
  });

  it('shows search input', async () => {
    renderWithQuery(<TenantsListView />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索租户...')).toBeInTheDocument();
    });
  });

  it('calls delete with confirmation when delete button clicked', async () => {
    mockTenantsApi.delete = vi.fn().mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithQuery(<TenantsListView />);

    await waitFor(() => screen.getByText('Test Corp'));
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('确认删除租户「Test Corp」？此操作不可撤销。');
    await waitFor(() => {
      expect(mockTenantsApi.delete).toHaveBeenCalledWith('1');
    });
  });

  it('does not call delete when confirmation is cancelled', async () => {
    mockTenantsApi.delete = vi.fn().mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithQuery(<TenantsListView />);

    await waitFor(() => screen.getByText('Test Corp'));
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockTenantsApi.delete).not.toHaveBeenCalled();
  });

  it('shows page header with tenant count', async () => {
    renderWithQuery(<TenantsListView />);

    await waitFor(() => {
      expect(screen.getByText('租户管理')).toBeInTheDocument();
      expect(screen.getByText('共 1 个租户')).toBeInTheDocument();
    });
  });
});