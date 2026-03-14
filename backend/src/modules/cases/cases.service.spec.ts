import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { CasesService } from './cases.service';
import { CaseEntity, CaseType, CaseStatus } from '../../entities/case.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const CASE_ID = 'case-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<CaseEntity> = {}): CaseEntity {
  const c = new CaseEntity();
  c.id = CASE_ID;
  c.tenantId = TENANT_ID;
  c.createdBy = USER_ID;
  c.title = 'Q1 Research Case';
  c.industry = 'Technology';
  c.caseType = CaseType.RESEARCH;
  c.content = 'Detailed case content here.';
  c.summary = 'Brief summary of the case.';
  c.tags = ['q1', 'research'];
  c.metadata = {};
  c.isPublic = false;
  c.status = CaseStatus.DRAFT;
  c.embedding = null;
  c.createdAt = new Date('2026-03-01T00:00:00Z');
  c.updatedAt = new Date('2026-03-01T00:00:00Z');
  c.deletedAt = null;
  return Object.assign(c, overrides);
}

// ─── Mock repository factory ──────────────────────────────────────────────────

const makeMockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CasesService', () => {
  let service: CasesService;
  let caseRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    caseRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CasesService, { provide: getRepositoryToken(CaseEntity), useValue: caseRepo }],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a case and sets tenantId and createdBy from parameters', async () => {
      const dto = { title: 'New Case', content: 'Case body.' };
      const caseEntity = makeCase({ title: dto.title });
      caseRepo.create.mockReturnValue(caseEntity);
      caseRepo.save.mockResolvedValue(caseEntity);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          createdBy: USER_ID,
          title: dto.title,
        }),
      );
      expect(result).toBe(caseEntity);
    });

    it('defaults tags to empty array when not provided', async () => {
      const dto = { title: 'Case', content: 'Content' };
      const caseEntity = makeCase({ tags: [] });
      caseRepo.create.mockReturnValue(caseEntity);
      caseRepo.save.mockResolvedValue(caseEntity);

      await service.create(TENANT_ID, USER_ID, dto);

      expect(caseRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
    });

    it('defaults metadata to empty object when not provided', async () => {
      const dto = { title: 'Case', content: 'Content' };
      const caseEntity = makeCase({ metadata: {} });
      caseRepo.create.mockReturnValue(caseEntity);
      caseRepo.save.mockResolvedValue(caseEntity);

      await service.create(TENANT_ID, USER_ID, dto);

      expect(caseRepo.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });

    it('uses provided tags and metadata when given', async () => {
      const dto = {
        title: 'Case',
        content: 'Content',
        tags: ['ai', 'saas'],
        metadata: { source: 'partner' },
      };
      const caseEntity = makeCase({ tags: dto.tags, metadata: dto.metadata });
      caseRepo.create.mockReturnValue(caseEntity);
      caseRepo.save.mockResolvedValue(caseEntity);

      await service.create(TENANT_ID, USER_ID, dto);

      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['ai', 'saas'], metadata: { source: 'partner' } }),
      );
    });

    it('returns the saved entity', async () => {
      const dto = { title: 'Case', content: 'Content' };
      const caseEntity = makeCase();
      caseRepo.create.mockReturnValue(caseEntity);
      caseRepo.save.mockResolvedValue(caseEntity);

      expect(await service.create(TENANT_ID, USER_ID, dto)).toBe(caseEntity);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated response shape { data, total, page, limit, totalPages }', async () => {
      const cases = [makeCase()];
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([cases, 1]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: cases,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('uses defaults page=1 and limit=20 when not provided', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { limit: 999 });

      expect(result.limit).toBe(100);
    });

    it('applies industry filter when provided', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { industry: 'Finance' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('industry'),
        expect.objectContaining({ industry: 'Finance' }),
      );
    });

    it('applies search filter when provided', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { search: 'SaaS growth' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%SaaS growth%' }),
      );
    });

    it('applies JSONB tags filter when tags query string is provided', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { tags: 'ai,saas' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('@>'),
        expect.objectContaining({ tags: JSON.stringify(['ai', 'saas']) }),
      );
    });

    it('ignores empty tags string without applying filter', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { tags: '   ' });

      const calls = (qb.andWhere as jest.Mock).mock.calls;
      const jsonbCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('@>'));
      expect(jsonbCall).toBeUndefined();
    });

    it('correctly calculates totalPages', async () => {
      const qb = caseRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 21]);
      caseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the case when found', async () => {
      const caseEntity = makeCase();
      caseRepo.findOne.mockResolvedValue(caseEntity);

      const result = await service.findById(CASE_ID, TENANT_ID);

      expect(caseRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CASE_ID, tenantId: TENANT_ID }),
        }),
      );
      expect(result).toBe(caseEntity);
    });

    it('throws NotFoundException when case is not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for case belonging to a different tenant', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(CASE_ID, 'other-tenant')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the case', async () => {
      const caseEntity = makeCase();
      caseRepo.findOne.mockResolvedValue(caseEntity);
      caseRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CASE_ID, TENANT_ID, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(caseRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when case does not exist', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', TENANT_ID, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('can update status to PUBLISHED', async () => {
      const caseEntity = makeCase({ status: CaseStatus.DRAFT });
      caseRepo.findOne.mockResolvedValue(caseEntity);
      caseRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CASE_ID, TENANT_ID, { status: CaseStatus.PUBLISHED });

      expect(result.status).toBe(CaseStatus.PUBLISHED);
    });

    it('can set isPublic to true', async () => {
      const caseEntity = makeCase({ isPublic: false });
      caseRepo.findOne.mockResolvedValue(caseEntity);
      caseRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CASE_ID, TENANT_ID, { isPublic: true });

      expect(result.isPublic).toBe(true);
    });

    it('can update caseType', async () => {
      const caseEntity = makeCase({ caseType: CaseType.RESEARCH });
      caseRepo.findOne.mockResolvedValue(caseEntity);
      caseRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CASE_ID, TENANT_ID, { caseType: CaseType.PROJECT });

      expect(result.caseType).toBe(CaseType.PROJECT);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt and returns { success: true }', async () => {
      const caseEntity = makeCase();
      caseRepo.findOne.mockResolvedValue(caseEntity);
      caseRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(CASE_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(caseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when case does not exist', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
