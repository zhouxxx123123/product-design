import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Search,
  Trash2,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Settings,
  Clock,
  Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memoriesApi, MemoryType, Memory } from '../services/memories';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const typeConfig = {
  preference: {
    label: '偏好记忆',
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100'
  },
  learning: {
    label: '学习记忆',
    icon: Brain,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100'
  },
  conversation: {
    label: '对话记忆',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100'
  },
  setting: {
    label: '设置偏好',
    icon: Settings,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100'
  }
};

const MemoryManagementView: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType | ''>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const { data: memoriesData, isLoading } = useQuery({
    queryKey: ['memories', searchQuery, selectedType],
    queryFn: () => memoriesApi.list({
      search: searchQuery || undefined,
      type: selectedType !== '' ? selectedType : undefined,
    }).then(r => r.data),
  });

  const memories: Memory[] = memoriesData?.data ?? [];
  const memoryCount = memoriesData?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => memoriesApi.deleteOne(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setShowDeleteConfirm(null);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => memoriesApi.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setShowClearConfirm(false);
    },
  });

  const handleExport = async () => {
    const res = await memoriesApi.export();
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memories.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMemories = memories.filter(m => {
    const matchesSearch = m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (m.source ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType ? m.type === selectedType : true;
    return matchesSearch && matchesType;
  });

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">记忆管理</h1>
          <p className="text-slate-500">管理 OpenClaw 存储的个人记忆，控制AI助手的个性化建议</p>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 flex items-start gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 mb-1">关于记忆管理</h3>
            <p className="text-sm text-indigo-700">
              这些记忆帮助 OpenClaw 更好地理解您的偏好和工作习惯，从而提供更个性化的建议和辅助。
              删除记忆后，AI助手将不再基于该记忆调整行为。
            </p>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px] max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索记忆内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">共 {memoryCount} 条记忆</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              清空全部
            </button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedType('')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              selectedType === ''
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
            )}
          >
            全部
          </button>
          {Object.entries(typeConfig).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type as MemoryType)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                selectedType === type
                  ? `${config.bgColor} ${config.color} border ${config.borderColor}`
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
              )}
            >
              <config.icon className="w-4 h-4" />
              {config.label}
            </button>
          ))}
        </div>

        {/* Memory List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-200 p-6 h-28" />
              ))}
            </div>
          )}
          {!isLoading && (
            <AnimatePresence>
              {filteredMemories.map((memory) => {
                const config = typeConfig[memory.type];
                return (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                            <config.icon className={cn("w-4 h-4", config.color)} />
                          </div>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.bgColor, config.color)}>
                            {config.label}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {memory.createdAt}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed mb-3">
                          {memory.content}
                        </p>
                        {memory.source && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">来源:</span>
                            <span className="text-xs text-indigo-600 hover:underline cursor-pointer">
                              {memory.source}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setShowDeleteConfirm(memory.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="删除记忆"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {!isLoading && filteredMemories.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">暂无记忆</h3>
              <p className="text-slate-500">
                {searchQuery ? '没有匹配的记忆，请尝试其他搜索词' : 'OpenClaw 还没有记录您的使用偏好'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">删除记忆</h3>
                  <p className="text-sm text-slate-500">此操作无法撤销</p>
                </div>
              </div>
              <p className="text-slate-600 mb-6">
                确定要删除这条记忆吗？删除后 OpenClaw 将不再基于该记忆提供个性化建议。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all disabled:opacity-60"
                >
                  {deleteMutation.isPending ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear All Confirm Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">清空全部记忆</h3>
                  <p className="text-sm text-slate-500">危险操作</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-600">
                  <strong>警告：</strong> 这将删除您的所有 {memoryCount} 条记忆，OpenClaw 将重置为默认状态，需要重新学习您的偏好。
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteAllMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all disabled:opacity-60"
                >
                  {deleteAllMutation.isPending ? '清空中...' : '确认清空'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemoryManagementView;
