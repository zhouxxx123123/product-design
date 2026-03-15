import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  MoreVertical,
  UserPlus,
  Download,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  X,
  Trash2,
  Edit2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User, UpdateUserDto } from '../services/users';
import { useToastStore } from '../stores/toastStore';

const AdminUsersView: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserDto>({});

  // Permission Modal state
  const [permissionUserId, setPermissionUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'sales' | 'expert'>('sales');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Filter state
  const [activeRoleFilter, setActiveRoleFilter] = useState<string[]>([]);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string[]>([]);

  const [newUser, setNewUser] = useState<{
    displayName: string;
    email: string;
    role: 'sales' | 'expert';
    password: string;
  }>({
    displayName: '',
    email: '',
    role: 'sales',
    password: '',
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', searchQuery, currentPage],
    queryFn: () => usersApi.list({ search: searchQuery || undefined, page: currentPage, limit: PAGE_SIZE }).then(r => r.data),
  });
  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Client-side filtering
  const filteredUsers = users.filter(u => {
    const roleMatch = activeRoleFilter.length === 0 || activeRoleFilter.includes(u.role.toLowerCase());
    const statusMatch = activeStatusFilter.length === 0 ||
      (activeStatusFilter.includes('活跃') && u.isActive) ||
      (activeStatusFilter.includes('离线') && !u.isActive);
    return roleMatch && statusMatch;
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const createUserMutation = useMutation({
    mutationFn: () => usersApi.create({
      displayName: newUser.displayName,
      email: newUser.email,
      role: newUser.role,
      password: newUser.password,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsAddModalOpen(false);
      setNewUser({ displayName: '', email: '', role: 'sales', password: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'sales' | 'expert' }) =>
      usersApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPermissionUserId(null);
      useToastStore.getState().addToast('角色修改成功', 'success');
    },
    onError: () => {
      // Keep modal open on error
      useToastStore.getState().addToast('角色修改失败，请重试', 'error');
    },
  });

  const getStatusStyle = (isActive: boolean) => {
    return isActive
      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
      : 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive
      ? <CheckCircle2 className="w-3 h-3" />
      : <XCircle className="w-3 h-3" />;
  };

  const getStatusLabel = (isActive: boolean) => isActive ? '活跃' : '离线';

  const handleExportCSV = () => {
    if (users.length === 0) {
      alert('暂无用户数据可导出');
      return;
    }

    const headers = ['姓名', '邮箱', '角色', '状态', '创建时间'];
    const rows = users.map(u => [
      u.displayName,
      u.email,
      u.role,
      u.isActive ? '活跃' : '离线',
      new Date(u.createdAt).toLocaleDateString('zh-CN'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto"
    >
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">用户管理</h1>
          <p className="text-slate-500 mt-1">管理您的团队成员及其访问权限。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            添加新用户
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
          <div className="flex gap-2 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="按姓名、邮箱或角色搜索..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
                  isFilterOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                筛选
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsFilterOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-40"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">按角色筛选</h4>
                      <div className="space-y-2">
                        {['sales', 'expert', 'admin'].map(role => (
                          <label key={role} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={activeRoleFilter.includes(role.toLowerCase())}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setActiveRoleFilter(prev => [...prev, role.toLowerCase()]);
                                } else {
                                  setActiveRoleFilter(prev => prev.filter(r => r !== role.toLowerCase()));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-600 group-hover:text-slate-900">
                              {role === 'sales' ? '销售' : role === 'expert' ? '专家' : '管理员'}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="h-px bg-slate-100 my-4" />
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">按状态筛选</h4>
                      <div className="space-y-2">
                        {['活跃', '离线'].map(status => (
                          <label key={status} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={activeStatusFilter.includes(status)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setActiveStatusFilter(prev => [...prev, status]);
                                } else {
                                  setActiveStatusFilter(prev => prev.filter(s => s !== status));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-600 group-hover:text-slate-900">{status}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">
                        应用筛选
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>显示 <b>{filteredUsers.length}</b> / <b>{total}</b> 名用户</span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-50"
              >&lt;</button>
              <span className="w-8 h-8 flex items-center justify-center text-xs text-slate-500">{currentPage}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-50"
              >&gt;</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading && (
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl" />
              ))}
            </div>
          )}
          {!isLoading && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">用户信息</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">角色</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">状态</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">最后活跃</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user: User) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl
                        ? <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                        : <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{user.displayName.charAt(0)}</div>
                      }
                      <div>
                        <div className="font-semibold text-slate-900">{user.displayName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Shield className="w-4 h-4 text-indigo-500" />
                      {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusStyle(user.isActive)}`}>
                      {getStatusIcon(user.isActive)}
                      {getStatusLabel(user.isActive)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative">
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                        className={`p-2 rounded-lg transition-all ${
                          activeMenuId === user.id ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      <AnimatePresence>
                        {activeMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-40 overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditForm({ displayName: user.displayName, role: user.role as UpdateUserDto['role'], isActive: user.isActive });
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                                <Edit2 className="w-4 h-4 text-slate-400" />
                                编辑资料
                              </button>
                              <button
                                onClick={() => {
                                  const user = users.find(u => u.id === activeMenuId);
                                  if (user) {
                                    setPermissionUserId(user.id);
                                    setSelectedRole(user.role as 'admin' | 'sales' | 'expert');
                                    setActiveMenuId(null);
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                                <Shield className="w-4 h-4 text-slate-400" />
                                权限设置
                              </button>
                              <div className="h-px bg-slate-100 my-1 mx-2" />
                              <button
                                onClick={() => { deleteMutation.mutate(user.id); setActiveMenuId(null); }}
                                className="w-full px-4 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                移除用户
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">添加新用户</h2>
                  <p className="text-sm text-slate-500 mt-1">邀请新成员加入您的团队。</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">姓名</label>
                  <input
                    type="text"
                    placeholder="例如：张伟"
                    value={newUser.displayName}
                    onChange={e => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">电子邮箱</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">密码</label>
                  <input
                    type="password"
                    placeholder="设置初始密码"
                    value={newUser.password}
                    onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">角色</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as 'sales' | 'expert' }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="sales">销售</option>
                    <option value="expert">专家</option>
                  </select>
                </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewUser({ displayName: '', email: '', role: 'sales', password: '' });
                  }}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => createUserMutation.mutate()}
                  disabled={createUserMutation.isPending || !newUser.displayName || !newUser.email || !newUser.password}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createUserMutation.isPending ? '创建中...' : '发送邀请'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">编辑用户资料</h2>
                  <p className="text-sm text-slate-500 mt-1">修改用户的基本信息。</p>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">姓名</label>
                  <input
                    type="text"
                    placeholder="例如：张伟"
                    value={editForm.displayName || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">角色</label>
                  <select
                    value={editForm.role || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value as UpdateUserDto['role'] }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="sales">销售</option>
                    <option value="expert">专家</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">状态</label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isActive ?? true}
                      onChange={e => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">用户活跃状态</span>
                  </label>
                </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: editingUser.id, dto: editForm })}
                  disabled={updateMutation.isPending || !editForm.displayName}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? '保存中...' : '保存修改'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permission Settings Modal */}
      <AnimatePresence>
        {permissionUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPermissionUserId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">权限设置</h2>
                  <p className="text-sm text-slate-500 mt-1">修改用户的角色权限。</p>
                </div>
                <button
                  onClick={() => setPermissionUserId(null)}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">选择角色</label>
                  <div className="space-y-3">
                    {[
                      { value: 'admin', label: '管理员', desc: '拥有系统完整管理权限' },
                      { value: 'sales', label: '销售', desc: '可以管理客户和调研项目' },
                      { value: 'expert', label: '专家', desc: '可以查看和分析调研数据' }
                    ].map((role) => (
                      <label key={role.value} className="flex items-start gap-3 cursor-pointer group p-4 border border-slate-200 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={selectedRole === role.value}
                          onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'sales' | 'expert')}
                          className="mt-1 w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{role.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{role.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={() => setPermissionUserId(null)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (!permissionUserId) return;
                    changeRoleMutation.mutate({ id: permissionUserId, role: selectedRole });
                  }}
                  disabled={changeRoleMutation.isPending}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changeRoleMutation.isPending ? '保存中...' : '确认修改'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminUsersView;
