/**
 * frontend/src/views/AdminUsersView.test.tsx
 *
 * Unit tests for AdminUsersView.
 * usersApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/users', () => ({
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import AdminUsersView from './AdminUsersView';
import { usersApi } from '../services/users';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockUsersResponse = {
  data: {
    data: [
      {
        id: 'u-001',
        displayName: '张伟',
        email: 'zhang@test.com',
        role: 'sales',
        isActive: true,
        tenantId: 't-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u-002',
        displayName: '李红',
        email: 'li@test.com',
        role: 'expert',
        isActive: false,
        tenantId: 't-1',
        createdAt: new Date().toISOString(),
      },
    ],
    total: 2,
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
        <AdminUsersView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminUsersView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.list).mockResolvedValue(mockUsersResponse as any);
  });

  it('renders "用户管理" heading', () => {
    renderView();
    expect(screen.getByText('用户管理')).toBeTruthy();
  });

  it('renders user rows after data loads', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('张伟')).toBeTruthy();
      expect(screen.getByText('李红')).toBeTruthy();
    });
  });

  it('"添加新用户" button opens modal', async () => {
    renderView();

    const addButton = screen.getByText('添加新用户');
    fireEvent.click(addButton);

    await waitFor(() => {
      // Modal heading — there are two "添加新用户" texts (button + modal h2)
      const headings = screen.getAllByText('添加新用户');
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('form submit calls usersApi.create with correct payload', async () => {
    vi.mocked(usersApi.create).mockResolvedValue({
      data: {
        id: 'u-new',
        displayName: '测试用户',
        email: 'test@example.com',
        role: 'sales',
        isActive: true,
        tenantId: 't-1',
        createdAt: new Date().toISOString(),
      },
    } as any);

    renderView();

    // Open modal
    fireEvent.click(screen.getByText('添加新用户'));

    await waitFor(() => {
      expect(screen.getAllByText('添加新用户').length).toBeGreaterThanOrEqual(2);
    });

    // Fill in name
    const nameInput = screen.getByPlaceholderText('例如：张伟');
    fireEvent.change(nameInput, { target: { value: '测试用户' } });

    // Fill in email
    const emailInput = screen.getByPlaceholderText('name@company.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Fill in password
    const passwordInput = screen.getByPlaceholderText('设置初始密码');
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    // Click submit — role defaults to 'sales'
    const submitButton = screen.getByText('发送邀请');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(usersApi.create).toHaveBeenCalledWith({
        displayName: '测试用户',
        email: 'test@example.com',
        password: 'Password123',
        role: 'sales',
      });
    });
  });

  it('"导出 CSV" calls URL.createObjectURL', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectURL });

    // Prevent link.click() from triggering jsdom navigation error
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: vi.fn(), writable: true });
      }
      return el;
    });

    renderView();

    // Wait for users to load so export has data
    await waitFor(() => {
      expect(screen.getByText('张伟')).toBeTruthy();
    });

    const exportButton = screen.getByText('导出 CSV');
    fireEvent.click(exportButton);

    expect(createObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
