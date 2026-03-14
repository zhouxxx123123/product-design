import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuditLogsService, AuditLogQuery } from './audit-logs.service';
import { AuditLogEntity, AuditAction } from '../../entities/audit-log.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<AuditLogEntity> = {}): AuditLogEntity {
  const e = new AuditLogEntity();
  e.id = 'log-uuid-001';
  e.tenantId = TENANT_ID;
  e.userId = USER_ID;
  e.action = AuditAction.LOGIN;
  e.entityType = 'session';
  e.entityId = 'session-001';
  e.oldValues = null;
  e.newValues = null;
  e.ipAddress = '192.168.1.1';
  e.userAgent = 'Mozilla/5.0';
  e.requestId = 'req-123';
  e.notes = null;
  e.createdAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(e, overrides);
}

// ─── QueryBuilder mock ────────────────────────────────────────────────────────

const makeMockQb = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
});

// ─── Mock repository factory ──────────────────────────────────────────────────

const makeMockRepo = () => ({
  createQueryBuilder: jest.fn(),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let repo: ReturnType<typeof makeMockRepo>;
  let mockQb: ReturnType<typeof makeMockQb>;

  beforeEach(async () => {
    mockQb = makeMockQb();
    repo = makeMockRepo();
    repo.createQueryBuilder.mockReturnValue(mockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns empty list when no logs found', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(TENANT_ID, {});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('returns logs list when logs exist', async () => {
      const log1 = makeLog({ id: 'log-001', action: AuditAction.LOGIN });
      const log2 = makeLog({ id: 'log-002', action: AuditAction.CREATE });
      mockQb.getManyAndCount.mockResolvedValue([[log1, log2], 2]);

      const result = await service.findAll(TENANT_ID, {});

      expect(result).toEqual({
        data: [log1, log2],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(2);
    });

    it('enforces tenantId isolation by calling where with tenantId', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, {});

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(mockQb.where).toHaveBeenCalledWith('log.tenantId = :tenantId', {
        tenantId: TENANT_ID,
      });
    });

    it('applies userId filter when provided in query', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = { userId: USER_ID };

      await service.findAll(TENANT_ID, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: USER_ID });
    });

    it('applies action filter when provided in query', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = { action: AuditAction.LOGIN };

      await service.findAll(TENANT_ID, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.action = :action', {
        action: AuditAction.LOGIN,
      });
    });

    it('applies date range filters when dateFrom and dateTo are provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      };

      await service.findAll(TENANT_ID, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.createdAt >= :dateFrom', {
        dateFrom: new Date('2026-01-01'),
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('log.createdAt <= :dateTo', {
        dateTo: new Date('2026-01-31'),
      });
    });

    it('applies entityType and entityId filters when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = {
        entityType: 'case',
        entityId: 'case-123',
      };

      await service.findAll(TENANT_ID, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('log.entityType = :entityType', {
        entityType: 'case',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('log.entityId = :entityId', {
        entityId: 'case-123',
      });
    });

    it('applies pagination correctly with skip and take', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = { page: 2, limit: 10 };

      const result = await service.findAll(TENANT_ID, query);

      expect(mockQb.skip).toHaveBeenCalledWith(10); // (page - 1) * limit = (2 - 1) * 10
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('caps limit at 100 when query limit exceeds maximum', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = { limit: 999 };

      const result = await service.findAll(TENANT_ID, query);

      expect(mockQb.take).toHaveBeenCalledWith(100); // limit capped at 100
      expect(result.limit).toBe(100);
    });

    it('uses default pagination values when not provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(TENANT_ID, {});

      expect(mockQb.skip).toHaveBeenCalledWith(0); // (1 - 1) * 20
      expect(mockQb.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('orders by createdAt DESC', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, {});

      expect(mockQb.orderBy).toHaveBeenCalledWith('log.createdAt', 'DESC');
    });

    it('calculates totalPages correctly', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 21]); // 21 total items
      const query: AuditLogQuery = { page: 1, limit: 10 };

      const result = await service.findAll(TENANT_ID, query);

      expect(result.totalPages).toBe(3); // Math.ceil(21 / 10) = 3
    });

    it('handles minimum page value correctly', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const query: AuditLogQuery = { page: 0 }; // invalid page, should default to 1

      const result = await service.findAll(TENANT_ID, query);

      expect(mockQb.skip).toHaveBeenCalledWith(0); // Math.max(0, 1) = 1, so (1-1)*20 = 0
      expect(result.page).toBe(1);
    });
  });
});
