/**
 * frontend/src/views/AdminDictionaryView.test.tsx
 *
 * Unit tests for AdminDictionaryView.
 * dictionaryApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/dictionary', () => ({
  dictionaryApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import AdminDictionaryView from './AdminDictionaryView';
import { dictionaryApi } from '../services/dictionary';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockDictionaryNodes = [
  {
    id: 'dict-001',
    tenantId: 't-1',
    name: '金融科技',
    code: 'fintech',
    parentId: null,
    level: 1,
    description: '金融科技领域',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dict-002',
    tenantId: 't-1',
    name: '支付系统',
    code: 'payment',
    parentId: 'dict-001',
    level: 2,
    description: '支付相关系统',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockDictionaryResponse = {
  data: mockDictionaryNodes,
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDictionaryView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminDictionaryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dictionaryApi.list).mockResolvedValue(mockDictionaryResponse as any);
  });

  it('renders "数据字典管理" heading', () => {
    renderView();
    expect(screen.getByText('数据字典管理')).toBeTruthy();
  });

  it('renders root nodes in tree structure after loading', async () => {
    renderView();

    // Only root nodes are shown by default (children require expanding parent)
    await waitFor(() => {
      expect(screen.getByText('金融科技')).toBeTruthy();
    });
  });

  it('shows loading skeletons when loading', () => {
    vi.mocked(dictionaryApi.list).mockReturnValue(new Promise(() => {})); // Never resolves
    renderView();

    // Check for skeleton loading indicators
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('"新增顶级领域" button calls dictionaryApi.create with correct payload', async () => {
    vi.mocked(dictionaryApi.create).mockResolvedValue({ data: {} } as any);

    renderView();

    // Wait for initial load
    await waitFor(() => expect(screen.getByText('金融科技')).toBeTruthy());

    fireEvent.click(screen.getByText('新增顶级领域'));

    await waitFor(() => {
      expect(dictionaryApi.create).toHaveBeenCalledTimes(1);
      // React Query may pass additional context as second arg — check first arg only
      expect(vi.mocked(dictionaryApi.create).mock.calls[0][0]).toEqual({ name: '新建领域' });
    });
  });

  it('search input filters nodes by name', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('金融科技')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('搜索分类...');
    fireEvent.change(searchInput, { target: { value: '金融' } });

    // The search input value should be updated
    expect(searchInput).toHaveValue('金融');
    // Root node matching the search should still be visible
    expect(screen.getByText('金融科技')).toBeTruthy();
  });

  it('shows "选择一个分类节点" when no node is selected', () => {
    renderView();
    expect(screen.getByText('选择一个分类节点')).toBeTruthy();
  });

  it('displays node details when a node is clicked', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('金融科技')).toBeTruthy();
    });

    // Click on the first node
    fireEvent.click(screen.getByText('金融科技'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('金融科技')).toBeTruthy(); // Input field with node name
      expect(screen.getByDisplayValue('dict-001')).toBeTruthy(); // Input field with node ID
    });
  });
});