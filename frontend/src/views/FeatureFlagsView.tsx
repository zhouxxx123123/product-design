import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Shield,
  FileText,
  Search,
  Sparkles,
  Download,
  Mic,
  MessageSquare,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  ClipboardList,
  BarChart3,
  Brain,
  BookOpen,
  Database,
  PieChart,
  Wrench,
  Settings
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { featureFlagsApi } from '../services/featureFlags';
import http from '../services/http';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Icon mapping for feature flags
const iconMap: Record<string, React.ElementType> = {
  Users, ClipboardList, FileText, Mic, BarChart3, Brain, BookOpen, Database, PieChart, Wrench,
  Download, Search, Sparkles, MessageSquare, Shield
};

interface FeatureFlagItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  iconName: string;
  icon: React.ElementType;
  sortOrder: number;
  enabled: boolean;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'sales' | 'expert' | 'ai' | 'system';
  icon: React.ElementType;
}

const categoryConfig = {
  sales: {
    label: '销售权限',
    description: '控制SALES角色的功能访问',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100'
  },
  expert: {
    label: '专家权限',
    description: '控制EXPERT角色的功能访问',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100'
  },
  ai: {
    label: 'AI 功能',
    description: '控制AI相关功能的启用状态',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100'
  },
  system: {
    label: '系统功能',
    description: '控制系统级功能的启用状态',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-100'
  }
};

const FeatureFlagsView: React.FC = () => {
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch enriched feature flags from API
  const { data: enrichedFlags = [], isLoading } = useQuery({
    queryKey: ['feature-flags-enriched'],
    queryFn: () => http.get<FeatureFlagItem[]>('/feature-flags/enriched').then(r => r.data),
  });

  const { data: remoteFlags = [] } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.list().then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (flags: { key: string; enabled: boolean }[]) => featureFlagsApi.saveAll(flags),
    onSuccess: () => setSaveStatus('saved'),
    onError: () => setSaveStatus('error'),
  });

  // Map API data to internal feature format
  const features: FeatureFlag[] = enrichedFlags.map(f => ({
    id: f.key,
    name: f.name,
    description: f.description || '',
    enabled: localFlags[f.key] !== undefined
      ? localFlags[f.key]
      : (remoteFlags.find(r => r.key === f.key)?.enabled ?? f.enabled),
    category: f.category as 'sales' | 'expert' | 'ai' | 'system',
    icon: iconMap[f.iconName] ?? Settings,
  }));

  const toggleFeature = (id: string) => {
    const current = features.find(f => f.id === id);
    setLocalFlags(prev => ({ ...prev, [id]: !(current?.enabled ?? false) }));
    if (saveStatus === 'saved') setSaveStatus('idle');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    const flagsToSave: { key: string; enabled: boolean }[] = enrichedFlags.map(f => ({
      key: f.key,
      enabled: features.find(fe => fe.id === f.key)?.enabled ?? f.enabled,
    }));
    saveMutation.mutate(flagsToSave);
  };

  const filteredFeatures = selectedCategory
    ? features.filter(f => f.category === selectedCategory)
    : features;

  const groupedFeatures = filteredFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  const enabledCount = features.filter(f => f.enabled).length;
  const totalCount = features.length;

  // Detect unsaved changes — warn on tab/window close
  const hasUnsavedChanges = Object.keys(localFlags).length > 0 && saveStatus !== 'saved';
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">功能权限开关</h1>
            <p className="text-slate-500">配置租户级功能权限，控制各角色的功能访问范围</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl">
              <span className="text-sm text-slate-500">已启用: </span>
              <span className="text-sm font-bold text-emerald-600">{enabledCount}/{totalCount}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saveStatus === 'saving' ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {/* Loading Banner */}
        {isLoading && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-500">
            正在加载功能配置...
          </div>
        )}

        {/* Save Status Toast */}
        {saveStatus === 'saved' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">配置已保存成功</span>
          </motion.div>
        )}
        {saveStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-medium">保存失败，请稍后重试</span>
          </motion.div>
        )}

        {/* Category Filter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "p-4 rounded-2xl border text-left transition-all",
              selectedCategory === null
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                : "border-slate-200 bg-white hover:border-indigo-200"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-900">全部功能</span>
            </div>
            <span className="text-xs text-slate-500">{totalCount} 个开关</span>
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = features.filter(f => f.category === key).length;
            const enabled = features.filter(f => f.category === key && f.enabled).length;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all",
                  selectedCategory === key
                    ? `${config.borderColor} ${config.bgColor} ring-2 ring-opacity-50`
                    : "border-slate-200 bg-white hover:border-indigo-200"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("font-bold", selectedCategory === key ? config.color : "text-slate-900")}>
                    {config.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  已启用 {enabled}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feature List by Category */}
        <div className="space-y-8">
          {Object.entries(groupedFeatures).map(([category, items]) => {
            const config = categoryConfig[category as keyof typeof categoryConfig];
            return (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.bgColor)}>
                    <Shield className={cn("w-5 h-5", config.color)} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{config.label}</h3>
                    <p className="text-xs text-slate-500">{config.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {items.map((feature) => (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "bg-white rounded-2xl border p-5 transition-all",
                        feature.enabled ? "border-slate-200" : "border-slate-100 bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            feature.enabled ? config.bgColor : "bg-slate-100"
                          )}>
                            <feature.icon className={cn(
                              "w-5 h-5 transition-all",
                              feature.enabled ? config.color : "text-slate-400"
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={cn(
                                "font-bold transition-all",
                                feature.enabled ? "text-slate-900" : "text-slate-500"
                              )}>
                                {feature.name}
                              </h4>
                              {!feature.enabled && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-medium">
                                  已禁用
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">{feature.description}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleFeature(feature.id)}
                          className={cn(
                            "relative w-14 h-8 rounded-full transition-all duration-300",
                            feature.enabled ? "bg-indigo-600" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300",
                            feature.enabled ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Warning Notice */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">注意事项</h4>
            <p className="text-sm text-amber-700 mt-1">
              禁用某些功能可能会影响用户的正常工作流程。建议在非工作时间进行配置变更，并提前通知相关用户。
              系统级功能的修改可能需要重新登录才能生效。
            </p>
          </div>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">确认离开？</h3>
            <p className="text-sm text-slate-500 mb-6">您有未保存的功能开关配置，离开后更改将丢失。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                继续编辑
              </button>
              <button
                onClick={() => { setLocalFlags({}); setSaveStatus('idle'); setShowLeaveConfirm(false); }}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
              >
                放弃更改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsView;
