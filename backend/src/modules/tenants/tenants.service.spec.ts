import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { IsNull } from 'typeorm';

import { TenantsService } from './tenants.service';
import { TenantEntity } from '../../entities/tenant.entity';
import { TenantMemberEntity, MemberRole } from '../../entities/tenant-member.entity';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<TenantEntity> = {}): TenantEntity {
  const t = new TenantEntity();
  t.id = TENANT_ID;
  t.name = '测试租户';
  t.slug = 'test-tenant';
  t.aiConfig = { provider: 'moonshot', model: 'kimi-k2.5', temperature: 0.7 };
  t.settings = {};
  t.deletedAt = null;
  t.createdAt = new Date('2026-03-01');
  t.updatedAt = new Date('2026-03-01');
  return Object.assign(t, overrides);
}

function makeMember(overrides: Partial<TenantMemberEntity> = {}): TenantMemberEntity {
  const m = new TenantMemberEntity();
  m.id = 'member-uuid-001';
  m.tenantId = TENANT_ID;
  m.userId = USER_ID;
  m.role = MemberRole.MEMBER;
  m.joinedAt = new Date('2026-03-01');
  return Object.assign(m, overrides);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let memberRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  // Chainable query builder mock — re-created per test to avoid state bleed
  let mockQb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    tenantRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    memberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getRepositoryToken(TenantEntity), useValue: tenantRepo },
        { provide: getRepositoryToken(TenantMemberEntity), useValue: memberRepo },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('calls queryBuilder and returns paginated result with correct metadata', async () => {
      const tenants = [makeTenant()];
      mockQb.getManyAndCount.mockResolvedValue([tenants, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(tenantRepo.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(result).toMatchObject({
        data: tenants,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('applies andWhere with ILIKE when search is provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'acme' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%acme%' }),
      );
    });

    it('clamps limit to 100 even if a larger value is requested', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ limit: 9999 });

      expect(result.limit).toBe(100);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns tenant when found', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);

      const result = await service.findById(TENANT_ID);

      expect(tenantRepo.findOne).toHaveBeenCalledWith({
        where: { id: TENANT_ID, deletedAt: IsNull() },
      });
      expect(result).toBe(tenant);
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      tenantRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('saves and returns the new tenant when slug is unique', async () => {
      tenantRepo.findOne.mockResolvedValue(null); // no conflict
      const tenant = makeTenant();
      tenantRepo.create.mockReturnValue(tenant);
      tenantRepo.save.mockResolvedValue(tenant);

      const result = await service.create({ name: '测试租户', slug: 'test-tenant' });

      expect(tenantRepo.save).toHaveBeenCalled();
      expect(result).toBe(tenant);
    });

    it('applies default aiConfig when none is provided', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      const tenant = makeTenant();
      tenantRepo.create.mockReturnValue(tenant);
      tenantRepo.save.mockResolvedValue(tenant);

      await service.create({ name: '新租户', slug: 'new-tenant' });

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aiConfig: { provider: 'moonshot', model: 'kimi-k2.5', temperature: 0.7 },
        }),
      );
    });

    it('throws ConflictException when slug already exists', async () => {
      tenantRepo.findOne.mockResolvedValue(makeTenant()); // existing record

      await expect(service.create({ name: '重复租户', slug: 'test-tenant' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('merges fields and saves the updated tenant', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(TENANT_ID, { name: '新名称' });

      expect(tenantRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: '新名称' }));
      expect(result.name).toBe('新名称');
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt to a Date and saves, then returns { success: true }', async () => {
      const tenant = makeTenant();
      tenantRepo.findOne.mockResolvedValue(tenant);
      tenantRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(tenantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });
  });

  // ── addMember ─────────────────────────────────────────────────────────────

  describe('addMember()', () => {
    it('creates and saves a member when user is not already a member', async () => {
      memberRepo.findOne.mockResolvedValue(null); // no existing member
      const member = makeMember();
      memberRepo.create.mockReturnValue(member);
      memberRepo.save.mockResolvedValue(member);

      const result = await service.addMember(TENANT_ID, {
        userId: USER_ID,
        role: MemberRole.MEMBER,
      });

      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, userId: USER_ID, role: MemberRole.MEMBER }),
      );
      expect(result).toBe(member);
    });

    it('throws ConflictException when user is already a tenant member', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember()); // already exists

      await expect(
        service.addMember(TENANT_ID, { userId: USER_ID, role: MemberRole.MEMBER }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe('removeMember()', () => {
    it('removes the member and returns { success: true } when member exists', async () => {
      const member = makeMember();
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.remove.mockResolvedValue(undefined);

      const result = await service.removeMember(TENANT_ID, USER_ID);

      expect(memberRepo.remove).toHaveBeenCalledWith(member);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when member does not exist', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(service.removeMember(TENANT_ID, 'unknown-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
