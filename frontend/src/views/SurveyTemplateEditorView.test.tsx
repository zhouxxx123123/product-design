import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// vi.mock 必须在 import 组件之前
vi.mock('../services/templates', () => ({
  templatesApi: {
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../services/outline', () => ({
  outlineApi: {
    generate: vi.fn(),
  },
}));

// http 实例用于 AI 调用 + default-structure 查询
vi.mock('../services/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import SurveyTemplateEditorView from './SurveyTemplateEditorView';
import { templatesApi } from '../services/templates';
import { outlineApi } from '../services/outline';
import http from '../services/http';

// Default structure returned by GET /templates/default-structure
const mockDefaultStructure = {
  data: {
    sections: [
      {
        id: 's1',
        title: '开场与背景',
        description: '建立融洽关系',
        questions: [
          { id: 'q1', text: '请简单介绍一下您目前在公司负责的业务范围？', type: 'open' },
          { id: 'q2', text: '您在这个领域工作了多久了？', type: 'open' },
        ],
      },
    ],
  },
};

function renderView(initialData: any = undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SurveyTemplateEditorView onBack={vi.fn()} initialData={initialData} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SurveyTemplateEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock different HTTP GET calls based on URL
    vi.mocked(http.get).mockImplementation((url: string) => {
      if (url === '/templates/default-structure') {
        return Promise.resolve(mockDefaultStructure as any);
      }
      if (url === '/templates/categories') {
        return Promise.resolve({ data: [] } as any);
      }
      // Default for any other calls (like dictionary)
      return Promise.resolve({ data: [] } as any);
    });
  });

  it('renders with default title and section', async () => {
    renderView();

    // 检查默认标题在输入框中
    const titleInput = screen.getByDisplayValue('未命名模板');
    expect(titleInput).toBeInTheDocument();

    // 默认章节由 API 异步加载，需要等待
    await waitFor(() => {
      expect(screen.getByText('开场与背景')).toBeInTheDocument();
    });

    // 检查默认第一个问题的文字
    const questionText = screen.getByDisplayValue('请简单介绍一下您目前在公司负责的业务范围？');
    expect(questionText).toBeInTheDocument();
  });

  it('displays initial question text correctly', async () => {
    renderView();

    // 默认章节由 API 异步加载，等待后检查
    await waitFor(() => {
      const questionTextarea = screen.getByDisplayValue('请简单介绍一下您目前在公司负责的业务范围？');
      expect(questionTextarea).toBeInTheDocument();
    });
  });

  it('allows editing template title', () => {
    renderView();

    // 找到标题输入框
    const titleInput = screen.getByDisplayValue('未命名模板');

    // 修改标题
    fireEvent.change(titleInput, { target: { value: '新的模板标题' } });

    // 验证新标题在页面中可见
    expect(screen.getByDisplayValue('新的模板标题')).toBeInTheDocument();
  });

  it('adds new section when clicking add section button', async () => {
    renderView();

    // 点击添加新章节按钮
    const addSectionBtn = screen.getByText('添加新章节');
    fireEvent.click(addSectionBtn);

    // 新章节添加后变为 active，编辑区标题 input 的 value = '新章节'
    await waitFor(() => {
      // 侧边栏按钮中出现 '新章节' 文字
      const sectionBtns = screen.getAllByText('新章节');
      expect(sectionBtns.length).toBeGreaterThan(0);
    });
  });

  it('adds new question when clicking add question button', async () => {
    renderView();

    // 等章节从 API 加载完成，"添加问题"按钮才会出现
    await waitFor(() => {
      expect(screen.getByText('添加问题')).toBeInTheDocument();
    });

    const addQuestionBtn = screen.getByText('添加问题');
    fireEvent.click(addQuestionBtn);

    // 检查是否有新的空白问题输入框
    const questionTextareas = screen.getAllByPlaceholderText('输入访谈问题或引导语...');
    expect(questionTextareas.length).toBeGreaterThan(0);
  });

  it('calls templatesApi.create when saving template', async () => {
    const mockResponse = { data: { id: 't-new', title: '测试模板' } };
    vi.mocked(templatesApi.create).mockResolvedValue(mockResponse as any);

    renderView();

    // 等默认章节从 API 加载完成
    await waitFor(() => {
      expect(screen.getByText('开场与背景')).toBeInTheDocument();
    });

    // 修改标题
    const titleInput = screen.getByDisplayValue('未命名模板');
    fireEvent.change(titleInput, { target: { value: '测试模板' } });

    // 点击保存按钮
    const saveBtn = screen.getByText('保存模板');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(templatesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '测试模板',
          category: '',
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: '开场与背景',
              questions: expect.arrayContaining([
                expect.objectContaining({ text: '请简单介绍一下您目前在公司负责的业务范围？' }),
              ]),
            }),
          ]),
        }),
      );
    });
  });

  it('loads initialData correctly when provided', () => {
    const initialData = {
      id: 't-1',
      title: '已有模板',
      sections: [
        {
          title: '自定义章节',
          questions: [
            {
              text: '自定义问题内容',
              type: 'text',
              required: false,
            },
          ],
        },
      ],
    };

    renderView(initialData);

    // 检查标题
    expect(screen.getByDisplayValue('已有模板')).toBeInTheDocument();

    // 检查章节标题
    expect(screen.getByText('自定义章节')).toBeInTheDocument();

    // 检查问题内容
    expect(screen.getByDisplayValue('自定义问题内容')).toBeInTheDocument();
  });

  it('shows loading state when saving', async () => {
    // Mock a slow API call
    vi.mocked(templatesApi.create).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 500))
    );

    renderView();

    // 点击保存按钮
    const saveBtn = screen.getByText('保存模板');
    fireEvent.click(saveBtn);

    // React Query isPending 状态需要 waitFor
    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });
  });

  it('calls templatesApi.update when editing existing template', async () => {
    const initialData = {
      id: 't-existing',
      title: '现有模板',
      sections: [
        {
          title: '章节1',
          questions: [
            {
              text: '问题1',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    };

    const mockResponse = { data: { id: 't-existing', title: '修改后模板' } };
    vi.mocked(templatesApi.update).mockResolvedValue(mockResponse as any);

    renderView(initialData);

    // 修改标题
    const titleInput = screen.getByDisplayValue('现有模板');
    fireEvent.change(titleInput, { target: { value: '修改后模板' } });

    // 点击保存按钮
    const saveBtn = screen.getByText('保存模板');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(templatesApi.update).toHaveBeenCalledWith('t-existing', {
        title: '修改后模板',
        category: '',
        duration: 45,
        sections: [
          {
            title: '章节1',
            questions: [
              {
                text: '问题1',
                type: 'text',
                required: true,
              },
            ],
          },
        ],
      });
    });
  });

  it('prevents saving when title is empty', () => {
    renderView();

    // 清空标题
    const titleInput = screen.getByDisplayValue('未命名模板');
    fireEvent.change(titleInput, { target: { value: '' } });

    // 保存按钮应该被禁用
    const saveBtn = screen.getByText('保存模板');
    expect(saveBtn).toBeDisabled();
  });

  it('switches between sections when clicking section buttons', async () => {
    renderView();

    // 等默认章节从 API 加载完成
    await waitFor(() => {
      expect(screen.getByText('开场与背景')).toBeInTheDocument();
    });

    // 添加一个新章节
    const addSectionBtn = screen.getByText('添加新章节');
    fireEvent.click(addSectionBtn);

    // 等待新章节出现在侧边栏
    await waitFor(() => {
      expect(screen.getAllByText('新章节').length).toBeGreaterThan(0);
    });

    // 点击原来的"开场与背景"章节
    const originalSectionBtn = screen.getByText('开场与背景');
    fireEvent.click(originalSectionBtn);

    // 编辑区标题 input 应切换回 '开场与背景'
    await waitFor(() => {
      expect(screen.getByDisplayValue('开场与背景')).toBeInTheDocument();
    });
  });

  it('allows editing section titles', async () => {
    renderView();

    // 等默认章节从 API 加载完成
    await waitFor(() => {
      expect(screen.getByDisplayValue('开场与背景')).toBeInTheDocument();
    });

    // 找到章节标题输入框（在编辑区域中）
    const sectionTitleInput = screen.getByDisplayValue('开场与背景');
    expect(sectionTitleInput).toBeInTheDocument();

    // 修改章节标题
    fireEvent.change(sectionTitleInput, { target: { value: '修改后的章节标题' } });

    // 验证新标题在页面中可见
    expect(screen.getByDisplayValue('修改后的章节标题')).toBeInTheDocument();

    // 验证侧边栏中的章节也更新了
    expect(screen.getByText('修改后的章节标题')).toBeInTheDocument();
  });

  it('generates outline using AI when AI generate button is clicked', async () => {
    const mockOutlineResponse = {
      data: {
        sections: [
          {
            id: 'ai-section-1',
            title: 'AI生成章节',
            questions: ['AI生成问题1', 'AI生成问题2'],
          },
        ],
        generatedAt: new Date().toISOString(),
      },
    };

    vi.mocked(outlineApi.generate).mockResolvedValue(mockOutlineResponse as any);

    renderView();

    // 点击AI智能生成按钮打开输入区域
    const aiBtn = screen.getByTitle('AI 智能生成');
    fireEvent.click(aiBtn);

    // 输入AI提示
    const promptTextarea = screen.getByPlaceholderText('输入调研主题，如：跨境支付痛点调研...');
    fireEvent.change(promptTextarea, { target: { value: '测试调研主题' } });

    // 点击生成提纲按钮
    const generateBtn = screen.getByText('生成提纲');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(outlineApi.generate).toHaveBeenCalledWith({
        sessionId: 'template-preview',
        clientBackground: '测试调研主题',
        researchGoals: [],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('AI生成章节')).toBeInTheDocument();
    });
  });
});