import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MemoriesService, MemoryListQuery } from './memories.service';
import { CopilotMemoryEntity, MemoryType } from '../../entities/copilot-memory.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-001';
const TENANT_ID = 'tenant-uuid-001';
const MEMORY_ID = 'memory-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMemory(overrides: Partial<CopilotMemoryEntity> = {}): CopilotMemoryEntity {
  const m = new CopilotMemoryEntity();
  m.id = MEMORY_ID;
  m.userId = USER_ID;
  m.tenantId = TENANT_ID;
  m.content = '用户偏好：深色模式';
  m.type = MemoryType.PREFERENCE;
  m.source = null;
  m.createdAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(m, overrides);
}

// ─── Mock repository factory ──────────────────────────────────────────────────

const makeMockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MemoriesService', () => {
  let service: MemoriesService;
  let memoryRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    memoryRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoriesService,
        { provide: getRepositoryToken(CopilotMemoryEntity), useValue: memoryRepo },
      ],
    }).compile();

    service = module.get<MemoriesService>(MemoriesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns empty list with correct pagination structure', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(USER_ID, TENANT_ID, {});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('returns data list when memories exist', async () => {
      const memory = makeMemory();
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[memory], 1]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(USER_ID, TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: [memory],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('enforces userId and tenantId isolation', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(USER_ID, TENANT_ID, {});

      expect(qb.where).toHaveBeenCalledWith('m.userId = :userId AND m.tenantId = :tenantId', {
        userId: USER_ID,
        tenantId: TENANT_ID,
      });
    });

    it('applies search filter when provided', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const query: MemoryListQuery = { search: '模式' };
      await service.findAll(USER_ID, TENANT_ID, query);

      expect(qb.andWhere).toHaveBeenCalledWith('m.content ILIKE :search', { search: '%模式%' });
    });

    it('applies type filter when provided', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const query: MemoryListQuery = { type: MemoryType.PREFERENCE };
      await service.findAll(USER_ID, TENANT_ID, query);

      expect(qb.andWhere).toHaveBeenCalledWith('m.type = :type', { type: MemoryType.PREFERENCE });
    });

    it('uses default page=1 and limit=20 when not provided', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(USER_ID, TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(USER_ID, TENANT_ID, { limit: 999 });

      expect(result.limit).toBe(100);
    });

    it('orders by createdAt DESC', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(USER_ID, TENANT_ID, {});

      expect(qb.orderBy).toHaveBeenCalledWith('m.createdAt', 'DESC');
    });

    it('applies pagination with skip and take', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(USER_ID, TENANT_ID, { page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20); // (3 - 1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('calculates totalPages correctly', async () => {
      const qb = memoryRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 25]);
      memoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(USER_ID, TENANT_ID, { limit: 10 });

      expect(result.totalPages).toBe(3); // Math.ceil(25 / 10)
    });
  });

  // ── deleteOne ─────────────────────────────────────────────────────────────

  describe('deleteOne()', () => {
    it('deletes the memory successfully', async () => {
      memoryRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteOne(MEMORY_ID, USER_ID);

      expect(memoryRepo.delete).toHaveBeenCalledWith({ id: MEMORY_ID, userId: USER_ID });
      expect(result).toEqual({ success: true });
    });

    it('still returns success even if no record was affected', async () => {
      memoryRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteOne('nonexistent-id', USER_ID);

      expect(memoryRepo.delete).toHaveBeenCalledWith({ id: 'nonexistent-id', userId: USER_ID });
      expect(result).toEqual({ success: true });
    });
  });

  // ── deleteAll ─────────────────────────────────────────────────────────────

  describe('deleteAll()', () => {
    it('deletes all memories for user and tenant successfully', async () => {
      memoryRepo.delete.mockResolvedValue({ affected: 5 });

      const result = await service.deleteAll(USER_ID, TENANT_ID);

      expect(memoryRepo.delete).toHaveBeenCalledWith({ userId: USER_ID, tenantId: TENANT_ID });
      expect(result).toEqual({ success: true });
    });

    it('returns success even when no memories exist', async () => {
      memoryRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteAll(USER_ID, TENANT_ID);

      expect(memoryRepo.delete).toHaveBeenCalledWith({ userId: USER_ID, tenantId: TENANT_ID });
      expect(result).toEqual({ success: true });
    });
  });

  // ── exportAll ─────────────────────────────────────────────────────────────

  describe('exportAll()', () => {
    it('returns all memories for user and tenant ordered by createdAt DESC', async () => {
      const memory1 = makeMemory({ id: 'mem-1', content: '记忆1' });
      const memory2 = makeMemory({ id: 'mem-2', content: '记忆2' });
      const memories = [memory1, memory2];

      memoryRepo.find.mockResolvedValue(memories);

      const result = await service.exportAll(USER_ID, TENANT_ID);

      expect(memoryRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID, tenantId: TENANT_ID },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(memories);
    });

    it('returns empty array when no memories exist', async () => {
      memoryRepo.find.mockResolvedValue([]);

      const result = await service.exportAll(USER_ID, TENANT_ID);

      expect(memoryRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID, tenantId: TENANT_ID },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([]);
    });
  });
});
