import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Save,
  Plus,
  GripVertical,
  Trash2,
  Settings2,
  Sparkles,
  Eye,
  CheckSquare,
  CircleDot,
  AlignLeft,
  ArrowRight,
  Wand2,
  Loader2,
  Paperclip,
  Link,
  X,
  FileText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type TemplatePayload, type OutlineSection, type OutlineRequest } from '../types';
import http from '../services/http';
import { outlineApi } from '../services/outline';
import { templatesApi, type CreateTemplateDto } from '../services/templates';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'single' | 'multiple';
  required: boolean;
}

interface SurveyTemplateEditorViewProps {
  onBack: () => void;
  initialData?: TemplatePayload | null;
}

const SurveyTemplateEditorView: React.FC<SurveyTemplateEditorViewProps> = ({ onBack, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || '未命名模板');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState(45);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAiEnhanceModal, setShowAiEnhanceModal] = useState(false);
  const [enhancePrompt, setEnhancePrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [openTypeMenuId, setOpenTypeMenuId] = useState<string | null>(null);

  interface RawQuestion {
    text: string;
    type: 'text' | 'single' | 'multiple';
    required: boolean;
  }
  interface RawSection {
    title: string;
    questions: RawQuestion[];
  }

  // Fetch template categories from API
  const { data: templateCategories = [] } = useQuery<Array<{ category: string; count: number }>>({
    queryKey: ['template-categories'],
    queryFn: () => http.get('/templates/categories').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch default structure from API
  const { data: defaultStructure } = useQuery({
    queryKey: ['template-default-structure'],
    queryFn: () => http.get('/templates/default-structure').then(r => r.data),
    staleTime: Infinity, // This data changes very rarely
  });

  const initialSections = (initialData?.sections as RawSection[] | undefined)?.map(
    (s: RawSection, sIdx: number) => ({
      id: `init-s-${sIdx}-${Date.now()}`,
      title: s.title,
      questions: s.questions.map((q: RawQuestion, qIdx: number) => ({
        id: `init-q-${sIdx}-${qIdx}-${Date.now()}`,
        text: q.text,
        type: q.type,
        required: q.required,
      })),
    }),
  ) || (defaultStructure?.sections?.map((s: RawSection, sIdx: number) => ({
    id: `default-s-${sIdx}-${Date.now()}`,
    title: s.title,
    questions: s.questions.map((q: RawQuestion, qIdx: number) => ({
      id: `default-q-${sIdx}-${qIdx}-${Date.now()}`,
      text: q.text,
      type: q.type,
      required: q.required,
    })),
  })) ?? []);

  const [sections, setSections] = useState<Section[]>(initialSections);

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id ?? '');

  // When initialData changes, sync duration if it was set to default
  useEffect(() => {
    if (initialData?.duration !== undefined && duration === 45) {
      setDuration(initialData.duration);
    }
  }, [initialData, duration]);

  // When a new template (no initialData) is loaded and the default structure arrives
  // from the API, populate sections once. We guard with sections.length === 0 so we
  // don't overwrite sections the user has already edited.
  useEffect(() => {
    if (!initialData && sections.length === 0 && defaultStructure?.sections?.length) {
      const mapped = (defaultStructure.sections as RawSection[]).map((s, sIdx) => ({
        id: `default-s-${sIdx}-${Date.now()}`,
        title: s.title,
        questions: s.questions.map((q: RawQuestion, qIdx: number) => ({
          id: `default-q-${sIdx}-${qIdx}-${Date.now()}`,
          text: q.text,
          type: q.type,
          required: q.required,
        })),
      }));
      setSections(mapped);
      setActiveSectionId(mapped[0]?.id ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStructure]);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dto: CreateTemplateDto = {
        title,
        category,
        duration,
        sections: sections.map(s => ({
          title: s.title,
          questions: s.questions.map(q => ({
            text: q.text,
            type: q.type,
            required: q.required,
          })),
        })),
      };

      if (initialData?.id) {
        return templatesApi.update(initialData.id, dto);
      }
      return templatesApi.create(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      onBack();
    },
    onError: (error) => {
      console.error('保存模板失败:', error);
      alert('保存失败，请稍后重试');
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      alert('请输入模板名称');
      return;
    }
    saveMutation.mutate();
  };

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await http.post<{ content: string }>('/ai/llm/chat', {
        model: 'moonshot-v1-8k',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的调研访谈模板生成器。请严格按照用户要求输出 JSON 格式数据，不要输出任何其他内容。',
          },
          {
            role: 'user',
            content: `为以下主题生成一个专业的调研访谈模板：${aiPrompt}。
        包含 3-5 个章节，每个章节包含 3-5 个问题。
        输出必须是合法 JSON 格式，包含 title (模板标题) 和 sections (数组)。
        每个 section 包含 title 和 questions (数组)。
        每个 question 包含 text, type ('text'|'single'|'multiple'), 和 required (boolean)。
        只输出 JSON，不要有任何额外的解释文字。`,
          },
        ],
      });

      const content = response.data.content;
      if (!content) throw new Error('Empty response');
      let data: { title?: string; sections: Array<{ title: string; questions: Array<{ text: string; type: 'text' | 'single' | 'multiple'; required: boolean }> }> };
      try {
        data = JSON.parse(content) as typeof data;
      } catch {
        throw new Error('AI 返回的内容不是合法的 JSON 格式，请重试。');
      }
      setTitle(data.title || title);

      const newSections = data.sections.map((s, sIdx: number) => ({
        id: `ai-s-${sIdx}-${Date.now()}`,
        title: s.title,
        questions: s.questions.map((q, qIdx: number) => ({
          id: `ai-q-${sIdx}-${qIdx}-${Date.now()}`,
          text: q.text,
          type: q.type,
          required: q.required,
        })),
      }));

      setSections(newSections);
      if (newSections.length > 0) setActiveSectionId(newSections[0].id);
      setShowAiInput(false);
      setAiPrompt('');
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    try {
      const res = await outlineApi.generate({
        sessionId: 'template-preview',
        clientBackground: aiPrompt,
        researchGoals: [],
      });
      const newSections = res.data.sections.map((s: OutlineSection, sIdx: number) => ({
        id: `outline-s-${sIdx}-${Date.now()}`,
        title: s.title,
        questions: s.questions.map((qText: string, qIdx: number) => ({
          id: `outline-q-${sIdx}-${qIdx}-${Date.now()}`,
          text: qText,
          type: 'text' as const,
          required: false,
        })),
      }));
      setSections(newSections);
      if (newSections.length > 0) setActiveSectionId(newSections[0].id);
      setShowAiInput(false);
      setAiPrompt('');
    } catch {
      // silently fail
    } finally {
      setIsAiGenerating(false);
    }
  };

  const deleteQuestion = (sectionId: string, questionId: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, questions: s.questions.filter(q => q.id !== questionId) } : s
    ));
  };

  const addSection = () => {
    const newId = `s${Date.now()}`;
    setSections([...sections, { id: newId, title: '新章节', questions: [] }]);
    setActiveSectionId(newId);
  };

  const addQuestion = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          questions: [...s.questions, { id: `q${Date.now()}`, text: '', type: 'text', required: false }]
        };
      }
      return s;
    }));
  };

  const activeSection = sections.find(s => s.id === activeSectionId);

  const enhanceWithAi = async () => {
    if (!enhancePrompt.trim()) return;
    setIsEnhancing(true);
    try {
      const response = await http.post<{ content: string }>('/ai/llm/chat', {
        model: 'moonshot-v1-8k',
        messages: [
          {
            role: 'system',
            content: '你是专业的访谈问题生成器，只输出 JSON 数组，不输出其他任何内容。',
          },
          {
            role: 'user',
            content: `基于以下背景信息，为当前的访谈大纲生成 3 个相关的追问或补充问题。
        当前章节标题：${activeSection?.title ?? ''}
        补充背景：${enhancePrompt}
        输出必须是合法 JSON 数组，每个元素包含 text (问题文本), type ('text'|'single'|'multiple'), required (boolean)。
        只输出 JSON 数组，不要有任何额外的解释文字。`,
          },
        ],
      });

      const content = response.data.content;
      if (!content) throw new Error('Empty response');
      let parsed: Array<{ text: string; type: 'text' | 'single' | 'multiple'; required: boolean }>;
      try {
        parsed = JSON.parse(content) as typeof parsed;
      } catch {
        throw new Error('AI 返回的内容不是合法的 JSON 格式，请重试。');
      }
      const newQuestions = parsed.map((q, idx: number) => ({
        id: `ai-enh-q-${Date.now()}-${idx}`,
        text: q.text,
        type: q.type,
        required: q.required,
      }));

      setSections(sections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, questions: [...s.questions, ...newQuestions] };
        }
        return s;
      }));

      setShowAiEnhanceModal(false);
      setEnhancePrompt('');
    } catch (error) {
      console.error("AI Enhancement failed:", error);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex flex-col">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-64"
              placeholder="输入模板名称..."
            />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>草稿自动保存</span>
              <span className="w-1 h-1 bg-emerald-500 rounded-full" />
              <span>刚刚</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all"
          >
            <Eye className="w-4 h-4" />
            预览
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !title.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveMutation.isPending ? '保存中...' : '保存模板'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Outline */}
        <aside className="w-72 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">访谈大纲</h3>
              <button 
                onClick={() => setShowAiInput(!showAiInput)}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                title="AI 智能生成"
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {showAiInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="p-3 bg-white border border-indigo-100 rounded-2xl shadow-sm space-y-3">
                    <div className="relative">
                      <textarea
                        placeholder="输入调研主题，如：跨境支付痛点调研..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="w-full p-2 pb-10 text-xs border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-24"
                      />
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button 
                          onClick={() => document.getElementById('editor-ai-file-upload')?.click()}
                          className="p-1.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all shadow-sm flex items-center gap-1"
                          title="上传附件"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span className="text-[10px] font-bold">附件</span>
                        </button>
                        <button 
                          className="p-1.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all shadow-sm flex items-center gap-1"
                          title="引用链接"
                        >
                          <Link className="w-3 h-3" />
                          <span className="text-[10px] font-bold">链接</span>
                        </button>
                        <input
                          id="editor-ai-file-upload"
                          type="file"
                          className="hidden"
                          onChange={(_e) => {
                            // Handle file upload
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={generateWithAi}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isGenerating ? '正在生成...' : 'AI 智能生成'}
                    </button>
                    <button
                      onClick={handleAiGenerate}
                      disabled={isAiGenerating || !aiPrompt.trim()}
                      className="w-full py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 disabled:opacity-50 transition-all"
                    >
                      {isAiGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      {isAiGenerating ? 'AI 生成中…' : '生成提纲'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                    activeSectionId === section.id 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                      : "text-slate-500 hover:bg-white/50 hover:text-slate-900"
                  )}
                >
                  <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-lg text-[10px] group-hover:bg-indigo-50 transition-colors">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-left truncate">{section.title}</span>
                  <GripVertical className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <button 
              onClick={addSection}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
              添加新章节
            </button>
          </div>

          <div className="mt-auto p-6 border-t border-slate-200">
            <div 
              onClick={() => setShowAiEnhanceModal(true)}
              className="bg-indigo-600 rounded-2xl p-4 text-white relative overflow-hidden group cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-12 h-12" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">AI 辅助增强</p>
              <p className="text-sm font-bold leading-snug">基于行业背景自动补全访谈问题</p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-bold">
                立即尝试 <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Editor */}
        <main className="flex-1 overflow-y-auto bg-slate-50/30 p-12">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              {activeSection && (
                <motion.div
                  key={activeSection.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-8">
                    <input 
                      type="text" 
                      value={activeSection.title}
                      onChange={(e) => {
                        setSections(sections.map(s => s.id === activeSection.id ? { ...s, title: e.target.value } : s));
                      }}
                      className="text-3xl font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-full"
                      placeholder="章节标题..."
                    />
                    <div className="h-1 w-20 bg-indigo-600 rounded-full mt-4" />
                  </div>

                  <div className="space-y-6">
                    {activeSection.questions.map((question, qIndex) => (
                      <div 
                        key={question.id}
                        className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs">
                            {qIndex + 1}
                          </div>
                          <div className="flex-1 space-y-4">
                            <textarea 
                              value={question.text}
                              onChange={(e) => {
                                setSections(sections.map(s => {
                                  if (s.id === activeSection.id) {
                                    return {
                                      ...s,
                                      questions: s.questions.map(q => q.id === question.id ? { ...q, text: e.target.value } : q)
                                    };
                                  }
                                  return s;
                                }));
                              }}
                              placeholder="输入访谈问题或引导语..."
                              className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-800 font-medium resize-none min-h-[60px]"
                            />
                            
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenTypeMenuId(openTypeMenuId === question.id ? null : question.id);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                  >
                                    {question.type === 'text' && <AlignLeft className="w-3 h-3" />}
                                    {question.type === 'single' && <CircleDot className="w-3 h-3" />}
                                    {question.type === 'multiple' && <CheckSquare className="w-3 h-3" />}
                                    {question.type === 'text' ? '文本' : question.type === 'single' ? '单选' : '多选'}
                                  </button>
                                  {openTypeMenuId === question.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setOpenTypeMenuId(null)}
                                      />
                                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                                        {[
                                          { type: 'text' as const, label: '文本', icon: AlignLeft },
                                          { type: 'single' as const, label: '单选', icon: CircleDot },
                                          { type: 'multiple' as const, label: '多选', icon: CheckSquare },
                                        ].map(({ type, label, icon: Icon }) => (
                                          <button
                                            key={type}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSections(sections.map(s =>
                                                s.id === activeSection.id ? { ...s, questions: s.questions.map(q =>
                                                  q.id === question.id ? { ...q, type } : q
                                                )} : s
                                              ));
                                              setOpenTypeMenuId(null);
                                            }}
                                            className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                          >
                                            <Icon className="w-3 h-3" />
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <button 
                                  onClick={() => document.getElementById(`file-upload-${question.id}`)?.click()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                  title="上传附件或图片"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  添加附件
                                </button>
                                <button 
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                  title="添加引用链接"
                                >
                                  <Link className="w-3 h-3" />
                                  引用链接
                                </button>
                                <input
                                  id={`file-upload-${question.id}`}
                                  type="file"
                                  className="hidden"
                                  onChange={(_e) => {
                                    // Handle file upload logic here
                                  }}
                                />
                                <label className="flex items-center gap-2 ml-4 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={question.required}
                                    onChange={(e) => {
                                      setSections(sections.map(s => {
                                        if (s.id === activeSection.id) {
                                          return {
                                            ...s,
                                            questions: s.questions.map(q => q.id === question.id ? { ...q, required: e.target.checked } : q)
                                          };
                                        }
                                        return s;
                                      }));
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                  />
                                  <span className="text-xs font-bold text-slate-400">必答</span>
                                </label>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all">
                                  <Settings2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteQuestion(activeSection.id, question.id);
                                  }}
                                  className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      onClick={() => addQuestion(activeSection.id)}
                      className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex flex-col items-center gap-2"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="font-bold text-sm">添加问题</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Right Sidebar - Settings/AI */}
        <aside className="w-80 border-l border-slate-200 bg-white p-6 hidden xl:block">
          <div className="space-y-8">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">模板设置</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">所属行业</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">请选择分类</option>
                    {templateCategories.length > 0 ? (
                      templateCategories.map(c => (
                        <option key={c.category} value={c.category}>{c.category}</option>
                      ))
                    ) : (
                      <>
                        <option value="金融科技">金融科技</option>
                        <option value="人工智能">人工智能</option>
                        <option value="新能源">新能源</option>
                        <option value="数字化转型">数字化转型</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">预计时长 (分钟)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setDuration(val);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI 建议</h3>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-3">
                {[
                  '建议在“核心痛点”章节增加关于“合规性”的问题。',
                  '当前模板覆盖了 80% 的行业标准访谈路径。',
                  '检测到 2 个问题表述可能存在诱导性，建议优化。'
                ].map((tip, i) => (
                  <div key={i} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-amber-800 leading-relaxed">
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden">
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-900">预览模式：{title}</span>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                退出预览
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-3xl mx-auto bg-white rounded-[32px] shadow-sm border border-slate-200 p-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">{title}</h1>
                <div className="space-y-12">
                  {sections.map((section, sIdx) => (
                    <div key={section.id}>
                      <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-100">
                        {sIdx + 1}. {section.title}
                      </h2>
                      <div className="space-y-8">
                        {section.questions.map((q, qIdx) => (
                          <div key={q.id} className="space-y-4">
                            <div className="flex gap-2 text-base">
                              <span className="font-bold text-slate-900">{qIdx + 1}.</span>
                              <span className="font-medium text-slate-800">{q.text}</span>
                              {q.required && <span className="text-red-500">*</span>}
                            </div>
                            {q.type === 'text' && (
                              <textarea 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none h-32 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="请输入您的回答..."
                              />
                            )}
                            {q.type === 'single' && (
                              <div className="space-y-3 pl-6">
                                {['选项 A', '选项 B', '选项 C'].map((opt, i) => (
                                  <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                    <input type="radio" name={`q-${q.id}`} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {q.type === 'multiple' && (
                              <div className="space-y-3 pl-6">
                                {['选项 A', '选项 B', '选项 C'].map((opt, i) => (
                                  <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center">
                  <button className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    提交问卷
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAiEnhanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">AI 辅助增强</h2>
                  </div>
                  <button 
                    onClick={() => setShowAiEnhanceModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-slate-500 mb-6">
                  AI 将基于您提供的行业背景或特定关注点，为当前章节 <strong>"{activeSection?.title}"</strong> 自动补充深度的追问和专业问题。
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">补充背景信息</label>
                    <div className="relative">
                      <textarea 
                        placeholder="例如：重点关注数据安全和合规性方面的挑战..."
                        value={enhancePrompt}
                        onChange={(e) => setEnhancePrompt(e.target.value)}
                        className="w-full px-4 py-3 pb-14 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-36 resize-none"
                      />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <button 
                          onClick={() => document.getElementById('ai-enhance-file-upload')?.click()}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          title="上传附件"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">上传附件</span>
                        </button>
                        <button 
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          title="引用链接"
                        >
                          <Link className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">引用链接</span>
                        </button>
                        <input
                          id="ai-enhance-file-upload"
                          type="file"
                          className="hidden"
                          onChange={(_e) => {
                            // Handle file upload
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => setShowAiEnhanceModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    disabled={isEnhancing || !enhancePrompt.trim()}
                    onClick={enhanceWithAi}
                    className="flex-2 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isEnhancing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isEnhancing ? '正在增强...' : '生成补充问题'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SurveyTemplateEditorView;
