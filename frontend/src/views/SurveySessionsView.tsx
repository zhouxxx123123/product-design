import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  BarChart2,
  Play,
  CheckCircle2,
  MoreHorizontal,
  X,
  Users,
  FileText,
  ArrowRight,
  CheckSquare,
  Square
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ViewType } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '../services/sessions';
import { clientsApi, Client } from '../services/clients';
import { templatesApi, Template } from '../services/templates';

interface SurveySessionsProps {
  onViewChange: (view: ViewType, data?: unknown) => void;
}

type SessionRow = {
  id: string;
  title: string;
  customer: string;
  date: string;
  status: string;
  duration: string;
  rawStatus: string;
  description?: string;
};

const SurveySessionsView: React.FC<SurveySessionsProps> = ({ onViewChange }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [step, setStep] = useState(1);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: ''
  });

  const toggleCustomer = (id: string) => {
    setSelectedCustomers(prev =>
      prev.includes(id) ? [] : [id]
    );
  };

  const selectAllCustomers = (customerList: { id: string }[]) => {
    if (selectedCustomers.length === customerList.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customerList.map(c => c.id));
    }
  };

  const handleTemplateSelect = (id: string, title: string) => {
    setSelectedTemplate(id);
    const firstCustomer = clients.find(c => selectedCustomers.includes(c.id));
    setSessionDetails(prev => ({
      ...prev,
      title: `${title} - ${selectedCustomers.length > 1 ? `${firstCustomer?.name ?? ''}等` : (firstCustomer?.name ?? '')}`,
    }));
  };

  const queryClient = useQueryClient();

  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list({ limit: 50 }).then(r => r.data),
  });
  const clients = (clientsData?.data ?? []).map((c: Client) => ({
    id: c.id,
    name: c.companyName,
    industry: c.industry ?? '',
    contact: c.contacts?.[0]?.name ?? '—',
  }));

  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list({ limit: 50 }).then(r => r.data),
  });
  const templates = (templatesData?.data ?? []) as Template[];
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list().then(r => r.data),
  });

  const sessionStatusLabels: Record<string, string> = {
    scheduled: '已预约',
    in_progress: '进行中',
    paused: '暂停',
    completed: '已完成',
    cancelled: '已取消',
    archived: '已归档',
  };

  const sessions = (sessionsData?.data ?? []).map(s => ({
    id: s.id,
    title: s.title,
    customer: clients.find(c => c.id === s.clientId)?.name ?? '—',
    date: s.interviewDate ?? s.createdAt,
    status: sessionStatusLabels[s.status] ?? s.status,
    duration: s.plannedDurationMinutes ? `${s.plannedDurationMinutes}分钟` : '--',
    rawStatus: s.status,
    description: s.description ?? undefined,
  }));

  // Calculate stats from real data
  const activeCount = sessions.filter(s => s.rawStatus === 'in_progress' || s.rawStatus === 'paused').length;
  const completedToday = sessions.filter(s => {
    if (s.rawStatus !== 'completed') return false;
    const sessionDate = new Date(s.date).toDateString();
    return sessionDate === new Date().toDateString();
  }).length;
  const scheduledCount = sessions.filter(s => s.rawStatus === 'scheduled').length;

  const createSessionMutation = useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case '已完成': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case '进行中': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case '已预约': return 'bg-amber-50 text-amber-600 border-amber-100';
      case '暂停': return 'bg-orange-50 text-orange-600 border-orange-100';
      case '已取消': return 'bg-red-50 text-red-600 border-red-100';
      case '已归档': return 'bg-slate-50 text-slate-600 border-slate-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto"
    >
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">调研会话</h1>
          <p className="text-slate-500 mt-1">监控并管理您的活跃及历史调研会话。</p>
        </div>
        <button 
          onClick={() => {
            setIsCreateModalOpen(true);
            setStep(1);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          <Plus className="w-5 h-5" />
          新建会话
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">当前活跃</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-1">当前正在进行的会话</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">今日完成</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{completedToday}</p>
          <p className="text-xs text-slate-500 mt-1">今日完成的会话</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">已预约</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{scheduledCount}</p>
          <p className="text-xs text-slate-500 mt-1">待进行的会话</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索会话..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              <Filter className="w-4 h-4" />
              筛选
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoadingSessions && (
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          )}
          {!isLoadingSessions && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">会话详情</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">参与者</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">状态</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">时长</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div>
                      <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">{session.id}</div>
                      <div className="font-bold text-slate-900 text-base">{session.title}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {session.date}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{session.customer}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(session.status)}`}>
                      {session.status === '进行中' && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
                      {session.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-300" />
                      {session.duration}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        onClick={() => onViewChange('survey-insights', { sessionId: session.id })}
                      >
                        <BarChart2 className="w-5 h-5" />
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenuId(activeMenuId === session.id ? null : session.id)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            activeMenuId === session.id ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        
                        <AnimatePresence>
                          {activeMenuId === session.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setActiveMenuId(null)}
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-40 overflow-hidden"
                              >
                                <button 
                                  onClick={() => {
                                    setSelectedSession(session);
                                    setIsDetailsModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                >
                                  <FileText className="w-4 h-4 text-slate-400" />
                                  查看详情
                                </button>
                                <button
                                  onClick={() => {
                                    onViewChange('survey-workspace', { sessionId: session.id });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                >
                                  <Play className="w-4 h-4 text-slate-400" />
                                  进入工作区
                                </button>
                                <button
                                  onClick={() => {
                                    onViewChange('survey-insights', { sessionId: session.id });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                >
                                  <BarChart2 className="w-4 h-4 text-slate-400" />
                                  查看洞察
                                </button>
                                <div className="h-px bg-slate-100 my-1 mx-2" />
                                <button
                                  onClick={() => { deleteSessionMutation.mutate(session.id); setActiveMenuId(null); }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                  删除会话
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">创建新调研会话</h2>
                  <p className="text-sm text-slate-500 mt-1">步骤 {step} / 3: {
                    step === 1 ? '选择参与客户' :
                    step === 2 ? '选择调研模板' :
                    '编辑会话信息'
                  }</p>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {step === 1 ? (
                  <div className="space-y-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="搜索客户名称或联系人..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    {isLoadingClients ? (
                      <div className="space-y-3 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-[24px]" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {clients.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => toggleCustomer(customer.id)}
                            className={cn(
                              "flex items-center justify-between p-5 rounded-[24px] border-2 transition-all text-left group",
                              selectedCustomers.includes(customer.id)
                                ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                                : "bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all",
                                selectedCustomers.includes(customer.id) ? "bg-indigo-600 text-white" : "bg-slate-50 text-indigo-600"
                              )}>
                                <Users className="w-6 h-6" />
                              </div>
                              <div>
                                <div className={cn("font-bold transition-all", selectedCustomers.includes(customer.id) ? "text-indigo-900" : "text-slate-900")}>
                                  {customer.name}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">{customer.industry} · 联系人: {customer.contact}</div>
                              </div>
                            </div>
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center transition-all border-2",
                              selectedCustomers.includes(customer.id)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-200 text-transparent group-hover:border-indigo-200"
                            )}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : step === 2 ? (
                  <div className="space-y-6">
                    {isLoadingTemplates ? (
                      <div className="space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-[24px]" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template.id, template.title)}
                            className={cn(
                              "p-6 rounded-[24px] border-2 transition-all text-left group",
                              selectedTemplate === template.id
                                ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                                : "bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all",
                                selectedTemplate === template.id ? "bg-indigo-600 text-white" : "bg-white text-indigo-600"
                              )}>
                                <FileText className="w-5 h-5" />
                              </div>
                              {template.category && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg shadow-sm">
                                  {template.category}
                                </span>
                              )}
                            </div>
                            <div className={cn("font-bold transition-all", selectedTemplate === template.id ? "text-indigo-900" : "text-slate-900")}>
                              {template.title}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700 block">会话标题</label>
                      <input 
                        type="text" 
                        value={sessionDetails.title}
                        onChange={(e) => setSessionDetails({...sessionDetails, title: e.target.value})}
                        placeholder="例如：Q1 跨境支付痛点深度访谈"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-700 block">预约日期</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="date" 
                            value={sessionDetails.date}
                            onChange={(e) => setSessionDetails({...sessionDetails, date: e.target.value})}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-700 block">开始时间</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="time" 
                            value={sessionDetails.time}
                            onChange={(e) => setSessionDetails({...sessionDetails, time: e.target.value})}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700 block">参与客户</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomers.map(id => {
                          const c = clients.find(cl => cl.id === id);
                          return (
                            <span key={id} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100">
                              {c?.name ?? id}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700 block">备注信息 (可选)</label>
                      <textarea 
                        value={sessionDetails.notes}
                        onChange={(e) => setSessionDetails({...sessionDetails, notes: e.target.value})}
                        placeholder="输入访谈背景或特殊要求..."
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button 
                  onClick={() => step === 1 ? setIsCreateModalOpen(false) : setStep(step - 1)}
                  className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
                >
                  {step === 1 ? '取消' : '返回上一步'}
                </button>
                <button 
                  disabled={
                    step === 1 ? selectedCustomers.length === 0 : 
                    step === 2 ? !selectedTemplate : 
                    !sessionDetails.title
                  }
                  onClick={() => {
                    if (step < 3) setStep(step + 1);
                    else {
                      createSessionMutation.mutate({
                        title: sessionDetails.title,
                        clientId: selectedCustomers[0] ?? '',
                        templateId: selectedTemplate ?? undefined,
                        interviewDate: sessionDetails.date && sessionDetails.time
                          ? `${sessionDetails.date}T${sessionDetails.time}:00`
                          : new Date().toISOString(),
                        description: sessionDetails.notes || undefined,
                      });
                      setIsCreateModalOpen(false);
                      onViewChange('survey-sessions');
                    }
                  }}
                  className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${
                    (step === 1 ? selectedCustomers.length > 0 : step === 2 ? !!selectedTemplate : !!sessionDetails.title)
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {step === 3 ? '开启会话' : '下一步'}
                  {step === 1 && selectedCustomers.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px]">
                      {selectedCustomers.length}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">{selectedSession.id}</div>
                  <h2 className="text-2xl font-bold text-slate-900">会话详情</h2>
                </div>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">会话标题</label>
                  <p className="text-lg font-bold text-slate-900">{selectedSession.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">参与客户</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <User className="w-3 h-3" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">{selectedSession.customer}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">会话状态</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(selectedSession.status)}`}>
                        {selectedSession.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">日期</label>
                    <div className="flex items-center gap-2 text-slate-600 mt-1">
                      <Calendar className="w-4 h-4 opacity-40" />
                      <p className="text-sm font-medium">{selectedSession.date}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">时长</label>
                    <div className="flex items-center gap-2 text-slate-600 mt-1">
                      <Clock className="w-4 h-4 opacity-40" />
                      <p className="text-sm font-medium">{selectedSession.duration}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">备注信息</label>
                  <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-1">
                    {selectedSession.description ?? '暂无备注信息。'}
                  </p>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                {/* 进入工作区 - primary action */}
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    onViewChange('survey-workspace', { sessionId: selectedSession.id });
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  <Play className="w-4 h-4" />
                  进入工作区
                </button>
                {/* 查看洞察 - secondary action */}
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    onViewChange('survey-insights', { sessionId: selectedSession.id });
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  <BarChart2 className="w-4 h-4" />
                  查看洞察
                </button>
                {/* 关闭 */}
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SurveySessionsView;
