import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Building2,
  Users,
  Tag,
  Mail,
  Phone,
  Globe,
  Download,
  Edit3,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import { ViewType } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, CreateClientDto } from '../services/clients';
import { clientExportService } from '../services/clientExport';
import { useToastStore } from '../stores/toastStore';
import { useDictionaryChildren } from '../services/dictionary';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CRMViewProps {
  onViewChange: (view: ViewType, data?: unknown) => void;
}

interface Customer {
  id: string;
  name: string;
  industry: string;
  size: string;
  contact: string;
  email: string;
  phone: string;
  tags: string[];
  status: '活跃' | '潜在' | '流失';
  lastInteraction: string;
}


const CRMView: React.FC<CRMViewProps> = ({ onViewChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [emailSent, setEmailSent] = useState(false);

  const addToast = useToastStore(s => s.addToast);

  const queryClient = useQueryClient();
  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients', searchQuery, industryFilter, selectedSizes],
    queryFn: () => clientsApi.list({
      search: searchQuery || undefined,
      industry: industryFilter || undefined
    }).then(r => r.data),
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: (clientId: string) => clientsApi.delete(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      addToast('客户档案删除成功', 'success');
    },
    onError: () => {
      addToast('删除失败，请稍后重试', 'error');
    },
  });

  // Helper functions for size filter
  const toggleSize = (sizeName: string) => {
    setSelectedSizes(prev =>
      prev.includes(sizeName)
        ? prev.filter(s => s !== sizeName)
        : [...prev, sizeName]
    );
  };

  const applyFilter = () => {
    setIsFilterModalOpen(false);
  };

  const resetAllFilters = () => {
    setSelectedSizes([]);
    setIsFilterModalOpen(false);
  };

  // Helper functions for dropdown actions
  const handleEditClient = (clientId: string) => {
    setIsMoreActionsOpen(false);
    onViewChange('crm', { customerId: clientId });
  };

  const handleDeleteClient = (clientId: string) => {
    setIsMoreActionsOpen(false);
    if (window.confirm('确定要删除这个客户档案吗？此操作无法撤销。')) {
      deleteClientMutation.mutate(clientId);
    }
  };

  const handleExportData = () => {
    setIsMoreActionsOpen(false);
    try {
      const clientsForExport = clientsData?.data || [];
      clientExportService.exportToCSV(clientsForExport, `clients_${new Date().toISOString().split('T')[0]}`);
      addToast('客户数据导出成功', 'success');
    } catch (error) {
      addToast('导出失败，请稍后重试', 'error');
    }
  };

  const handleDevelopmentFeature = (featureName: string) => {
    setIsMoreActionsOpen(false);
    addToast(`${featureName}功能开发中`, 'info');
  };

  // Email sending handler
  const handleSendEmail = () => {
    setEmailSent(true);
    addToast('邮件发送成功', 'success');
    setTimeout(() => {
      setEmailSent(false);
      setIsEmailModalOpen(false);
    }, 1500);
  };

  // Fetch dictionary data for industries and company sizes
  const { data: industries = [], isLoading: isLoadingIndustries } = useDictionaryChildren('industry');
  const { data: companySizes = [], isLoading: isLoadingCompanySizes } = useDictionaryChildren('company_size');

  // Status mapping
  const statusLabels: Record<string, string> = { active: '活跃', potential: '潜在', churned: '流失' };

  const customers: Customer[] = (clientsData?.data ?? [])
    .filter(c => selectedSizes.length === 0 || selectedSizes.includes(c.size ?? ''))
    .map(c => ({
      id: c.id,
      name: c.companyName,
      industry: c.industry ?? '',
      size: c.size ?? '',
      contact: c.contacts?.[0]?.name ?? '',
      email: c.contacts?.[0]?.email ?? '',
      phone: c.contacts?.[0]?.phone ?? '',
      tags: c.tags ?? [],
      status: (statusLabels[c.status] ?? c.status ?? '—') as Customer['status'],
      lastInteraction: c.lastInteraction ? dayjs(c.lastInteraction).format('YYYY-MM-DD') : '—',
    }));

  const createClientMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      addToast('客户档案创建成功', 'success');
    },
    onError: (error: Error) => {
      console.error('创建客户档案失败:', error);
      addToast(error?.message ?? '创建失败，请稍后重试', 'error');
    },
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isExportConfigOpen, setIsExportConfigOpen] = useState(false);
  const [isExportProgressOpen, setIsExportProgressOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<{id: string, name: string, email: string, phone: string} | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>('potential');
  const createFormRef = React.useRef<HTMLFormElement>(null);

  const handleCreateClient = () => {
    const form = createFormRef.current;
    if (!form) return;

    const formData = new FormData(form);

    // Collect optional contact fields first
    const contactName = formData.get('contactName') as string;
    const contactPosition = formData.get('contactPosition') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;

    const data: CreateClientDto = {
      companyName: formData.get('companyName') as string,
      industry: formData.get('industry') as string || undefined,
      size: formData.get('size') as string || undefined,
      status: selectedStatus === '活跃' ? 'active' : selectedStatus === '潜在' ? 'potential' : selectedStatus === '流失' ? 'churned' : 'potential',
      ...(contactName || contactEmail || contactPhone
        ? {
            contacts: [{
              name: contactName || '',
              position: contactPosition || undefined,
              email: contactEmail || undefined,
              phone: contactPhone || undefined,
            }],
          }
        : {}),
    };

    if (!data.companyName.trim()) {
      addToast('请输入公司名称', 'warning');
      return;
    }

    createClientMutation.mutate(data);
    setIsModalOpen(false);
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

  const resetExportState = () => {
    setExportProgress(0);
    setExportError(null);
    setIsExportProgressOpen(false);
  };

  const startExport = async () => {
    setIsExportConfigOpen(false);
    setIsExportProgressOpen(true);
    setExportProgress(0);
    setExportError(null);

    try {
      // Show initial progress
      setExportProgress(20);

      // Fetch all clients with current filters applied
      const params = {
        page: 1,
        limit: 1000, // Get all clients, up to reasonable limit
        search: searchQuery || undefined,
        industry: industryFilter || undefined,
      };

      setExportProgress(40);

      const response = await clientsApi.list(params);

      setExportProgress(70);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const filename = `客户档案导出_${timestamp}`;

      // Export to Excel format
      clientExportService.exportToExcel(response.data.data, filename);

      setExportProgress(100);

      // Show success message
      addToast(`成功导出 ${response.data.data.length} 个客户档案`, 'success', 3000);

    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : '导出失败，请重试');
      setExportProgress(0);

      addToast('导出失败，请重试', 'error', 5000);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case '活跃': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case '潜在': return 'bg-amber-50 text-amber-600 border-amber-100';
      case '流失': return 'bg-slate-50 text-slate-600 border-slate-100';
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">客户档案</h1>
          <p className="text-slate-500 mt-1">录入并管理客户公司信息、行业背景及联系人，为调研和案例匹配提供基础。</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExportConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" />
            创建客户档案
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/30">
          <div className="flex gap-2 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索公司名称、行业或联系人..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Filter className="w-4 h-4" />
              筛选
            </button>
          </div>
          <div className="text-sm text-slate-500">
            共计 <b>{customers.length}</b> 个客户档案
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoadingClients && (
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          )}
          {!isLoadingClients && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">公司信息</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">行业 & 规模</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">联系人</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">标签</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">状态</th>
                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr 
                  key={customer.id} 
                  onClick={() => onViewChange('crm', { customerId: customer.id })}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">{customer.id}</div>
                        <div className="font-bold text-slate-900 text-base">{customer.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <Globe className="w-3.5 h-3.5" />
                          www.{customer.name.toLowerCase().replace(' ', '')}.com
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold text-slate-700">{customer.industry}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users className="w-3.5 h-3.5" />
                        {customer.size}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold text-slate-700">{customer.contact}</div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveContact({ id: customer.id, name: customer.contact, email: customer.email, phone: customer.phone });
                            setIsEmailModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-all"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveContact({ id: customer.id, name: customer.contact, email: customer.email, phone: customer.phone });
                            setIsPhoneModalOpen(true);
                            setIsCalling(true);
                            setCallDuration(0);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {customer.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md border border-slate-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border",
                      getStatusStyle(customer.status)
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", 
                        customer.status === '活跃' ? 'bg-emerald-500' : 
                        customer.status === '潜在' ? 'bg-amber-500' : 'bg-slate-400'
                      )} />
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Edit logic
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveContact({ id: customer.id, name: customer.contact, email: customer.email, phone: customer.phone });
                          setIsMoreActionsOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        {[
          { label: '总客户数', value: '1,284', icon: Building2, color: 'indigo' },
          { label: '本月新增', value: '+24', icon: Plus, color: 'emerald' },
          { label: '活跃调研', value: '12', icon: ChevronRight, color: 'blue' },
          { label: '待跟进', value: '8', icon: Phone, color: 'amber' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">统计</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Create Customer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">创建客户档案</h2>
                    <p className="text-xs text-slate-500 mt-0.5">录入新的企业客户基础信息</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <form ref={createFormRef} className="space-y-8">
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
                        placeholder="例如: 北京中科琉光科技有限公司"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">所属行业</label>
                      <select
                        name="industry"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                      >
                        <option value="">请选择行业</option>
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
                      <select
                        name="size"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                      >
                        <option value="">请选择规模</option>
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
                        placeholder="联系人姓名"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">职位</label>
                      <input
                        type="text"
                        name="contactPosition"
                        placeholder="例如: 采购经理"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">电子邮箱</label>
                      <input
                        type="email"
                        name="contactEmail"
                        placeholder="example@company.com"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">联系电话</label>
                      <input
                        type="tel"
                        name="contactPhone"
                        placeholder="手机或座机"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Tags & Status */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    分类与标签
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">客户状态</label>
                      <div className="flex gap-2">
                        {['潜在', '活跃', '流失'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedStatus(s)}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                              selectedStatus === s
                                ? s === '潜在' ? "bg-amber-50 border-amber-200 text-amber-600"
                                  : s === '活跃' ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                  : "bg-slate-50 border-slate-200 text-slate-600"
                                : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">添加标签</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="输入标签按回车添加"
                          className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </section>
                </form>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={createClientMutation.isPending}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createClientMutation.isPending ? '创建中...' : '保存档案'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Export Configuration Modal */}
      <AnimatePresence>
        {isExportConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportConfigOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">导出客户数据</h2>
                    <p className="text-xs text-slate-500 mt-0.5">选择导出范围及格式</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">导出范围</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-4 border-2 border-indigo-600 bg-indigo-50 rounded-2xl text-left transition-all">
                      <div className="text-sm font-bold text-indigo-600">全部客户</div>
                      <div className="text-[10px] text-indigo-400 mt-1">共 {customers.length} 条记录</div>
                    </button>
                    <button className="p-4 border border-slate-200 hover:border-indigo-200 rounded-2xl text-left transition-all">
                      <div className="text-sm font-bold text-slate-700">筛选结果</div>
                      <div className="text-[10px] text-slate-400 mt-1">当前视图下的记录</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">文件格式</label>
                  <div className="flex gap-4">
                    {['Excel (.xlsx)', 'CSV (.csv)', 'PDF (.pdf)'].map((format, i) => (
                      <label key={format} className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                          i === 0 ? "border-indigo-600" : "border-slate-300 group-hover:border-indigo-300"
                        )}>
                          {i === 0 && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                        </div>
                        <span className={cn("text-sm", i === 0 ? "font-bold text-slate-900" : "text-slate-500")}>{format}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">包含字段</label>
                  <div className="flex flex-wrap gap-2">
                    {['基本信息', '联系方式', '业务标签', '互动记录', '调研摘要'].map((field, _i) => (
                      <div key={field} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                        <input type="checkbox" defaultChecked className="accent-indigo-600" />
                        {field}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setIsExportConfigOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={startExport}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  开始导出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Progress Modal */}
      <AnimatePresence>
        {isExportProgressOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => (exportProgress === 100 || exportError) && resetExportState()}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl p-8 text-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6",
                exportError ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
              )}>
                <Download className={cn(
                  "w-10 h-10",
                  exportProgress < 100 && !exportError && "animate-bounce"
                )} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {exportError
                  ? '导出失败'
                  : exportProgress < 100
                    ? '正在准备导出数据...'
                    : '数据导出成功!'
                }
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                {exportError
                  ? exportError
                  : exportProgress < 100
                    ? `正在获取和打包客户档案数据，请稍候。`
                    : '您的客户档案数据已准备就绪，Excel 文件已自动开始下载。'
                }
              </p>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${exportProgress}%` }}
                  className={cn(
                    "h-full",
                    exportError ? "bg-red-500" : "bg-indigo-600"
                  )}
                />
              </div>

              {exportProgress === 100 || exportError ? (
                <button
                  onClick={() => resetExportState()}
                  className={cn(
                    "w-full py-4 text-white rounded-2xl font-bold transition-all shadow-lg",
                    exportError
                      ? "bg-red-600 hover:bg-red-700 shadow-red-100"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {exportError ? '关闭' : '完成并关闭'}
                </button>
              ) : (
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  进度: {exportProgress}%
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Send Email Modal */}
      <AnimatePresence>
        {isEmailModalOpen && activeContact && (
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
                    <p className="text-xs text-slate-500 mt-0.5">向 {activeContact.name} 发送商务邮件</p>
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
                    {activeContact.name} &lt;{activeContact.email}&gt;
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
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailSent}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  {emailSent ? '发送中...' : '立即发送'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phone Call Modal */}
      <AnimatePresence>
        {isPhoneModalOpen && activeContact && (
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
              <div className="relative z-10">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/20">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 font-bold text-3xl">
                    {activeContact.name[0]}
                  </div>
                </div>

                <h2 className="text-2xl font-bold mb-2">{activeContact.name}</h2>
                <p className="text-indigo-300 text-sm mb-12">{isCalling ? '正在通话中...' : '通话已结束'}</p>

                <div className="text-4xl font-mono font-light mb-12 tracking-widest">
                  {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
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
      {/* Filter Modal */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900">高级筛选</h2>
                <button
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  重置全部
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">客户状态</label>
                  <div className="flex flex-wrap gap-2">
                    {['全部', '活跃', '潜在', '流失'].map(s => (
                      <button 
                        key={s}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                          s === '全部' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">企业规模</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(isLoadingCompanySizes ? [] : companySizes.length > 0 ? companySizes : [
                      { id: 'fallback-1', name: '少于50人' },
                      { id: 'fallback-2', name: '50-100人' },
                      { id: 'fallback-3', name: '100-500人' },
                      { id: 'fallback-4', name: '500人以上' }
                    ]).map(size => (
                      <label key={size.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                        <input
                          type="checkbox"
                          className="accent-indigo-600"
                          checked={selectedSizes.includes(size.name)}
                          onChange={() => toggleSize(size.name)}
                        />
                        <span className="text-xs text-slate-600 font-medium">{size.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">所属行业</label>
                  <select
                    value={industryFilter}
                    onChange={(e) => setIndustryFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                  >
                    <option value="">全部行业</option>
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
                        <option>金融科技</option>
                        <option>人工智能</option>
                        <option>电子商务</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button 
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={applyFilter}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  应用筛选
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* More Actions Modal */}
      <AnimatePresence>
        {isMoreActionsOpen && activeContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreActionsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="font-bold text-slate-900">{activeContact.name}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">更多操作选项</div>
              </div>
              <div className="p-2">
                {[
                  { icon: Edit3, label: '编辑档案', color: 'text-slate-600' },
                  { icon: Download, label: '导出该客户数据', color: 'text-slate-600' },
                  { icon: Tag, label: '管理标签', color: 'text-slate-600' },
                  { icon: ExternalLink, label: '查看公开信息', color: 'text-slate-600' },
                  { icon: Trash2, label: '删除档案', color: 'text-red-500' },
                ].map((action, i) => {
                  const handleActionClick = () => {
                    if (!activeContact) return;

                    switch (action.label) {
                      case '编辑档案':
                        handleEditClient(activeContact.id);
                        break;
                      case '导出该客户数据':
                        handleExportData();
                        break;
                      case '管理标签':
                        handleDevelopmentFeature('管理标签');
                        break;
                      case '查看公开信息':
                        handleDevelopmentFeature('查看公开信息');
                        break;
                      case '删除档案':
                        handleDeleteClient(activeContact.id);
                        break;
                      default:
                        setIsMoreActionsOpen(false);
                    }
                  };

                  return (
                    <button
                      key={i}
                      onClick={handleActionClick}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all group"
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 group-hover:bg-white shadow-sm transition-all", action.color)}>
                        <action.icon className="w-4 h-4" />
                      </div>
                      <span className={cn("text-sm font-bold", action.color)}>{action.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="p-4 bg-slate-50/50">
                <button 
                  onClick={() => setIsMoreActionsOpen(false)}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CRMView;
