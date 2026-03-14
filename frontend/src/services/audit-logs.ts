import http from './http';

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'share'
  | 'archive'
  | 'restore';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const auditLogsApi = {
  list: (params?: AuditLogListParams) =>
    http.get<PaginatedAuditLogs>('/audit-logs', { params }),
};