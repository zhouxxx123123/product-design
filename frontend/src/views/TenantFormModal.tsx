import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import { tenantsApi, type Tenant, type CreateTenantDto, type UpdateTenantDto } from '../services/tenants';
import { useToastStore } from '../stores/toastStore';

interface TenantFormModalProps {
  open: boolean;
  tenant?: Tenant | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TenantFormModal({ open, tenant, onClose, onSuccess }: TenantFormModalProps) {
  const isEditing = Boolean(tenant);
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    slug: tenant?.slug || '',
    model: tenant?.aiConfig?.model || 'moonshot-v1-8k',
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateTenantDto) => tenantsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onSuccess();
      onClose();
      resetForm();
    },
    onError: () => useToastStore.getState().addToast('保存失败，请重试', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTenantDto }) =>
      tenantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onSuccess();
      onClose();
    },
    onError: () => useToastStore.getState().addToast('保存失败，请重试', 'error'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      model: 'moonshot-v1-8k',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.slug.trim()) {
      useToastStore.getState().addToast('请填写必填字段', 'error');
      return;
    }

    if (isEditing && tenant) {
      updateMutation.mutate({
        id: tenant.id,
        data: {
          name: formData.name,
          aiConfig: {
            ...tenant.aiConfig,
            model: formData.model,
          },
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        slug: formData.slug,
        aiConfig: {
          provider: 'moonshot',
          model: formData.model,
          temperature: 0.7,
        },
      });
    }
  };

  const handleClose = () => {
    if (!isEditing) resetForm();
    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Update form data when tenant prop changes
  React.useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name,
        slug: tenant.slug,
        model: tenant.aiConfig?.model || 'moonshot-v1-8k',
      });
    }
  }, [tenant]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? '编辑租户' : '新建租户'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              租户名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="输入租户名称"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="输入 slug（英文，用于 URL）"
              readOnly={isEditing}
              required
            />
            {isEditing && (
              <p className="text-xs text-gray-500 mt-1">编辑时 slug 不可修改</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI 模型
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="moonshot-v1-8k"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}