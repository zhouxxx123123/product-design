import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Database,
  Layers,
  Settings2,
  Edit3,
  Trash2,
  FolderPlus,
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dictionaryApi, DictionaryNode as ApiNode } from '../services/dictionary';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DictionaryNodeUI extends ApiNode {
  children?: DictionaryNodeUI[];
}

function buildTree(flatNodes: ApiNode[]): DictionaryNodeUI[] {
  const map = new Map<string, DictionaryNodeUI>();
  const roots: DictionaryNodeUI[] = [];

  flatNodes.forEach(n => {
    map.set(n.id, { ...n, children: [] });
  });

  flatNodes.forEach(n => {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

const AdminDictionaryView: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<DictionaryNodeUI | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: nodesFlat = [], isLoading } = useQuery({
    queryKey: ['dictionary'],
    queryFn: () => dictionaryApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: dictionaryApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dictionary'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof dictionaryApi.update>[1] }) =>
      dictionaryApi.update(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dictionary'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: dictionaryApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionary'] });
      setSelectedNode(null);
    },
  });

  const data = buildTree(nodesFlat);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const renderTree = (nodes: DictionaryNodeUI[], depth = 0): React.ReactNode[] => {
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id);
      const isSelected = selectedNode?.id === node.id;
      const hasChildren = node.children && node.children.length > 0;

      if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase()) && !hasChildren) {
        return null;
      }

      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => {
              setSelectedNode(node);
              if (hasChildren) toggleExpand(node.id);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group",
              isSelected ? "bg-indigo-50 text-indigo-600 shadow-sm" : "hover:bg-slate-50 text-slate-600"
            )}
            style={{ marginLeft: `${depth * 16}px` }}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              {hasChildren ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
              )}
            </div>

            <span className={cn(
              "text-sm font-medium flex-1 truncate",
              isSelected ? "text-indigo-600" : "text-slate-700"
            )}>
              {node.name}
            </span>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createMutation.mutate({ name: '新建节点', parentId: node.id });
                }}
                className="p-1 hover:bg-white rounded-md text-slate-400 hover:text-indigo-600"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定删除节点"${node.name}"吗？`)) {
                    deleteMutation.mutate(node.id);
                  }
                }}
                className="p-1 hover:bg-white rounded-md text-slate-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && hasChildren && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {renderTree(node.children!, depth + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return '领域 (Domain)';
      case 2: return '子系统 (Subsystem)';
      case 3: return '功能点 (Function Point)';
      case 4: return '描述 (Description)';
      default: return `Level ${level}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col"
    >
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">数据字典管理</h1>
          <p className="text-slate-500 mt-1">维护「领域 → 子系统 → 功能点 → 描述」四级标准化分类体系。</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <Layers className="w-4 h-4" />
            层级视图
          </button>
          <button
            onClick={() => createMutation.mutate({ name: '新建领域' })}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            新增顶级领域
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Left Side: Tree Navigation */}
        <div className="w-1/3 flex flex-col bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索分类..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-10" />
                ))}
              </div>
            ) : (
              renderTree(data)
            )}
          </div>
        </div>

        {/* Right Side: Node Details / Editor */}
        <div className="flex-1 flex flex-col bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          {selectedNode ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{getLevelLabel(selectedNode.level)}</div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedNode.name}</h2>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newName = prompt('节点名称', selectedNode.name);
                      if (newName && newName !== selectedNode.name) {
                        updateMutation.mutate({ id: selectedNode.id, dto: { name: newName } });
                        setSelectedNode({ ...selectedNode, name: newName });
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`确定删除节点"${selectedNode.name}"吗？`)) {
                        deleteMutation.mutate(selectedNode.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-400" />
                    基本信息
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">节点名称</label>
                      <input
                        type="text"
                        value={selectedNode.name}
                        readOnly
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">节点 ID</label>
                      <input
                        type="text"
                        value={selectedNode.id}
                        readOnly
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono text-slate-500 outline-none"
                      />
                    </div>
                  </div>
                  {selectedNode.description && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">详细描述</label>
                      <textarea
                        value={selectedNode.description}
                        readOnly
                        rows={4}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 outline-none resize-none"
                      />
                    </div>
                  )}
                </section>

                {selectedNode.children && selectedNode.children.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        子级节点 ({selectedNode.children.length})
                      </h3>
                      <button
                        onClick={() => createMutation.mutate({ name: '新建节点', parentId: selectedNode.id })}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加子节点
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {selectedNode.children.map(child => (
                        <div key={child.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-indigo-100 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                              {selectedNode.level === 1 ? <Layers className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{child.name}</span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => {
                                const newName = prompt('节点名称', child.name);
                                if (newName && newName !== child.name) {
                                  updateMutation.mutate({ id: child.id, dto: { name: newName } });
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定删除节点"${child.name}"吗？`)) {
                                  deleteMutation.mutate(child.id);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(!selectedNode.children || selectedNode.children.length === 0) && (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[32px]">
                    <FolderPlus className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">暂无子级节点</p>
                    <button
                      onClick={() => createMutation.mutate({ name: '新建节点', parentId: selectedNode.id })}
                      className="mt-4 text-xs font-bold text-indigo-600"
                    >
                      立即添加
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6">
                <Database className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">选择一个分类节点</h3>
              <p className="text-slate-500 mt-2 max-w-xs">
                从左侧树状导航中选择一个领域、子系统或功能点，以查看其详细信息并进行管理。
              </p>
              <div className="mt-8 flex gap-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  领域
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  子系统
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  功能点
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AdminDictionaryView;
