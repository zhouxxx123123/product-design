import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  FileText,
  Clock,
  ChevronRight,
  Copy,
  Trash2,
  Tag,
  Layers,
  Sparkles,
  Wand2,
  X,
  Loader2,
  Paperclip,
  Link,
  Star
} from 'lucide-react';
import { llmApi } from '../services/llm';
import { useToastStore } from '../stores/toastStore';
import { ViewType, type TemplatePayload } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../services/templates';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import http from '../services/http';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TEMPLATE_GEN_SYSTEM_PROMPT = '你是一个专业的调研访谈模板生成器。请严格按照用户要求输出 JSON 格式数据，不要输出任何其他内容。';

const buildTemplateUserPrompt = (topic: string): string =>
  `为以下主题生成一个专业的调研访谈模板：${topic}。
包含 3-5 个章节，每个章节包含 3-5 个问题。
输出必须是合法 JSON 格式，包含 title (模板标题) 和 sections (数组)。
每个 section 包含 title 和 questions (数组)。
每个 question 包含 text, type ('text'|'single'|'multiple'), 和 required (boolean)。
只输出 JSON，不要有任何额外的解释文字。`;

interface SurveyTemplatesViewProps {
  onViewChange: (view: ViewType, data?: TemplatePayload) => void;
}

const SurveyTemplatesView: React.FC<SurveyTemplatesViewProps> = ({ onViewChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await llmApi.chat(
        [{ role: 'user', content: buildTemplateUserPrompt(aiPrompt) }],
        {
          model: 'moonshot-v1-8k',
          systemPrompt: TEMPLATE_GEN_SYSTEM_PROMPT,
        },
      );
      const content = response.content;
      if (!content) throw new Error('Empty response');
      let data: TemplatePayload;
      try {
        data = JSON.parse(content) as TemplatePayload;
      } catch {
        throw new Error('AI 返回的内容不是合法的 JSON 格式，请重试。');
      }
      setShowAiModal(false);
      setAiPrompt('');
      onViewChange('survey-template-editor', data);
    } catch (error) {
      console.error("AI Generation failed:", error);
      useToastStore.getState().addToast('AI 生成失败，请稍后重试', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch template categories from API
  const { data: categoryData = [] } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => http.get('/templates/categories').then(r => r.data),
  });

  // Build categories list: ['全部', ...API categories]
  const categories = ['全部', ...categoryData.map((c: { category: string }) => c.category)];

  const queryClient = useQueryClient();
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates', searchQuery, selectedCategory],
    queryFn: () => templatesApi.list({
      search: searchQuery || undefined,
      category: selectedCategory !== '全部' ? selectedCategory : undefined,
    }).then(r => r.data),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (id: string) => templatesApi.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const setDefaultTemplateMutation = useMutation({
    mutationFn: (id: string) => templatesApi.setDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const rawTemplates = templatesData?.data ?? [];
  const filteredTemplates = rawTemplates.map(t => ({
    id: t.id,
    title: t.title,
    category: t.category ?? '',
    duration: '-- min',
    sections: t.sections?.length ?? 0,
    questions: t.sections?.reduce((acc, s) => acc + (s.questions?.length ?? 0), 0) ?? 0,
    updatedAt: t.createdAt,
    usage: 0,
    isDefault: t.isDefault ?? false,
  }));

  // Calculate stats from real data
  const totalTemplates = filteredTemplates.length;
  const defaultTemplate = filteredTemplates.find(t => t.isDefault);
  const recentTemplate = filteredTemplates[0]; // Already sorted by createdAt

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">调研模板库</h1>
          <p className="text-slate-500 mt-1">创建并管理标准化的调研大纲与访谈模板。</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 border border-indigo-100 rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-sm group"
          >
            <Wand2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            AI 智能生成
          </button>
          <button 
            onClick={() => onViewChange('survey-template-editor')}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            新建模板
          </button>
        </div>
      </div>

      {/* AI Generation Modal */}
      <AnimatePresence>
        {showAiModal && (
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
                    <h2 className="text-xl font-bold text-slate-900">AI 智能生成模板</h2>
                  </div>
                  <button 
                    onClick={() => setShowAiModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-slate-500 mb-6">
                  输入您的调研主题或业务场景，AI 将为您自动生成专业的访谈大纲和调研问题。
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">调研主题</label>
                    <div className="relative">
                      <textarea 
                        placeholder="例如：针对中小型电商企业的跨境支付痛点调研..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="w-full px-4 py-3 pb-14 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-36 resize-none"
                      />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <button 
                          onClick={() => document.getElementById('ai-file-upload')?.click()}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                          title="上传参考文档"
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
                          id="ai-file-upload"
                          type="file"
                          className="hidden"
                          onChange={(_e) => {
                            // Handle file upload
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {['金融科技', '数字化转型', '用户体验', '市场调研'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setAiPrompt(prev => prev ? `${prev}，针对${tag}领域` : `针对${tag}领域的调研`)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-500 transition-all"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => setShowAiModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    disabled={isGenerating || !aiPrompt.trim()}
                    onClick={generateWithAi}
                    className="flex-2 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {isGenerating ? '正在构思...' : '立即生成'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Layers className="w-24 h-24 text-indigo-600" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">模板总数</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalTemplates}</p>
          <p className="text-xs text-slate-500 mt-1">调研模板库</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Sparkles className="w-24 h-24 text-amber-600" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">默认模板</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 truncate">{defaultTemplate?.title ?? '—'}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">系统默认调研模板</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Clock className="w-24 h-24 text-emerald-600" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">最近更新</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 truncate">{recentTemplate?.title ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-1">更新于 昨天 14:20</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border",
                selectedCategory === cat 
                  ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜索模板标题或关键词..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Template Grid */}
      {isLoadingTemplates && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-slate-100 rounded-[32px] h-64" />
          ))}
        </div>
      )}
      {!isLoadingTemplates && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTemplates.map((template, index) => (
            <motion.div
              layout
              key={template.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="bg-white rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!template.isDefault && (
                      <button
                        onClick={() => setDefaultTemplateMutation.mutate(template.id)}
                        className="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-500 transition-all"
                        title="设为默认"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => duplicateTemplateMutation.mutate(template.id)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  <Tag className="w-3 h-3" />
                  {template.category}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  {template.title}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className="w-4 h-4 opacity-40" />
                    <span className="text-xs font-medium">{template.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Layers className="w-4 h-4 opacity-40" />
                    <span className="text-xs font-medium">{template.sections} 章节 / {template.questions} 题</span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-50 bg-slate-50/30 rounded-b-[32px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['A', 'B', 'C'].map((letter, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border-2 border-white bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold"
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {template.usage} 次使用
                  </span>
                </div>
                <button
                  onClick={() => {
                    const rawTemplate = rawTemplates.find(r => r.id === template.id);
                    if (rawTemplate) onViewChange('survey-template-editor', { ...rawTemplate, sections: rawTemplate.sections ?? [] });
                  }}
                  className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:gap-2 transition-all"
                >
                  编辑模板
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add Template Card */}
        <button 
          onClick={() => onViewChange('survey-template-editor')}
          className="border-2 border-dashed border-slate-200 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
        >
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-all shadow-sm">
            <Plus className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-900">创建自定义模板</p>
            <p className="text-xs text-slate-500 mt-1">从空白开始或基于现有模板</p>
          </div>
        </button>
      </div>
      )}
    </motion.div>
  );
};

export default SurveyTemplatesView;
