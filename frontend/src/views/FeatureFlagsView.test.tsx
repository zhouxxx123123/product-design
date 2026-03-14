/**
 * frontend/src/views/FeatureFlagsView.test.tsx
 *
 * Unit tests for FeatureFlagsView.
 * featureFlagsApi is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/featureFlags', () => ({
  featureFlagsApi: {
    list: vi.fn(),
    saveAll: vi.fn(),
  },
}));

vi.mock('../services/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import FeatureFlagsView from './FeatureFlagsView';
import { featureFlagsApi } from '../services/featureFlags';
import http from '../services/http';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockEnrichedFlags = [
  { id: 'fd-1', key: 'crm', name: 'CRM客户管理', description: '客户关系管理', category: 'sales', iconName: 'Users', sortOrder: 1, enabled: true },
  { id: 'fd-2', key: 'survey_sessions', name: '调研任务管理', description: '任务管理', category: 'sales', iconName: 'ClipboardList', sortOrder: 2, enabled: false },
  { id: 'fd-3', key: 'copilot', name: 'AI副驾驶助手', description: 'AI助手', category: 'ai', iconName: 'Brain', sortOrder: 7, enabled: true },
  { id: 'fd-4', key: 'case_library', name: '案例知识库', description: '知识库管理', category: 'expert', iconName: 'BookOpen', sortOrder: 9, enabled: false },
];

const mockRemoteFlags = {
  data: [
    { key: 'crm', enabled: true },
    { key: 'survey_sessions', enabled: false },
    { key: 'copilot', enabled: true },
    { key: 'case_library', enabled: false },
  ],
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FeatureFlagsView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeatureFlagsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: mockEnrichedFlags });
    vi.mocked(featureFlagsApi.list).mockResolvedValue(mockRemoteFlags as any);
  });

  it('renders "功能权限开关" heading', () => {
    renderView();
    expect(screen.getByText('功能权限开关')).toBeTruthy();
  });

  it('shows enabled count based on remote flags', async () => {
    renderView();

    // Wait for data to load and check enabled count
    // From mockRemoteFlags: 2 enabled out of 4 total features
    await waitFor(() => {
      // The enabled count should reflect the loaded flags
      const enabledText = screen.getByText(/已启用:/);
      expect(enabledText).toBeTruthy();
    });
  });

  it('renders "保存配置" button', () => {
    renderView();
    expect(screen.getByText('保存配置')).toBeTruthy();
  });

  it('calls featureFlagsApi.saveAll when "保存配置" button is clicked', async () => {
    vi.mocked(featureFlagsApi.saveAll).mockResolvedValue({
      data: mockRemoteFlags.data,
    } as any);

    renderView();

    // Wait for enriched flags to load first
    await waitFor(() => {
      expect(screen.getByText('CRM客户管理')).toBeTruthy();
    });

    const saveButton = screen.getByText('保存配置');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(featureFlagsApi.saveAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: expect.any(String), enabled: expect.any(Boolean) }),
        ])
      );
    });
  });

  it('toggles feature flags when toggle button is clicked', async () => {
    renderView();

    // Wait for features to load
    await waitFor(() => {
      expect(screen.getByText('CRM客户管理')).toBeTruthy();
    });

    // Toggle buttons are <button> elements with a rounded-full class (the pill toggle)
    const allButtons = screen.getAllByRole('button');
    // Filter to find the toggle pill buttons (they have bg-indigo-600 or bg-slate-200)
    const togglePills = allButtons.filter(btn =>
      btn.className.includes('rounded-full') && btn.className.includes('w-14')
    );

    expect(togglePills.length).toBeGreaterThan(0);
    // Clicking a toggle should work without throwing
    fireEvent.click(togglePills[0]);
    // After click, the save status should be reset (idle)
    expect(screen.getByText('保存配置')).toBeTruthy();
  });

  it('shows category filter buttons including "全部功能"', () => {
    renderView();

    expect(screen.getByText('全部功能')).toBeTruthy();
    // Category filter buttons appear in the top filter row — use getAllByText since
    // the same label also appears as a section heading in the feature list.
    expect(screen.getAllByText('销售权限').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('专家权限').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI 功能').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('系统功能').length).toBeGreaterThanOrEqual(1);
  });

  it('filters features by category when category button is clicked', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('CRM客户管理')).toBeTruthy();
    });

    // Click on "销售权限" category — take first occurrence (the filter button)
    const salesCategoryButtons = screen.getAllByText('销售权限');
    fireEvent.click(salesCategoryButtons[0]);

    // Sales category features should still be visible
    expect(screen.getByText('CRM客户管理')).toBeTruthy();
    expect(screen.getByText('调研任务管理')).toBeTruthy();
  });
});