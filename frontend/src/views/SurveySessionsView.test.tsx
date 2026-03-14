/**
 * frontend/src/views/SurveySessionsView.test.tsx
 *
 * Unit tests for SurveySessionsView including the 3-step wizard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../services/sessions', () => ({
  sessionsApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../services/clients', () => ({
  clientsApi: { list: vi.fn() },
}));

vi.mock('../services/templates', () => ({
  templatesApi: { list: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import SurveySessionsView from './SurveySessionsView';
import { sessionsApi } from '../services/sessions';
import { clientsApi } from '../services/clients';
import { templatesApi } from '../services/templates';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockSessionsResponse = {
  data: {
    data: [
      {
        id: 's-001',
        title: '访谈会话一',
        clientId: 'c-1',
        status: 'scheduled',
        interviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

const mockClientsResponse = {
  data: {
    data: [
      {
        id: 'c-001',
        companyName: '测试公司',
        industry: '金融',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 50,
    totalPages: 1,
  },
};

const mockTemplatesResponse = {
  data: {
    data: [
      {
        id: 't-001',
        title: '标准访谈模板',
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 50,
    totalPages: 1,
  },
};

const mockCreateResponse = {
  data: {
    id: 's-new',
    title: '新会话',
    clientId: 'c-001',
    status: 'scheduled',
    interviewDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView(onViewChange = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SurveySessionsView onViewChange={onViewChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SurveySessionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.list).mockResolvedValue(mockSessionsResponse as any);
    vi.mocked(clientsApi.list).mockResolvedValue(mockClientsResponse as any);
    vi.mocked(templatesApi.list).mockResolvedValue(mockTemplatesResponse as any);
    vi.mocked(sessionsApi.create).mockResolvedValue(mockCreateResponse as any);
  });

  it('renders "调研会话" heading', () => {
    renderView();
    expect(screen.getByText('调研会话')).toBeTruthy();
  });

  it('renders session title after data loads', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('访谈会话一')).toBeTruthy();
    });
  });

  it('"新建会话" button opens modal at step 1 showing client list', async () => {
    renderView();

    fireEvent.click(screen.getByText('新建会话'));

    await waitFor(() => {
      // Step 1 header in modal
      expect(screen.getByText('创建新调研会话')).toBeTruthy();
    });

    // Clients should load in step 1
    await waitFor(() => {
      expect(screen.getByText('测试公司')).toBeTruthy();
    });
  });

  it('full wizard flow: select client → template → submit calls sessionsApi.create', async () => {
    renderView();

    // Open modal
    fireEvent.click(screen.getByText('新建会话'));

    // Step 1: Wait for clients to load then select
    await waitFor(() => {
      expect(screen.getByText('测试公司')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('测试公司'));

    // Next button should be enabled since a client is selected
    const nextBtn1 = screen.getByText(/下一步/);
    fireEvent.click(nextBtn1);

    // Step 2: Wait for templates to load then select
    await waitFor(() => {
      expect(screen.getByText('标准访谈模板')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('标准访谈模板'));

    // Advance to step 3
    const nextBtn2 = screen.getByText(/下一步/);
    fireEvent.click(nextBtn2);

    // Step 3: Submit — session details form with pre-filled title
    // The title is auto-filled by handleTemplateSelect, so the submit should be enabled
    await waitFor(() => {
      // On step 3 the footer button should read "开启会话"
      const submitBtn = screen.getByText('开启会话');
      expect(submitBtn).toBeTruthy();
    });

    fireEvent.click(screen.getByText('开启会话'));

    await waitFor(() => {
      expect(sessionsApi.create).toHaveBeenCalledTimes(1);
    });
  });
});
