import React, { useState } from 'react';
import {
  Users,
  Database,
  ClipboardList,
  BarChart3,
  BookOpen,
  ShieldCheck,
  LogOut,
  Search,
  MessageSquare,
  Brain,
  ToggleLeft,
  UserCog,
  Building2,
  Shield
} from 'lucide-react';
import { ViewType, UserRole } from '../types';
import { useAuthStore } from '../stores/authStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

interface NavGroup {
  title: string;
  allowedRoles: UserRole[];
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: '系统管理',
    allowedRoles: ['ADMIN', 'EXPERT'],
    items: [
      { id: 'admin-users',      label: '管理控制台', icon: ShieldCheck, allowedRoles: ['ADMIN', 'EXPERT'] },
      { id: 'admin-dictionary', label: '数据字典',   icon: Database,    allowedRoles: ['ADMIN', 'EXPERT'] },
      { id: 'admin-settings',   label: '功能开关',   icon: ToggleLeft,  allowedRoles: ['ADMIN', 'EXPERT'] },
      { id: 'admin-tenants',    label: '租户管理',   icon: Building2,   allowedRoles: ['ADMIN'] as UserRole[] },
      { id: 'admin-audit-logs', label: '审计日志',   icon: Shield,      allowedRoles: ['ADMIN'] as UserRole[] },
    ],
  },
  {
    title: '核心业务',
    allowedRoles: ['ADMIN', 'SALES', 'EXPERT'],
    items: [
      { id: 'crm', label: '客户档案', icon: Users, allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
    ],
  },
  {
    title: '调研流程',
    allowedRoles: ['ADMIN', 'SALES', 'EXPERT'],
    items: [
      { id: 'survey-sessions',  label: '调研会话',   icon: ClipboardList, allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
      { id: 'survey-templates', label: '调研模板',   icon: BookOpen,      allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
      { id: 'survey-workspace', label: '实时工作区', icon: MessageSquare, allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
      { id: 'survey-insights',  label: '洞察分析',   icon: BarChart3,     allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
    ],
  },
  {
    title: '专家工作台',
    allowedRoles: ['ADMIN', 'EXPERT'],
    items: [
      { id: 'expert-pending', label: '专家工作台', icon: UserCog, allowedRoles: ['ADMIN', 'EXPERT'] },
    ],
  },
  {
    title: '知识库',
    allowedRoles: ['ADMIN', 'SALES', 'EXPERT'],
    items: [
      { id: 'case-library', label: '案例库', icon: BookOpen, allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
    ],
  },
  {
    title: '个人账户',
    allowedRoles: ['ADMIN', 'SALES', 'EXPERT'],
    items: [
      { id: 'settings', label: '记忆管理', icon: Brain, allowedRoles: ['ADMIN', 'SALES', 'EXPERT'] },
    ],
  },
];

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const role: UserRole = (user?.role as UserRole) ?? 'SALES';
  const [sidebarSearch, setSidebarSearch] = useState('');

  const visibleGroups = navGroups
    .filter((group) => group.allowedRoles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const hasRoleAccess = item.allowedRoles.includes(role);
        const matchesSearch = sidebarSearch === '' ||
          item.label.toLowerCase().includes(sidebarSearch.toLowerCase());
        return hasRoleAccess && matchesSearch;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <ShieldCheck className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-800">OpenClaw</span>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="快速搜索..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-6 py-4">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <h3 className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={`${group.title}-${item.id}`}
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    currentView === item.id
                      ? "bg-indigo-50 text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", currentView === item.id ? "text-indigo-600" : "text-slate-400")} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={() => { clearAuth(); onViewChange('login'); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
