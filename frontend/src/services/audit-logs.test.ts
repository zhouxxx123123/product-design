import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from './http';
import { auditLogsApi } from './audit-logs';
import type { AuditLogListParams } from './audit-logs';

vi.mock('./http');
const mockHttp = vi.mocked(http);

describe('auditLogsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() calls GET /audit-logs without params', async () => {
    const mockData = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    mockHttp.get = vi.fn().mockResolvedValue({ data: mockData });
    const result = await auditLogsApi.list();
    expect(mockHttp.get).toHaveBeenCalledWith('/audit-logs', { params: undefined });
    expect(result.data).toEqual(mockData);
  });

  it('list() passes filter params to GET /audit-logs', async () => {
    const params: AuditLogListParams = {
      page: 2,
      limit: 10,
      action: 'login',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    };
    mockHttp.get = vi.fn().mockResolvedValue({ data: { data: [], total: 0, page: 2, limit: 10, totalPages: 0 } });
    await auditLogsApi.list(params);
    expect(mockHttp.get).toHaveBeenCalledWith('/audit-logs', { params });
  });

  it('list() returns paginated response shape', async () => {
    const mockData = {
      data: [
        {
          id: '1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'create',
          entityType: 'Survey',
          entityId: 'entity-1',
          oldValues: null,
          newValues: { title: 'New Survey' },
          ipAddress: '127.0.0.1',
          userAgent: null,
          requestId: null,
          notes: null,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockHttp.get = vi.fn().mockResolvedValue({ data: mockData });
    const result = await auditLogsApi.list();
    expect(result.data.data).toHaveLength(1);
    expect(result.data.total).toBe(1);
  });
});