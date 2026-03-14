import React from 'react';
import type { AuditLog } from '../services/audit-logs';

interface AuditLogDetailPanelProps {
  log: AuditLog;
}

const AuditLogDetailPanel: React.FC<AuditLogDetailPanelProps> = ({ log }) => {
  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return '—';
    const stringified = JSON.stringify(value);
    return stringified.length > 100 ? stringified.substring(0, 100) + '...' : stringified;
  };

  const hasValues = log.oldValues || log.newValues;
  const allKeys = hasValues
    ? Array.from(new Set([
        ...Object.keys(log.oldValues ?? {}),
        ...Object.keys(log.newValues ?? {})
      ]))
    : [];

  const isValueChanged = (key: string) => {
    const oldVal = log.oldValues?.[key];
    const newVal = log.newValues?.[key];
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 m-2">
      {/* Meta Info */}
      <div className="mb-4 space-y-1">
        <div className="text-xs text-slate-500">
          请求ID: <span className="font-mono">{log.requestId}</span>
        </div>
        <div className="text-xs text-slate-500">
          用户代理: <span className="font-mono">{log.userAgent}</span>
        </div>
      </div>

      {/* Values Diff */}
      {!hasValues || allKeys.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          暂无变更详情
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-4">
            {/* Headers */}
            <div className="flex items-center justify-center py-2">
              <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded">
                修改前
              </span>
            </div>
            <div className="flex items-center justify-center py-2">
              <span className="px-2 py-1 bg-emerald-200 text-emerald-700 text-xs rounded">
                修改后
              </span>
            </div>

            {/* Value Rows */}
            {allKeys.map((key) => {
              const oldVal = log.oldValues?.[key];
              const newVal = log.newValues?.[key];
              const hasChanged = isValueChanged(key);

              return (
                <React.Fragment key={key}>
                  <div className="border-t border-slate-200 pt-2">
                    <div className="text-xs font-medium text-slate-600 mb-1">{key}</div>
                    <div className={`text-xs font-mono break-all ${
                      hasChanged ? 'text-slate-700' : 'text-slate-400'
                    }`}>
                      {formatValue(oldVal)}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-2">
                    <div className="text-xs font-medium text-slate-600 mb-1">{key}</div>
                    <div className={`text-xs font-mono break-all ${
                      hasChanged ? 'text-emerald-700 font-medium' : 'text-slate-400'
                    }`}>
                      {formatValue(newVal)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogDetailPanel;