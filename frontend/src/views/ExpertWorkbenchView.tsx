import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionCollabApi } from '../services/sessions-collab';
import { insightsApi, Insight as ApiInsight } from '../services/insights';
import { sessionsApi, Session as ApiSession, SessionStatus } from '../services/sessions';
import {
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Search,
  Star,
  Send,
  Sparkles,
  Briefcase,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Status mapping ────────────────────────────────────────────────────────────

function mapApiStatus(s: SessionStatus): 'pending' | 'reviewed' | 'completed' {
  switch (s) {
    case 'in_progress': return 'reviewed';
    case 'completed': return 'completed';
    default: return 'pending'; // scheduled, paused, cancelled, archived
  }
}

// ── Local UI types ────────────────────────────────────────────────────────────

interface Session {
  id: string;
  title: string;
  customer: string;
  salesPerson: string;
  assignedAt: string;
  status: 'pending' | 'reviewed' | 'completed';
  insightsCount: number;
  commentsCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function insightTitle(insight: ApiInsight): string {
  return typeof insight.content['title'] === 'string'
    ? insight.content['title']
    : `洞察 #${insight.id.slice(-4)}`;
}

function insightText(insight: ApiInsight): string {
  if (typeof insight.content['text'] === 'string') return insight.content['text'];
  if (typeof insight.content['content'] === 'string') return insight.content['content'];
  return '';
}

function insightDepartment(insight: ApiInsight): string {
  return typeof insight.content['department'] === 'string' ? insight.content['department'] : '';
}

// ── Component ─────────────────────────────────────────────────────────────────

const ExpertWorkbenchView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed' | 'completed'>('pending');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newComment, setNewComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCaseSelectorModal, setShowCaseSelectorModal] = useState(false);
  const [caseIdInput, setCaseIdInput] = useState('');

  const queryClient = useQueryClient();
  const sessionId = selectedSession?.id ?? null;

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: apiComments = [] } = useQuery({
    queryKey: ['session-comments', sessionId],
    queryFn: () =>
      sessionId
        ? sessionCollabApi.listComments(sessionId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const { data: sessionInsights = [] } = useQuery({
    queryKey: ['session-insights', sessionId],
    queryFn: () =>
      sessionId
        ? insightsApi.listBySession(sessionId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const statusMap: Record<string, SessionStatus | undefined> = {
    pending: undefined,      // don't filter — show scheduled/paused (client-side filter out 'completed')
    reviewed: 'in_progress',
    completed: 'completed',
  };

  const { data: sessionsPage } = useQuery({
    queryKey: ['sessions', activeTab],
    queryFn: () => sessionsApi.list({ status: statusMap[activeTab] }).then((r) => r.data),
  });

  const apiSessions: Session[] = (sessionsPage?.data ?? []).map((s: ApiSession): Session => ({
    id: s.id,
    title: s.title,
    customer: s.clientId,
    salesPerson: s.interviewerId ?? '未分配',
    assignedAt: s.interviewDate ?? s.createdAt.slice(0, 16).replace('T', ' '),
    status: mapApiStatus(s.status),
    insightsCount: s.insightsCount ?? 0,
    commentsCount: s.commentsCount ?? 0,
  }));

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => {
      if (!sessionId) return Promise.reject(new Error('No session selected'));
      return sessionCollabApi.addComment(sessionId, { content });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['session-comments', sessionId] }),
  });

  const completeReviewMutation = useMutation({
    mutationFn: () => {
      if (!sessionId) return Promise.reject(new Error('No session selected'));
      return sessionsApi.updateStatus(sessionId, 'completed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setSelectedSession(null);
    },
  });

  const linkCaseMutation = useMutation({
    mutationFn: (caseId: string) => {
      if (!sessionId) return Promise.reject(new Error('No session selected'));
      return sessionCollabApi.addCaseLink(sessionId, { caseId });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['session-cases', sessionId] }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddComment = (_insightId: string) => {
    if (!newComment.trim() || !sessionId) return;
    addCommentMutation.mutate(newComment.trim());
    setNewComment('');
  };

  const handleLinkCase = () => {
    setCaseIdInput('');
    setShowCaseSelectorModal(true);
  };

  const handleConfirmLinkCase = () => {
    if (caseIdInput.trim()) {
      linkCaseMutation.mutate(caseIdInput.trim());
      setShowCaseSelectorModal(false);
      setCaseIdInput('');
    }
  };

  const handleCompleteReview = () => {
    if (confirm('确认完成审核？此操作将把会话状态更新为已完成。')) {
      completeReviewMutation.mutate();
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredSessions = apiSessions.filter((s) => {
    // For 'pending' tab, we show all non-completed sessions since API doesn't filter
    // For 'reviewed' and 'completed' tabs, API already filtered by status
    const matchesTab = activeTab === 'pending' ? s.status !== 'completed' : s.status === activeTab;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-64px)] flex bg-slate-50">
      {/* Left Panel — Session List */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">专家工作台</h1>
          <p className="text-sm text-slate-500 mt-1">审核和批注调研会话</p>
        </div>

        {/* Status tabs */}
        <div className="flex border-b border-slate-200">
          {(['pending', 'reviewed', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3 text-sm font-medium transition-all',
                activeTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tab === 'pending' && '待审核'}
              {tab === 'reviewed' && '已审核'}
              {tab === 'completed' && '已完成'}
              <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-xs">
                {activeTab === tab ? filteredSessions.length : '—'}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!sessionsPage ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <span className="text-sm">加载中...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <span className="text-sm">暂无会话</span>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <motion.div
                key={session.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedSession(session)}
                className={cn(
                  'p-4 rounded-2xl border cursor-pointer transition-all',
                  selectedSession?.id === session.id
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm',
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-600">{session.id}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      session.status === 'pending' && 'bg-amber-50 text-amber-600',
                      session.status === 'reviewed' && 'bg-blue-50 text-blue-600',
                      session.status === 'completed' && 'bg-emerald-50 text-emerald-600',
                    )}
                  >
                    {session.status === 'pending' && '待审核'}
                    {session.status === 'reviewed' && '已审核'}
                    {session.status === 'completed' && '已完成'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{session.title}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{session.customer}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>销售: {session.salesPerson}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{session.assignedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>{session.insightsCount} 条洞察</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MessageSquare className="w-3 h-3 text-blue-500" />
                    <span>{session.commentsCount} 条批注</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel — Session Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            {/* Session header */}
            <div className="bg-white border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedSession.title}</h2>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        selectedSession.status === 'pending' &&
                          'bg-amber-50 text-amber-600 border border-amber-100',
                        selectedSession.status === 'reviewed' &&
                          'bg-blue-50 text-blue-600 border border-blue-100',
                        selectedSession.status === 'completed' &&
                          'bg-emerald-50 text-emerald-600 border border-emerald-100',
                      )}
                    >
                      {selectedSession.status === 'pending' && '待审核'}
                      {selectedSession.status === 'reviewed' && '已审核'}
                      {selectedSession.status === 'completed' && '已完成'}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      {selectedSession.customer}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      销售: {selectedSession.salesPerson}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      分配时间: {selectedSession.assignedAt}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLinkCase}
                    disabled={linkCaseMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-medium hover:bg-indigo-100 transition-all disabled:opacity-50"
                  >
                    <Briefcase className="w-4 h-4" />
                    关联案例
                  </button>
                  <button
                    onClick={handleCompleteReview}
                    disabled={completeReviewMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    完成审核
                  </button>
                </div>
              </div>
            </div>

            {/* Insights list */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">三层洞察分析</h3>
              <div className="space-y-4">
                {sessionInsights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Sparkles className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">暂无洞察</p>
                    <p className="text-sm mt-1">请先在洞察分析页生成洞察</p>
                  </div>
                ) : (
                  sessionInsights.map((insight) => {
                    const layer = insight.layer as 1 | 2 | 3;
                    const title = insightTitle(insight);
                    const contentText = insightText(insight);
                    const department = insightDepartment(insight);

                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                layer === 1 && 'bg-slate-100 text-slate-600',
                                layer === 2 && 'bg-indigo-50 text-indigo-600',
                                layer === 3 && 'bg-emerald-50 text-emerald-600',
                              )}
                            >
                              <span className="text-lg font-bold">L{layer}</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{title}</h4>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                {department && <span>{department}</span>}
                                {department && <span>·</span>}
                                <span>{insight.createdAt.slice(0, 10)}</span>
                              </div>
                            </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Star className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-slate-600 text-sm leading-relaxed">
                          {contentText}
                        </p>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Session-level comments — shown once below all insights */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  会话批注
                </h4>
                {apiComments.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-3 space-y-3">
                    {apiComments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {comment.authorId.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">
                              {comment.authorId}
                            </span>
                            <span className="text-xs text-slate-400">
                              {comment.createdAt}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="添加会话批注..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment('')}
                    className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    onClick={() => handleAddComment('')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">选择会话查看详情</h3>
              <p className="text-slate-500 mt-1">从左侧列表选择一个调研会话开始审核</p>
            </div>
          </div>
        )}
      </div>

      {/* Case Selector Modal */}
      {showCaseSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowCaseSelectorModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">关联案例</h3>
            <p className="text-sm text-slate-500 mb-4">请输入要关联的案例 ID：</p>
            <input
              type="text"
              value={caseIdInput}
              onChange={(e) => setCaseIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmLinkCase()}
              placeholder="案例 ID（如 CASE-001）"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCaseSelectorModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLinkCase}
                disabled={!caseIdInput.trim() || linkCaseMutation.isPending}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {linkCaseMutation.isPending ? '关联中...' : '确认关联'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertWorkbenchView;
