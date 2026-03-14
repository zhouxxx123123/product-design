import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Download,
  Share2,
  Sparkles,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
  Zap,
  PieChart,
  Globe,
  Briefcase,
  RefreshCw,
  Loader2,
  X,
  Copy,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery } from '@tanstack/react-query';
import { useToastStore } from '../stores/toastStore';

import { ViewType, ChatMessage } from '../types';
import { clientsApi } from '../services/clients';
import { llmApi } from '../services/llm';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Local AI Portrait types (not exported to types/index.ts) ──

interface AiPortraitTrait {
  label: string;
  level: number;   // 0-100
  color: string;   // e.g. 'indigo' | 'emerald' | 'amber'
}

interface AiPortrait {
  summary: string;
  traits: AiPortraitTrait[];
  needs: string[];
  risks: string[];
  score: number;
}


// Map a numeric level (0-100) to a Chinese text label for the trait card.
function levelToText(level: number): string {
  if (level >= 85) return '极高';
  if (level >= 65) return '高';
  if (level >= 45) return '中等';
  if (level >= 25) return '低';
  return '极低';
}

// Pick an icon for a trait card by its position index (mirrors mock icon logic).
function TraitIcon({ index, className }: { index: number; className?: string }) {
  const icons = [Sparkles, AlertCircle, TrendingUp, PieChart];
  const Icon = icons[index % icons.length];
  return <Icon className={cn('w-6 h-6', className)} />;
}

interface CustomerPortraitProps {
  customerId: string;
  onBack: () => void;
  onViewChange: (view: ViewType) => void;
}

