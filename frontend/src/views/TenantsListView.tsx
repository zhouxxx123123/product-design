import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Building2, Plus, Search, Edit2, Trash2, Users } from 'lucide-react';
import { tenantsApi, type Tenant } from '../services/tenants';
import { useToastStore } from '../stores/toastStore';
import TenantFormModal from './TenantFormModal';
import TenantMembersDrawer from './TenantMembersDrawer';

export default function TenantsListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [membersDrawerTenant, setMembersDrawerTenant] = useState<Tenant | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', page, search],
    queryFn: () => tenantsApi.list({ page, limit: 10, search: search || undefined }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      useToastStore.getState().addToast('租户已删除', 'success');
    },
    onError: () => useToastStore.getState().addToast('删除失败，请重试', 'error'),
  });

  const handleDelete = (tenant: Tenant) => {
    if (!window.confirm(`确认删除租户「${tenant.name}」？此操作不可撤销。`)) return;
    deleteMutation.mutate(tenant.id);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    useToastStore.getState().addToast('租户保存成功', 'success');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">租户管理</h1>
        </div>
        <p className="text-gray-600">
          共 {data?.total || 0} 个租户
        </p>
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索租户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建租户
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.data.map((tenant) => (
              <motion.tr
                key={tenant.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-gray-50"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {tenant.slug}
                  </code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingTenant(tenant)}
                      className="text-blue-600 hover:text-blue-700 p-1"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMembersDrawerTenant(tenant)}
                      className="text-green-600 hover:text-green-700 p-1"
                      title="成员"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tenant)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            第 {data.page} 页，共 {data.totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= data.totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <TenantFormModal
        open={showCreateModal}
        tenant={null}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleFormSuccess}
      />

      <TenantFormModal
        open={editingTenant !== null}
        tenant={editingTenant}
        onClose={() => setEditingTenant(null)}
        onSuccess={handleFormSuccess}
      />

      <TenantMembersDrawer
        tenant={membersDrawerTenant}
        onClose={() => setMembersDrawerTenant(null)}
      />
    </div>
  );
}