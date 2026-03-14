import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// vi.mock 必须在 import 组件之前
vi.mock('../services/auth', () => ({
  authApi: { login: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// mock react-router-dom 的 useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

import LoginView from './LoginView';
import { authApi } from '../services/auth';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginView', () => {
  const mockNavigate = vi.fn();
  const mockSetAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useNavigate
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    // Mock useAuthStore
    vi.mocked(useAuthStore).mockReturnValue(mockSetAuth);
  });

  it('renders title correctly', () => {
    renderView();
    expect(screen.getByText('OpenClaw')).toBeInTheDocument();
  });

  it('renders form elements correctly', () => {
    renderView();

    // 检查邮箱输入框
    const emailInput = screen.getByPlaceholderText('name@company.com');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');

    // 检查密码输入框
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('handles successful login for ADMIN role', async () => {
    const mockResponse = {
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: '1',
          email: 'admin@test.com',
          displayName: 'Admin User',
          role: 'admin',
          isActive: true,
          tenantId: 'tenant-1'
        }
      }
    };

    vi.mocked(authApi.login).mockResolvedValue(mockResponse as any);

    renderView();

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'admin@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' }
    });

    // 提交表单
    fireEvent.click(screen.getByText('登录控制台'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'password123'
      });
    });

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(
        {
          id: '1',
          email: 'admin@test.com',
          displayName: 'Admin User',
          role: 'ADMIN',
          isActive: true,
          tenantId: 'tenant-1'
        },
        'mock-access-token',
        'mock-refresh-token'
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/users');
    });
  });

  it('handles successful login for SALES role', async () => {
    const mockResponse = {
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: '2',
          email: 'sales@test.com',
          displayName: 'Sales User',
          role: 'sales',
          isActive: true,
          tenantId: 'tenant-1'
        }
      }
    };

    vi.mocked(authApi.login).mockResolvedValue(mockResponse as any);

    renderView();

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'sales@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' }
    });

    // 提交表单
    fireEvent.click(screen.getByText('登录控制台'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'sales@test.com',
        password: 'password123'
      });
    });

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(
        {
          id: '2',
          email: 'sales@test.com',
          displayName: 'Sales User',
          role: 'SALES',
          isActive: true,
          tenantId: 'tenant-1'
        },
        'mock-access-token',
        'mock-refresh-token'
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/crm');
    });
  });

  it('handles login failure', async () => {
    const mockError = {
      response: {
        data: {
          message: '邮箱或密码错误'
        }
      }
    };

    vi.mocked(authApi.login).mockRejectedValue(mockError);

    renderView();

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'wrong@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpassword' }
    });

    // 提交表单
    fireEvent.click(screen.getByText('登录控制台'));

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument();
    });

    // 确保没有调用 setAuth 和 navigate
    expect(mockSetAuth).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows loading state when submitting', async () => {
    // Mock a slow API call
    vi.mocked(authApi.login).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderView();

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' }
    });

    // 提交表单
    fireEvent.click(screen.getByText('登录控制台'));

    // 检查 loading 状态
    expect(screen.getByText('登录中...')).toBeInTheDocument();

    // 确保按钮被禁用
    const submitButton = screen.getByRole('button', { name: /登录中/ });
    expect(submitButton).toBeDisabled();
  });

  it('handles login failure with default error message', async () => {
    // Mock error without response.data.message
    const mockError = new Error('Network error');

    vi.mocked(authApi.login).mockRejectedValue(mockError);

    renderView();

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('name@company.com'), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' }
    });

    // 提交表单
    fireEvent.click(screen.getByText('登录控制台'));

    await waitFor(() => {
      expect(screen.getByText('登录失败，请检查邮箱和密码')).toBeInTheDocument();
    });
  });
});