const CustomerPortraitView: React.FC<CustomerPortraitProps> = ({ customerId, onBack, onViewChange: _onViewChange }) => {
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [aiPortrait, setAiPortrait] = useState<AiPortrait | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch real client data; fall back to mock when not yet loaded.
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['client', customerId],
    queryFn: () => clientsApi.get(customerId).then(r => r.data),
    enabled: !!customerId,
  });

  // Derived display values — undefined when still loading.
  const displayName     = client?.companyName;
  const displayIndustry = client?.industry;
  const displayStatus   = client?.status;

  // Portrait data — only set when AI has generated results.
  const portraitSummary = aiPortrait?.summary ?? null;
  const portraitScore   = aiPortrait?.score   ?? null;
  const portraitNeeds   = aiPortrait?.needs   ?? null;
  const portraitRisks   = aiPortrait?.risks   ?? null;

  // ── AI portrait generation handler ──

  const handleGeneratePortrait = async () => {
    setIsGeneratingPortrait(true);
    try {
      const prompt = `基于以下客户信息生成深度客户画像，严格输出 JSON 格式，不要任何其他文字：
客户名称：${displayName}
行业：${displayIndustry}
状态：${displayStatus}

输出格式：
{
  "summary": "2-3句话的综合评价",
  "traits": [
    {"label": "决策周期", "level": 70, "color": "indigo"},
    {"label": "预算弹性", "level": 55, "color": "emerald"},
    {"label": "技术接受度", "level": 80, "color": "amber"}
  ],
  "needs": ["需求1", "需求2", "需求3"],
  "risks": ["风险1", "风险2"],
  "score": 82
}`;

      const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
      const res = await llmApi.chat(messages);

      // Extract JSON block from the LLM response.
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AiPortrait;
        setAiPortrait(parsed);
      }
    } catch {
      // Silently fail — portrait remains null.
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  const handleExportPDF = async () => {
    if (!aiPortrait) {
      useToastStore.getState().addToast('请先生成客户画像', 'warning');
      return;
    }
    setIsExporting(true);
    try {
      // Generate a simple HTML report for printing
      const reportContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>客户画像 - ${displayName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e293b; font-size: 28px; margin-bottom: 8px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 32px; }
    .section { margin-bottom: 24px; }
    .section-title { color: #4f46e5; font-size: 16px; font-weight: 600; margin-bottom: 12px; border-bottom: 2px solid #e0e7ff; padding-bottom: 8px; }
    .trait { display: flex; align-items: center; margin-bottom: 8px; }
    .trait-label { width: 120px; font-size: 14px; color: #334155; }
    .trait-bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .trait-fill { height: 100%; border-radius: 4px; }
    .item { padding: 8px 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; font-size: 14px; color: #334155; }
    .score { display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; border-radius: 50%; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${displayName} - 深度客户画像</h1>
  <div class="meta">行业：${displayIndustry} | 状态：${displayStatus} | 生成时间：${new Date().toLocaleDateString('zh-CN')}</div>

  <div class="section">
    <div class="section-title">综合评分</div>
    <div class="score">${aiPortrait.score}</div>
  </div>

  <div class="section">
    <div class="section-title">核心洞察</div>
    <p style="color: #334155; font-size: 14px; line-height: 1.6;">${aiPortrait.summary}</p>
  </div>

  <div class="section">
    <div class="section-title">特征分析</div>
    ${aiPortrait.traits.map(t => `
      <div class="trait">
        <span class="trait-label">${t.label}</span>
        <div class="trait-bar">
          <div class="trait-fill" style="width: ${t.level}%; background: ${t.color === 'indigo' ? '#4f46e5' : t.color === 'emerald' ? '#10b981' : '#f59e0b'}"></div>
        </div>
        <span style="width: 50px; text-align: right; font-size: 12px; color: #64748b;">${t.level}%</span>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">核心需求</div>
    ${aiPortrait.needs.map(n => `<div class="item">• ${n}</div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">潜在风险</div>
    ${aiPortrait.risks.map(r => `<div class="item" style="background: #fef3c7;">⚠ ${r}</div>`).join('')}
  </div>
</body>
</html>`;

      const blob = new Blob([reportContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `客户画像_${displayName}_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = () => {
    if (!aiPortrait) {
      useToastStore.getState().addToast('请先生成客户画像', 'warning');
      return;
    }
    setIsShareModalOpen(true);
  };

  const shareUrl = `${window.location.origin}/customer-portrait/${customerId}`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isLoadingClient ? (
                <span className="inline-block h-8 w-48 bg-slate-200 animate-pulse rounded-lg" />
              ) : (
                <>{displayName ?? '未知客户'} - 深度客户画像</>
              )}
            </h1>
              {aiPortrait && (
                <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI 生成
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {isLoadingClient ? (
                <span className="inline-block h-4 w-64 bg-slate-200 animate-pulse rounded" />
              ) : aiPortrait ? (
                `AI 生成于 ${new Date().toLocaleDateString('zh-CN')} · 基于实时客户数据`
              ) : (
                [displayIndustry, displayStatus].filter(Boolean).join(' · ') || '加载中...'
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {/* AI Generate / Regenerate button */}
          <button
            onClick={handleGeneratePortrait}
            disabled={isGeneratingPortrait}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGeneratingPortrait ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : aiPortrait ? (
              <>
                <RefreshCw className="w-4 h-4" />
                重新生成
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 生成画像
              </>
            )}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            分享报告
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {isExporting ? '导出中...' : '导出 PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Summary & Traits */}
        <div className="col-span-8 space-y-8">
          {/* AI Summary Card */}
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <div className="w-24 h-24 rounded-full border-8 border-indigo-50 flex items-center justify-center relative">
                <div className="text-2xl font-black text-indigo-600">{portraitScore ?? '—'}</div>
                <div className="absolute -bottom-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full">匹配度</div>
              </div>
            </div>
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                核心洞察摘要
              </h2>
              {isGeneratingPortrait ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-lg">AI 正在生成客户画像...</span>
                </div>
              ) : portraitSummary ? (
                <p className="text-slate-600 leading-relaxed text-lg">
                  {portraitSummary}
                </p>
              ) : (
                <p className="text-slate-400 text-lg italic">点击「AI 生成画像」按钮开始分析</p>
              )}
            </div>
          </div>

          {/* Traits Grid */}
          <div className="grid grid-cols-4 gap-6">
            {aiPortrait
              ? aiPortrait.traits.map((trait, i) => (
                  <div key={trait.label} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4',
                      `bg-${trait.color}-50 text-${trait.color}-600`
                    )}>
                      <TraitIcon index={i} />
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{trait.label}</div>
                    {/* Progress bar for AI-generated numeric level */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
                      <div
                        className={cn('h-full rounded-full', `bg-${trait.color}-500`)}
                        style={{ width: `${trait.level}%` }}
                      />
                    </div>
                    <div className={cn('text-lg font-black', `text-${trait.color}-600`)}>
                      {levelToText(trait.level)}
                    </div>
                  </div>
                ))
              : Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm text-center opacity-40">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto mb-4" />
                    <div className="h-2 bg-slate-100 rounded mx-auto w-16 mb-2" />
                    <div className="h-4 bg-slate-100 rounded mx-auto w-10" />
                  </div>
                ))
            }
          </div>

          {/* Detailed Analysis Tabs */}
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">深度需求分析</h2>
              <div className="flex gap-4">
                <button className="text-sm font-bold text-indigo-600">业务需求</button>
                <button className="text-sm font-bold text-slate-400">技术架构</button>
                <button className="text-sm font-bold text-slate-400">决策链条</button>
              </div>
            </div>
            <div className="p-10 grid grid-cols-2 gap-12">
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  关键需求点
                </h3>
                <div className="space-y-4">
                  {portraitNeeds && portraitNeeds.length > 0
                    ? portraitNeeds.map((need, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                          <span className="text-sm text-slate-700 font-medium">{need}</span>
                        </div>
                      ))
                    : <p className="text-slate-400 text-sm italic">暂无数据，请先生成画像</p>
                  }
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  潜在风险与阻碍
                </h3>
                <div className="space-y-4">
                  {portraitRisks && portraitRisks.length > 0
                    ? portraitRisks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          </div>
                          <span className="text-sm text-slate-700 font-medium">{risk}</span>
                        </div>
                      ))
                    : <p className="text-slate-400 text-sm italic">暂无数据，请先生成画像</p>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar Stats */}
        <div className="col-span-4 space-y-8">
          {/* Industry Context */}
          <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              行业背景分析
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <span>行业增长率</span>
                  <span className="text-emerald-400">+18.5%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full w-[85%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <span>数字化成熟度</span>
                  <span className="text-indigo-400">领先</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-400 h-full w-[92%]" />
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-4 border-t border-white/10">
                {displayIndustry ? `${displayIndustry}行业目前正经历从"移动优先"向"AI 优先"的范式转移。` : ''}
                {displayName ? `${displayName}作为头部玩家，其动作往往具有行业风向标意义。` : ''}
              </p>
            </div>
          </div>

          {/* Recommended Cases */}
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              推荐匹配案例
            </h3>
            <div className="space-y-4">
              {[
                { title: '某跨国银行合规自动化', match: '98%', tag: '高匹配' },
                { title: '电商巨头跨境结算优化', match: '85%', tag: '行业相关' },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.title}</div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{item.match}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.tag}</div>
                </div>
              ))}
              <button className="w-full py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all">
                查看案例库
              </button>
            </div>
          </div>

          {/* Action Plan */}
          <div className="bg-indigo-50 rounded-[40px] p-8 border border-indigo-100">
            <h3 className="text-lg font-bold text-indigo-900 mb-4">AI 行动建议</h3>
            {portraitNeeds && portraitNeeds.length > 0 ? (
              <div className="space-y-4">
                {portraitNeeds.map((need, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm text-indigo-600 font-bold text-xs">{idx + 1}</div>
                    <p className="text-xs text-indigo-800 leading-relaxed">{need}</p>
                  </div>
                ))}
              </div>
            ) : aiPortrait ? (
              <p className="text-sm text-indigo-600">暂无行动建议</p>
            ) : (
              <p className="text-sm text-indigo-600">点击"AI 生成画像"按钮生成个性化建议</p>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">分享报告</h2>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <p className="text-sm text-slate-500">
                  复制以下链接分享客户画像报告给团队成员：
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      "px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2",
                      copied
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        复制
                      </>
                    )}
                  </button>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    注意：分享链接需要接收者登录系统后才能查看完整报告。
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CustomerPortraitView;
