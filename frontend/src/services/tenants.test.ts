import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from './http';
import { tenantsApi } from './tenants';

vi.mock('./http');
const mockHttp = vi.mocked(http);

describe('tenantsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() calls GET /tenants', async () => {
    const mockData = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    mockHttp.get = vi.fn().mockResolvedValue({ data: mockData });
    await tenantsApi.list({ page: 1 });
    expect(mockHttp.get).toHaveBeenCalledWith('/tenants', { params: { page: 1 } });
  });

  it('list() without params calls GET /tenants with undefined params', async () => {
    mockHttp.get = vi.fn().mockResolvedValue({ data: {} });
    await tenantsApi.list();
    expect(mockHttp.get).toHaveBeenCalledWith('/tenants', { params: undefined });
  });

  it('get() calls GET /tenants/:id', async () => {
    mockHttp.get = vi.fn().mockResolvedValue({ data: { id: '123' } });
    await tenantsApi.get('123');
    expect(mockHttp.get).toHaveBeenCalledWith('/tenants/123');
  });

  it('create() calls POST /tenants', async () => {
    const dto = { name: 'Test', slug: 'test' };
    mockHttp.post = vi.fn().mockResolvedValue({ data: { id: '1', ...dto } });
    await tenantsApi.create(dto);
    expect(mockHttp.post).toHaveBeenCalledWith('/tenants', dto);
  });

  it('update() calls PATCH /tenants/:id', async () => {
    const dto = { name: 'Updated' };
    mockHttp.patch = vi.fn().mockResolvedValue({ data: {} });
    await tenantsApi.update('123', dto);
    expect(mockHttp.patch).toHaveBeenCalledWith('/tenants/123', dto);
  });

  it('delete() calls DELETE /tenants/:id', async () => {
    mockHttp.delete = vi.fn().mockResolvedValue({ data: { success: true } });
    await tenantsApi.delete('123');
    expect(mockHttp.delete).toHaveBeenCalledWith('/tenants/123');
  });

  it('listMembers() calls GET /tenants/:id/members', async () => {
    mockHttp.get = vi.fn().mockResolvedValue({ data: [] });
    await tenantsApi.listMembers('123');
    expect(mockHttp.get).toHaveBeenCalledWith('/tenants/123/members');
  });

  it('addMember() calls POST /tenants/:id/members', async () => {
    const dto = { userId: 'user1', role: 'member' as const };
    mockHttp.post = vi.fn().mockResolvedValue({ data: {} });
    await tenantsApi.addMember('123', dto);
    expect(mockHttp.post).toHaveBeenCalledWith('/tenants/123/members', dto);
  });

  it('removeMember() calls DELETE /tenants/:id/members/:uid', async () => {
    mockHttp.delete = vi.fn().mockResolvedValue({ data: { success: true } });
    await tenantsApi.removeMember('123', 'user1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/tenants/123/members/user1');
  });
});