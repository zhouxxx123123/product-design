/**
 * frontend/src/views/SurveyTemplatesView.test.tsx
 *
 * Unit tests for SurveyTemplatesView including template list, AI generation modal, and CRUD operations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock services
vi.mock('../services/templates', () => ({
  templatesApi: {
    list: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    setDefault: vi.fn(),
  },
}));

vi.mock('../services/llm', () => ({
  llmApi: {
    chat: vi.fn(),
  },
}));

// Mock toastStore — SurveyTemplatesView calls useToastStore.getState().addToast()
vi.mock('../stores/toastStore', () => {
  const mockFn = vi.fn((selector?: (s: any) => any) => {
    const store = { addToast: mockAddToast };
    return typeof selector === 'function' ? selector(store) : store;
  }) as any;
  mockFn.getState = () => ({ addToast: mockAddToast });
  return { useToastStore: mockFn };
});

// ── Imports after mocks ───────────────────────────────────────────────────────

import SurveyTemplatesView from './SurveyTemplatesView';
import { templatesApi } from '../services/templates';
import { llmApi } from '../services/llm';

// ── Default mock data ─────────────────────────────────────────────────────────

const mockTemplatesResponse = {
  data: {
    data: [
      {
        id: 't-001',
        title: '竞品调研访谈',
        category: '金融科技',
        isDefault: false,
        sections: [
          {
            title: '基本信息',
            questions: [
              { text: '您的公司名称？', type: 'text', required: true }
            ]
          }
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 't-002',
        title: '用户体验调研',
        category: '用户体验',
        isDefault: true,
        sections: [
          {
            title: '用户行为',
            questions: [
              { text: '您多久使用一次我们的产品？', type: 'single', required: true },
              { text: '您最喜欢的功能是什么？', type: 'text', required: false }
            ]
          }
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

const mockAiResponse = {
  content: JSON.stringify({
    title: 'AI生成的调研模板',
    sections: [
      {
        title: '第一章节',
        questions: [
          { text: 'AI生成的问题', type: 'text', required: true }
        ]
      }
    ]
  })
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderView(onViewChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SurveyTemplatesView onViewChange={onViewChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SurveyTemplatesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templatesApi.list).mockResolvedValue(mockTemplatesResponse as any);
  });

  it('renders "调研模板库" heading', () => {
    renderView();
    // Use heading role to target the h1 specifically, not nav items
    expect(screen.getByRole('heading', { name: '调研模板库' })).toBeTruthy();
  });

  it('renders template data after loading', async () => {
    renderView();

    await waitFor(() => {
      // Template titles appear in the card grid
      const titles = screen.getAllByText('竞品调研访谈');
      expect(titles.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('用户体验调研').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('"新建模板" button calls onViewChange with survey-template-editor', async () => {
    const mockOnViewChange = vi.fn();
    renderView(mockOnViewChange);

    const addButton = screen.getByText('新建模板');
    fireEvent.click(addButton);

    expect(mockOnViewChange).toHaveBeenCalledWith('survey-template-editor');
  });

  it('"AI 智能生成" button opens modal', async () => {
    renderView();

    const aiButton = screen.getByText('AI 智能生成');
    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(screen.getByText('AI 智能生成模板')).toBeTruthy();
    });
  });

  it('AI generation flow: enter prompt, generate, calls onViewChange with template data', async () => {
    vi.mocked(llmApi.chat).mockResolvedValue(mockAiResponse as any);
    const mockOnViewChange = vi.fn();
    renderView(mockOnViewChange);

    // Open AI modal
    fireEvent.click(screen.getByText('AI 智能生成'));

    await waitFor(() => {
      expect(screen.getByText('AI 智能生成模板')).toBeTruthy();
    });

    // Fill in prompt
    const promptInput = screen.getByPlaceholderText(/例如：针对中小型电商企业的跨境支付痛点调研/);
    fireEvent.change(promptInput, { target: { value: '测试调研主题' } });

    // Click generate
    const generateButton = screen.getByText('立即生成');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(llmApi.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('测试调研主题') }],
        expect.objectContaining({
          model: 'moonshot-v1-8k',
          systemPrompt: expect.stringContaining('专业的调研访谈模板生成器'),
        })
      );
    });

    await waitFor(() => {
      expect(mockOnViewChange).toHaveBeenCalledWith('survey-template-editor', {
        title: 'AI生成的调研模板',
        sections: [
          {
            title: '第一章节',
            questions: [
              { text: 'AI生成的问题', type: 'text', required: true }
            ]
          }
        ]
      });
    });
  });

  it('delete button calls templatesApi.delete', async () => {
    vi.mocked(templatesApi.delete).mockResolvedValue({} as any);
    renderView();

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getAllByText('竞品调研访谈').length).toBeGreaterThanOrEqual(1);
    });

    // Each template card has a delete button (Trash2 icon) that is opacity-0 until hover.
    // query by all buttons and find the trash ones
    const allButtons = screen.getAllByRole('button');
    // Trash2 button inside a template card — find by SVG data attribute or class
    // The delete buttons have class that includes hover:text-red-600
    const deleteButtons = allButtons.filter(btn =>
      btn.className.includes('hover:text-red-600')
    );

    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(templatesApi.delete).toHaveBeenCalledTimes(1);
    });
  });
});