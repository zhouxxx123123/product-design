import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { X, UserMinus, Loader2, Plus } from 'lucide-react';
import { tenantsApi, type Tenant, type TenantMember, type AddMemberDto } from '../services/tenants';
import { useToastStore } from '../stores/toastStore';

interface TenantMembersDrawerProps {
  tenant: Tenant | null;
  onClose: () => void;
}

export default function TenantMembersDrawer({ tenant, onClose }: TenantMembersDrawerProps) {
  const [newMember, setNewMember] = useState({
    userId: '',
    role: 'member' as AddMemberDto['role'],
  });

  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['tenant-members', tenant?.id],
    queryFn: () => tenant ? tenantsApi.listMembers(tenant.id).then(r => r.data) : Promise.resolve([]),
    enabled: Boolean(tenant),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ tenantId, memberData }: { tenantId: string; memberData: AddMemberDto }) =>
      tenantsApi.addMember(tenantId, memberData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members', tenant?.id] });
      useToastStore.getState().addToast('成员添加成功', 'success');
      setNewMember({ userId: '', role: 'member' });
    },
    onError: () => useToastStore.getState().addToast('添加成员失败，请重试', 'error'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
      tenantsApi.removeMember(tenantId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members', tenant?.id] });
      useToastStore.getState().addToast('成员已移除', 'success');
    },
    onError: () => useToastStore.getState().addToast('移除成员失败，请重试', 'error'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ tenantId, userId, role }: { tenantId: string; userId: string; role: TenantMember['role'] }) =>
      tenantsApi.updateMemberRole(tenantId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members', tenant?.id] });
      useToastStore.getState().addToast('角色已更新', 'success');
    },
    onError: () => useToastStore.getState().addToast('更新角色失败，请重试', 'error'),
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !newMember.userId.trim()) return;

    addMemberMutation.mutate({
      tenantId: tenant.id,
      memberData: newMember,
    });
  };

  const handleRemoveMember = (member: TenantMember) => {
    if (!tenant || !window.confirm(`确认移除成员「${member.userId}」？`)) return;

    removeMemberMutation.mutate({
      tenantId: tenant.id,
      userId: member.userId,
    });
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700';
      case 'admin':
        return 'bg-red-100 text-red-700';
      case 'member':
        return 'bg-blue-100 text-blue-700';
      case 'viewer':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return '所有者';
      case 'admin':
        return '管理员';
      case 'member':
        return '成员';
      case 'viewer':
        return '只读';
      default:
        return role;
    }
  };

  const getRoleSelectClass = (role: string) => {
    switch (role) {
      case 'owner': return 'text-purple-700 bg-purple-50 border-purple-200 focus:ring-purple-400';
      case 'admin': return 'text-blue-700 bg-blue-50 border-blue-200 focus:ring-blue-400';
      case 'member': return 'text-green-700 bg-green-50 border-green-200 focus:ring-green-400';
      case 'viewer': return 'text-gray-600 bg-gray-50 border-gray-200 focus:ring-gray-400';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 focus:ring-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const getAvatarLetter = (userId: string) => {
    return userId.charAt(0).toUpperCase();
  };

  return (
    <>
      {/* Backdrop */}
      {tenant && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <motion.div
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50"
        initial={{ x: '100%' }}
        animate={{ x: tenant ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {tenant && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  租户成员
                </h2>
                <p className="text-sm text-gray-500">{tenant.name}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {members?.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-medium">
                        {getAvatarLetter(member.userId)}
                      </div>

                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {member.userId}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={member.role}
                            onChange={(e) => {
                              if (!tenant) return;
                              updateRoleMutation.mutate({
                                tenantId: tenant.id,
                                userId: member.userId,
                                role: e.target.value as TenantMember['role'],
                              });
                            }}
                            disabled={updateRoleMutation.isPending}
                            className={`text-xs font-medium px-2 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-offset-1 ${getRoleSelectClass(member.role)}`}
                          >
                            <option value="viewer">只读</option>
                            <option value="member">成员</option>
                            <option value="admin">管理员</option>
                            <option value="owner">所有者</option>
                          </select>
                          <span className="text-xs text-gray-500">
                            {formatDate(member.joinedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          disabled={removeMemberMutation.isPending}
                          className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                          title="移除成员"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {members?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      暂无成员
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Member Form */}
            <div className="border-t p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">添加成员</h3>
              <form onSubmit={handleAddMember} className="space-y-3">
                <input
                  type="text"
                  placeholder="用户 ID"
                  value={newMember.userId}
                  onChange={(e) => setNewMember(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />

                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value as AddMemberDto['role'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="viewer">只读</option>
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                  <option value="owner">所有者</option>
                </select>

                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !newMember.userId.trim()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {addMemberMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  添加成员
                </button>
              </form>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}