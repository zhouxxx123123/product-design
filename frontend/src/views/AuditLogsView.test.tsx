/**
 * frontend/src/views/AuditLogsView.test.tsx
 *
 * Unit tests for AuditLogsView.
 * auditLogsApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/audit-logs', () => ({
  auditLogsApi: {
    list: vi.fn(),
  },
}));

vi.mock('./AuditLogDetailPanel', () => ({
  default: () => <div data-testid="audit-detail-panel" />,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import AuditLogsView from './AuditLogsView';
import { auditLogsApi } from '../services/audit-logs';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockPaginatedLogs = {
  data: [
    {
      id: '1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'create' as const,
      entityType: 'Survey',
      entityId: 'entity-1',
      oldValues: null,
      newValues: { title: 'New Survey' },
      ipAddress: '127.0.0.1',
      userAgent: null,
      requestId: null,
      notes: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const mockAuditLogsApi = vi.mocked(auditLogsApi);

// ── Render helper ─────────────────────────────────────────────────────────────

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditLogsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogsApi.list = vi.fn().mockResolvedValue({ data: mockPaginatedLogs });
  });

  it('renders audit logs table', async () => {
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('user-1')).toBeInTheDocument();
    });
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.getByText('entity-1')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
  });

  it('renders page header', () => {
    renderWithQuery(<AuditLogsView />);
    expect(screen.getByText('审计日志')).toBeInTheDocument();
  });

  it('shows the filter bar', async () => {
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('从')).toBeInTheDocument();
      expect(screen.getByText('到')).toBeInTheDocument();
    });

    expect(screen.getByText('全部操作')).toBeInTheDocument();
  });

  it('expands detail panel when row expand button clicked', async () => {
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => screen.getByText('user-1'));

    // Find the expand button (ChevronRight button in the last column)
    const expandButtons = screen.getAllByRole('button');
    const expandBtn = expandButtons.find(btn => btn.querySelector('svg'));
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn!);

    await waitFor(() => {
      expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();
    });
  });

  it('collapses detail panel when expand button clicked again', async () => {
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => screen.getByText('user-1'));

    const expandButtons = screen.getAllByRole('button');
    const expandBtn = expandButtons.find(btn => btn.querySelector('svg'));

    // First click - expand
    fireEvent.click(expandBtn!);
    await waitFor(() => {
      expect(screen.getByTestId('audit-detail-panel')).toBeInTheDocument();
    });

    // Second click - collapse
    fireEvent.click(expandBtn!);
    await waitFor(() => {
      expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
    });
  });

  it('clears filters when clear button clicked', async () => {
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => screen.getByText('user-1'));

    // Set a filter to make the clear button appear
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'login' } });

    await waitFor(() => {
      expect(screen.getByText('清除筛选')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('清除筛选'));

    expect(select).toHaveValue('');
  });

  it('shows loading state when data is loading', () => {
    mockAuditLogsApi.list = vi.fn().mockImplementation(() => new Promise(() => {}));
    renderWithQuery(<AuditLogsView />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('shows empty state when no logs exist', async () => {
    mockAuditLogsApi.list = vi.fn().mockResolvedValue({ data: { ...mockPaginatedLogs, data: [] } });
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('暂无审计日志')).toBeInTheDocument();
    });
  });

  it('shows pagination when there are multiple pages', async () => {
    const multiPageData = {
      ...mockPaginatedLogs,
      totalPages: 3,
      page: 1,
    };
    mockAuditLogsApi.list = vi.fn().mockResolvedValue({ data: multiPageData });
    renderWithQuery(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getAllByText('第 1 页 / 共 3 页')).toHaveLength(2); // header + pagination
    });

    expect(screen.getByText('上一页')).toBeInTheDocument();
    expect(screen.getByText('下一页')).toBeInTheDocument();
  });
});