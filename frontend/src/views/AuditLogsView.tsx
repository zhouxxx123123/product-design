import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Shield, Filter, ChevronRight } from 'lucide-react';
import { auditLogsApi, type AuditLog, type AuditAction } from '../services/audit-logs';
import AuditLogDetailPanel from './AuditLogDetailPanel';

const ACTION_COLORS: Record<AuditAction, string> = {
  create:  'bg-emerald-100 text-emerald-700',
  read:    'bg-sky-100 text-sky-700',
  update:  'bg-amber-100 text-amber-700',
  delete:  'bg-red-100 text-red-700',
  login:   'bg-blue-100 text-blue-700',
  logout:  'bg-slate-100 text-slate-600',
  export:  'bg-purple-100 text-purple-700',
  import:  'bg-indigo-100 text-indigo-700',
  share:   'bg-pink-100 text-pink-700',
  archive: 'bg-orange-100 text-orange-700',
  restore: 'bg-teal-100 text-teal-700',
};

const AuditLogsView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, dateFrom, dateTo, filterAction],
    queryFn: () => auditLogsApi.list({
      page,
      limit: 20,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      action: (filterAction as AuditAction) || undefined,
    }).then(r => r.data),
  });

  const hasActiveFilters = dateFrom || dateTo || filterAction;

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterAction('');
    setPage(1);
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-800">审计日志</h1>
        </div>
        {data && (
          <div className="text-sm text-slate-600">
            第 {page} 页 / 共 {data.totalPages} 页
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
        <Filter className="h-4 w-4 text-slate-500" />

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">从</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">到</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded text-sm"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value as AuditAction | '')}
          className="px-3 py-1 border border-slate-300 rounded text-sm"
        >
          <option value="">全部操作</option>
          <option value="create">创建</option>
          <option value="read">读取</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="login">登录</option>
          <option value="logout">登出</option>
          <option value="export">导出</option>
          <option value="import">导入</option>
          <option value="share">分享</option>
          <option value="archive">归档</option>
          <option value="restore">恢复</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded hover:bg-slate-50"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">加载中...</div>
        ) : !data?.data.length ? (
          <div className="p-8 text-center text-slate-500">暂无审计日志</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-slate-700">时间</th>
                <th className="text-left p-3 text-sm font-medium text-slate-700">用户ID</th>
                <th className="text-left p-3 text-sm font-medium text-slate-700">操作</th>
                <th className="text-left p-3 text-sm font-medium text-slate-700">资源类型</th>
                <th className="text-left p-3 text-sm font-medium text-slate-700">资源ID</th>
                <th className="text-left p-3 text-sm font-medium text-slate-700">IP地址</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((log: AuditLog) => (
                <React.Fragment key={log.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-sm text-slate-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="p-3 text-sm font-mono text-slate-800">
                      {log.userId}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action as AuditAction] ?? 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-600">
                      {log.entityType}
                    </td>
                    <td className="p-3 text-sm font-mono text-slate-600">
                      {log.entityId}
                    </td>
                    <td className="p-3 text-sm font-mono text-slate-600">
                      {log.ipAddress}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <ChevronRight
                          className={`h-4 w-4 text-slate-500 transition-transform ${
                            expandedLogId === log.id ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                  {expandedLogId === log.id && (
                    <tr>
                      <td colSpan={7}>
                        <AuditLogDetailPanel log={log} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>

          <span className="text-sm text-slate-600">
            第 {page} 页 / 共 {data.totalPages} 页
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= data.totalPages}
            className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default AuditLogsView;