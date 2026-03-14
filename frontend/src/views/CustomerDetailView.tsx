import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  Phone,
  Globe,
  FileText,
  MessageSquare,
  Briefcase,
  Edit3,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  Trash2,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import { clientsApi } from '../services/clients';
import { sessionsApi, type SessionStatus } from '../services/sessions';
import { insightsApi, type Insight } from '../services/insights';
import { casesApi } from '../services/cases';
import { useToastStore } from '../stores/toastStore';
import { useDictionaryChildren } from '../services/dictionary';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ViewType } from '../types';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onViewChange: (view: ViewType) => void;
}

function formatClientStatus(status: string): string {
  switch (status) {
    case 'active': return '活跃客户';
    case 'potential': return '潜在客户';
    case 'churned': return '流失客户';
    default: return status;
  }
}

function formatSessionStatus(status: SessionStatus): string {
  switch (status) {
    case 'completed': return '已完成';
    case 'in_progress': return '进行中';
    case 'scheduled': return '已预约';
    case 'paused': return '已暂停';
    case 'cancelled': return '已取消';
    case 'archived': return '已归档';
    default: return status;
  }
}

const CustomerDetailView: React.FC<CustomerDetailProps> = ({ customerId, onBack, onViewChange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'surveys' | 'cases' | 'history'>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const addToast = useToastStore(s => s.addToast);

  const queryClient = useQueryClient();
  const editFormRef = useRef<HTMLFormElement>(null);

  const updateMutation = useMutation({
    mutationFn: (formData: {
      companyName: string;
      industry: string;
      size: string;
      contactName: string;
      contactTitle: string;
      contactEmail: string;
      contactPhone: string;
    }) => {
      const contacts = [];
      if (formData.contactName || formData.contactEmail || formData.contactPhone) {
        contacts.push({
          name: formData.contactName,
          title: formData.contactTitle,
          email: formData.contactEmail,
          phone: formData.contactPhone,
        });
      }
      return clientsApi.update(customerId, {
        companyName: formData.companyName,
        industry: formData.industry,
        size: formData.size,
        contacts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', customerId] });
      setIsEditModalOpen(false);
      addToast('客户档案更新成功', 'success');
    },
    onError: (error) => {
      console.error('更新客户档案失败:', error);
      addToast(error?.message ?? '更新失败，请稍后重试', 'error');
    },
  });

  const handleUpdateClient = () => {
    const form = editFormRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const data = {
      companyName: formData.get('companyName') as string,
      industry: formData.get('industry') as string,
      size: formData.get('size') as string,
      contactName: formData.get('contactName') as string,
      contactTitle: formData.get('contactTitle') as string,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string,
    };

    if (!data.companyName.trim()) {
      addToast('请输入公司名称', 'warning');
      return;
    }

    updateMutation.mutate(data);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCalling) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', customerId],
    queryFn: () => clientsApi.get(customerId).then(r => r.data),
    enabled: !!customerId,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions', { clientId: customerId }],
    queryFn: () => sessionsApi.list({ page: 1, limit: 50, clientId: customerId }).then(r => r.data),
    enabled: !!customerId,
  });

  const customerSessions = sessionsData?.data ?? [];

  // Get the most recent completed session for this client
  const latestSession = customerSessions
    .filter(s => s.status === 'completed')
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];

  const { data: latestInsights = [] } = useQuery({
    queryKey: ['insights', latestSession?.id],
    queryFn: () => insightsApi.listBySession(latestSession!.id).then(r => r.data),
    enabled: !!latestSession?.id,
  });

  const { data: casesData } = useQuery({
    queryKey: ['cases', { page: 1, limit: 20 }],
    queryFn: () => casesApi.list({ page: 1, limit: 20 }).then(r => r.data),
    enabled: !!customerId,
  });

  // Fetch dictionary data for industries and company sizes
  const { data: industries = [], isLoading: isLoadingIndustries } = useDictionaryChildren('industry');
  const { data: companySizes = [], isLoading: isLoadingCompanySizes } = useDictionaryChildren('company_size');

  const relatedCases = (casesData?.data ?? []).filter(c =>
    c.content?.includes(client?.companyName ?? '') ||
    c.industry === client?.industry
  );

  // Derive primary contact from contacts array
  const primaryContact = client?.contacts?.[0];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-slate-500">客户不存在或已删除</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-48 bg-slate-200 rounded-xl" />
                <div className="h-4 w-32 bg-slate-100 rounded-lg" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{client?.companyName}</h1>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold">
                    {formatClientStatus(client?.status ?? '')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    {client?.industry ?? '未知行业'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    创建时间: {client?.createdAt ? new Date(client.createdAt).toLocaleDateString('zh-CN') : '--'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    上次互动: {client?.lastInteraction ? dayjs(client.lastInteraction).fromNow() : '暂无记录'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            编辑档案
          </button>
          <button
            onClick={() => onViewChange('survey-workspace')}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" />
            发起新调研
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Main Content */}
        <div className="col-span-8 space-y-8">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100/50 rounded-2xl w-fit">
            {[
              { id: 'overview', label: '概览', icon: FileText },
              { id: 'surveys', label: '调研记录', icon: MessageSquare },
              { id: 'cases', label: '关联案例', icon: Briefcase },
              { id: 'history', label: '互动历史', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'surveys' | 'cases' | 'history')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 min-h-[500px]">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <section className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">详细信息</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-400">企业规模</span>
                        <span className="text-sm font-semibold text-slate-700">{client?.size ?? '--'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-400">所属行业</span>
                        <span className="text-sm font-semibold text-slate-700">{client?.industry ?? '--'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-400">创建时间</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {client?.createdAt ? new Date(client.createdAt).toLocaleDateString('zh-CN') : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-400">上次互动</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {client?.lastInteraction ? dayjs(client.lastInteraction).fromNow() : '暂无记录'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">业务标签</h3>
                    <div className="flex flex-wrap gap-2">
                      {(client?.tags ?? []).length > 0
                        ? (client?.tags ?? []).map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-100">
                              {tag}
                            </span>
                          ))
                        : <span className="text-sm text-slate-400">暂无标签</span>
                      }
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'surveys' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">调研记录</h3>
                  <button
                    onClick={() => onViewChange('survey-workspace')}
                    className="text-sm font-bold text-indigo-600 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    发起调研
                  </button>
                </div>
                <div className="space-y-3">
                  {customerSessions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">暂无调研记录</p>
                  ) : (
                    customerSessions.map(session => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{session.title}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {session.id} · {new Date(session.interviewDate ?? session.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className={cn(
                              "text-[10px] font-bold mt-1",
                              session.status === 'completed' ? "text-emerald-500" : "text-amber-500"
                            )}>{formatSessionStatus(session.status)}</div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-8">
                <h3 className="text-lg font-bold text-slate-900">互动时间轴</h3>
                {customerSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">暂无互动记录</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                    <div className="space-y-4">
                      {customerSessions.map((session, _idx) => (
                        <div key={session.id} className="relative flex gap-4 pl-10">
                          <div className="absolute left-2.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white" />
                          <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-slate-900">{session.title}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(session.interviewDate ?? session.createdAt).toLocaleDateString('zh-CN')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatSessionStatus(session.status)}
                              {session.plannedDurationMinutes ? ` · ${session.plannedDurationMinutes} 分钟` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cases' && (
              <div className="space-y-8">
                <h3 className="text-lg font-bold text-slate-900">关联案例</h3>
                {relatedCases.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-sm text-slate-400">暂无关联案例</p>
                    <p className="text-xs text-slate-300 mt-1">同行业或相关客户的案例将在此展示</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {relatedCases.map(c => (
                      <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all cursor-pointer group">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{c.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {c.industry && (
                                <span className="text-xs text-slate-400">{c.industry}</span>
                              )}
                              {c.status && (
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                  c.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                )}>
                                  {c.status === 'published' ? '已发布' : c.status}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                        {c.summary && (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{c.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar Info */}
        <div className="col-span-4 space-y-8">
          {/* Contact Card */}
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                核心联系人
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-14 w-14 bg-slate-200 rounded-2xl" />
                  <div className="h-5 w-28 bg-slate-200 rounded-lg" />
                  <div className="h-4 w-20 bg-slate-100 rounded-lg" />
                </div>
              ) : primaryContact ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {primaryContact.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-lg">{primaryContact.name}</div>
                      <div className="text-xs text-slate-500">{primaryContact.title ?? ''}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {primaryContact.email && (
                      <button
                        onClick={() => setIsEmailModalOpen(true)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group"
                      >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                          <Mail className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-slate-600 group-hover:text-indigo-600 truncate">{primaryContact.email}</span>
                      </button>
                    )}
                    {primaryContact.phone && (
                      <button
                        onClick={() => {
                          setIsPhoneModalOpen(true);
                          setIsCalling(true);
                          setCallDuration(0);
                        }}
                        className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group"
                      >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                          <Phone className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-slate-600 group-hover:text-indigo-600">{primaryContact.phone}</span>
                      </button>
                    )}
                  </div>

                  {(client?.contacts?.length ?? 0) > 1 && (
                    <button className="w-full py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all">
                      查看所有 {client?.contacts?.length} 个联系人
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">暂无联系人信息</p>
              )}
            </div>
          </div>

          {/* Quick Actions / Stats */}
          <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100">
            <h3 className="text-lg font-bold mb-4">调研洞察摘要</h3>
            {latestInsights.length > 0 ? (
              <div className="space-y-4">
                {latestInsights.slice(0, 3).map((insight: Insight) => (
                  <div key={insight.id} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-indigo-50 leading-relaxed">
                      {typeof insight.content['text'] === 'string'
                        ? insight.content['text']
                        : typeof insight.content['content'] === 'string'
                        ? insight.content['content']
                        : `洞察 #${insight.id.slice(-4)}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-indigo-200 leading-relaxed">
                {customerSessions.length === 0
                  ? '暂无调研记录，完成首次调研后将自动生成洞察摘要。'
                  : '暂无洞察数据，请在调研工作台中提取洞察。'}
              </p>
            )}
            <button
              onClick={() => onViewChange('customer-portrait')}
              className="w-full mt-8 py-3 bg-white text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all"
            >
              生成完整客户画像
            </button>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Edit3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">编辑客户档案</h2>
                    <p className="text-xs text-slate-500 mt-0.5">更新 {client?.companyName} 的企业基础信息</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <form ref={editFormRef} className="space-y-8">
                  {/* Basic Info Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      企业基础信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">公司名称 <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="companyName"
                          defaultValue={client?.companyName}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">所属行业</label>
                        <select name="industry" defaultValue={client?.industry ?? ''} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none">
                          <option value="">请选择</option>
                          {isLoadingIndustries ? (
                            <option disabled>加载中...</option>
                          ) : industries.length > 0 ? (
                            industries.map(industry => (
                              <option key={industry.id} value={industry.name}>
                                {industry.name}
                              </option>
                            ))
                          ) : (
                            // Fallback to hardcoded options if no dictionary data
                            <>
                              <option value="金融科技">金融科技</option>
                              <option value="人工智能">人工智能</option>
                              <option value="电子商务">电子商务</option>
                              <option value="文化创意">文化创意</option>
                              <option value="传统制造">传统制造</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">企业规模</label>
                        <select name="size" defaultValue={client?.size ?? ''} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none">
                          <option value="">请选择</option>
                          {isLoadingCompanySizes ? (
                            <option disabled>加载中...</option>
                          ) : companySizes.length > 0 ? (
                            companySizes.map(size => (
                              <option key={size.id} value={size.name}>
                                {size.name}
                              </option>
                            ))
                          ) : (
                            // Fallback to hardcoded options if no dictionary data
                            <>
                              <option value="少于50人">少于50人</option>
                              <option value="50-100人">50-100人</option>
                              <option value="100-500人">100-500人</option>
                              <option value="500-1000人">500-1000人</option>
                              <option value="1000人以上">1000人以上</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Contact Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      核心联系人
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">姓名</label>
                        <input
                          type="text"
                          name="contactName"
                          defaultValue={primaryContact?.name}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">职位</label>
                        <input
                          type="text"
                          name="contactTitle"
                          defaultValue={primaryContact?.title}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">电子邮箱</label>
                        <input
                          type="email"
                          name="contactEmail"
                          defaultValue={primaryContact?.email}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">联系电话</label>
                        <input
                          type="tel"
                          name="contactPhone"
                          defaultValue={primaryContact?.phone}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </section>
                </form>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateClient}
                  disabled={updateMutation.isPending}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {updateMutation.isPending ? '更新中...' : '更新档案'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Send Email Modal */}
      <AnimatePresence>
        {isEmailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmailModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">发送邮件</h2>
                    <p className="text-xs text-slate-500 mt-0.5">向 {primaryContact?.name} 发送商务邮件</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">收件人</label>
                  <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
                    {primaryContact?.name} &lt;{primaryContact?.email}&gt;
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">邮件主题</label>
                  <input
                    type="text"
                    placeholder="请输入邮件主题"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">正文内容</label>
                  <textarea
                    rows={8}
                    placeholder="请输入邮件正文..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus className="w-4 h-4" />
                    添加附件
                  </button>
                  <button className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-600">
                    使用模板
                  </button>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  立即发送
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phone Call Modal */}
      <AnimatePresence>
        {isPhoneModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCalling && setIsPhoneModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-slate-900 rounded-[40px] shadow-2xl p-10 text-center text-white overflow-hidden border border-white/10"
            >
              {/* Animated background pulse */}
              {isCalling && (
                <div className="absolute inset-0 z-0">
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl"
                  />
                </div>
              )}

              <div className="relative z-10">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/20 relative">
                  {isCalling && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 border-2 border-white/30 rounded-full"
                    />
                  )}
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 font-bold text-3xl">
                    {primaryContact?.name?.[0] ?? '?'}
                  </div>
                </div>

                <h2 className="text-2xl font-bold mb-2">{primaryContact?.name}</h2>
                <p className="text-indigo-300 text-sm mb-12">{isCalling ? '正在通话中...' : '通话已结束'}</p>

                <div className="text-4xl font-mono font-light mb-12 tracking-widest">
                  {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                </div>

                <div className="grid grid-cols-3 gap-6 mb-12">
                  {[
                    { icon: MessageSquare, label: '静音' },
                    { icon: Users, label: '添加' },
                    { icon: Globe, label: '视频' },
                  ].map((btn) => (
                    <button key={btn.label} className="flex flex-col items-center gap-2 group">
                      <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                        <btn.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] text-white/50">{btn.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setIsCalling(false);
                    setTimeout(() => setIsPhoneModalOpen(false), 1000);
                  }}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl",
                    isCalling ? "bg-red-500 hover:bg-red-600 rotate-[135deg]" : "bg-emerald-500"
                  )}
                >
                  <Phone className="w-8 h-8 text-white fill-current" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CustomerDetailView;
