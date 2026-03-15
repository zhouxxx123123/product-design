import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '../services/cases';
import {
  Search,
  Filter,
  Folder,
  Clock,
  User,
  Tag,
  ChevronRight,
  Plus,
  Grid,
  List,
  MoreHorizontal,
  X,
  Loader2,
  CheckCircle2
} from 'lucide-react';

const CaseLibraryView: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [industryFilterCase, setIndustryFilterCase] = useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showToast, setShowToast] = useState(false);
  const [newCase, setNewCase] = useState({
    title: '',
    industry: '',
    content: '',
    summary: '',
  });
  const [editForm, setEditForm] = useState({
    title: '',
    industry: '',
    content: '',
    summary: '',
    tags: [] as string[],
  });

  const queryClient = useQueryClient();

  // Debounce search input with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: casesData, isLoading: isLoadingCases } = useQuery({
    queryKey: ['cases', debouncedSearch, industryFilterCase],
    queryFn: () => casesApi.list({
      search: debouncedSearch || undefined,
      industry: industryFilterCase || undefined
    }).then(r => r.data),
  });

  const { data: selectedCaseData } = useQuery({
    queryKey: ['case', selectedCaseId],
    queryFn: () => selectedCaseId ? casesApi.get(selectedCaseId).then(r => r.data) : null,
    enabled: !!selectedCaseId,
  });

  const createMutation = useMutation({
    mutationFn: () => casesApi.create(newCase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setIsCreateModalOpen(false);
      setNewCase({ title: '', industry: '', content: '', summary: '' });
    },
    onError: (error) => {
      console.error('创建案例失败:', error);
      alert('创建失败，请稍后重试');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => casesApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setIsEditModalOpen(false);
      setEditingCase(null);
    },
    onError: () => {
      alert('更新失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => casesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setOpenMenuId(null);
    },
    onError: () => {
      alert('删除失败，请稍后重试');
    },
  });

  const handleCreateCase = () => {
    if (!newCase.title.trim()) {
      alert('请输入案例标题');
      return;
    }
    if (!newCase.content.trim()) {
      alert('请输入案例内容');
      return;
    }
    createMutation.mutate();
  };

  const handleEditCase = async (caseItem: typeof cases[0]) => {
    try {
      // Fetch full case data to get all fields
      const { data: fullCase } = await casesApi.get(caseItem.id);
      setEditingCase(fullCase);
      setEditForm({
        title: fullCase.title,
        industry: fullCase.industry ?? '',
        content: fullCase.content ?? '',
        summary: fullCase.summary ?? '',
        tags: fullCase.tags ?? [],
      });
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch case details for editing:', error);
      alert('无法获取案例详情，请稍后重试');
    }
    setOpenMenuId(null);
  };

  const handleUpdateCase = () => {
    if (!editForm.title.trim()) {
      alert('请输入案例标题');
      return;
    }
    updateMutation.mutate({
      id: editingCase.id,
      dto: editForm,
    });
  };

  const handleShareCase = async (caseItem: any) => {
    try {
      const shareUrl = `${window.location.origin}/cases/${caseItem.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      setOpenMenuId(null);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('复制失败，请稍后重试');
    }
  };

  const cases = (casesData?.data ?? []).map(c => ({
    id: c.id,
    title: c.title,
    preview: c.summary || (c.content ? c.content.substring(0, 100) + '...' : ''),
    industry: c.industry ?? '',
    date: c.createdAt,
    status: c.status,
    tags: c.tags ?? [],
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case '已完成': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case '审核中': return 'bg-amber-50 text-amber-600 border-amber-100';
      case '活跃': return 'bg-blue-50 text-blue-600 border-blue-100';
      case '草稿': return 'bg-slate-50 text-slate-600 border-slate-100';
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">案例库</h1>
          <p className="text-slate-500 mt-1">探索并管理您组织中的所有智能案例。</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          <Plus className="w-5 h-5" />
          创建新案例
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-8 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-[400px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="按 ID、标题、客户或标签搜索案例..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-sm"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter className="w-5 h-5" />
              筛选
              {industryFilterCase && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
            </button>
            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-4 min-w-[200px]">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">所属行业</p>
                  <div className="space-y-1">
                    {['', '金融科技', '人工智能', '新能源', '数字化转型', '电子商务'].map((opt) => (
                      <button
                        key={opt || '__all__'}
                        onClick={() => { setIndustryFilterCase(opt); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${industryFilterCase === opt ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {opt || '全部行业'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoadingCases && (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-2"}>
          {[1, 2, 3].map(i => (
            <div key={i} className={viewMode === 'grid' ? "animate-pulse bg-slate-100 rounded-[32px] h-64" : "animate-pulse bg-slate-100 rounded-2xl h-16"} />
          ))}
        </div>
      )}
      {!isLoadingCases && (
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200"}>
        {cases.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ y: viewMode === 'grid' ? -4 : 0 }}
            onClick={() => setSelectedCaseId(item.id === selectedCaseId ? null : item.id)}
            className={
              viewMode === 'grid'
                ? `bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group ${selectedCaseId === item.id ? 'ring-2 ring-indigo-500' : ''}`
                : `p-4 flex items-center gap-4 hover:bg-slate-50 transition-all cursor-pointer group ${selectedCaseId === item.id ? 'bg-indigo-50' : ''}`
            }
          >
            {viewMode === 'grid' ? (
              /* Grid View Layout */
              <>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-all">
                    <Folder className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-all" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mb-6">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{item.id}</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1 leading-tight group-hover:text-indigo-600 transition-all">{item.title}</h3>
                  <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {item.preview}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {item.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-4 h-4" />
                    {item.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === item.id ? null : item.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === item.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                          />
                          <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCase(item);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                              编辑
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareCase(item);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                              分享
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                if (confirm(`确认删除案例"${item.title}"？此操作不可撤销。`)) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                            >
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* List View Layout */
              <>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-all flex-shrink-0">
                  <Folder className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-all" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex-shrink-0">{item.id}</span>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-all truncate">{item.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[120px]">{item.preview}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {item.date}
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {item.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-medium rounded border border-slate-100 truncate">
                          <Tag className="w-2.5 h-2.5 flex-shrink-0" />
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[9px] text-slate-400">+{item.tags.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenuId === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCase(item);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            编辑
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareCase(item);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            分享
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              if (confirm(`确认删除案例"${item.title}"？此操作不可撤销。`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                          >
                            删除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="w-6 h-6 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </>
            )}

            {/* Expandable detail - only show in grid view */}
            {viewMode === 'grid' && selectedCaseId === item.id && selectedCaseData && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="space-y-3">
                  {selectedCaseData.summary && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">摘要</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{selectedCaseData.summary}</p>
                    </div>
                  )}
                  {selectedCaseData.content && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">详细内容</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{selectedCaseData.content}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {viewMode === 'grid' && selectedCaseId === item.id && !selectedCaseData && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      )}

      {/* Create Case Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">创建新案例</h2>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例标题 *</label>
                  <input
                    type="text"
                    value={newCase.title}
                    onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                    placeholder="输入案例标题"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">所属行业</label>
                  <input
                    type="text"
                    value={newCase.industry}
                    onChange={(e) => setNewCase({ ...newCase, industry: e.target.value })}
                    placeholder="如：金融科技、人工智能"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例内容 *</label>
                  <textarea
                    value={newCase.content}
                    onChange={(e) => setNewCase({ ...newCase, content: e.target.value })}
                    placeholder="描述案例的详细内容..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例摘要</label>
                  <textarea
                    value={newCase.summary}
                    onChange={(e) => setNewCase({ ...newCase, summary: e.target.value })}
                    placeholder="简短摘要..."
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCase}
                  disabled={createMutation.isPending}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {createMutation.isPending ? '创建中...' : '创建案例'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Case Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingCase && (
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
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Folder className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">编辑案例</h2>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例标题 *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="输入案例标题"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">所属行业</label>
                  <input
                    type="text"
                    value={editForm.industry}
                    onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                    placeholder="如：金融科技、人工智能"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例内容 *</label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    placeholder="描述案例的详细内容..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">案例摘要</label>
                  <textarea
                    value={editForm.summary}
                    onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                    placeholder="简短摘要..."
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">标签</label>
                  <input
                    type="text"
                    value={editForm.tags.join(', ')}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
                    placeholder="用逗号分隔多个标签"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateCase}
                  disabled={updateMutation.isPending}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {updateMutation.isPending ? '保存中...' : '保存修改'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            链接已复制
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CaseLibraryView;
