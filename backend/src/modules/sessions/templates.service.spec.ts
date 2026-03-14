import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { TemplatesService } from './templates.service';
import { TemplateEntity, TemplateType, TemplateScope } from '../../entities/template.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const TEMPLATE_ID = 'template-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<TemplateEntity> = {}): TemplateEntity {
  const t = new TemplateEntity();
  t.id = TEMPLATE_ID;
  t.tenantId = TENANT_ID;
  t.createdBy = USER_ID;
  t.name = 'Interview Template';
  t.code = 'INT_001';
  t.templateType = TemplateType.INTERVIEW;
  t.description = 'A standard interview template';
  t.content = { departments: [], settings: {} };
  t.scope = TemplateScope.TENANT;
  t.tags = [];
  t.variables = {};
  t.usageCount = 0;
  t.isActive = true;
  t.isDefault = false;
  t.metadata = {};
  t.createdAt = new Date('2026-03-01T00:00:00Z');
  t.updatedAt = new Date('2026-03-01T00:00:00Z');
  t.deletedAt = null;
  return Object.assign(t, overrides);
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
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TemplatesService', () => {
  let service: TemplatesService;
  let templateRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    templateRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: getRepositoryToken(TemplateEntity), useValue: templateRepo },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a template with tenantId and createdBy set', async () => {
      const dto = {
        name: 'New Template',
        content: { departments: [] },
      };
      const template = makeTemplate({ name: dto.name });
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          createdBy: USER_ID,
          name: dto.name,
        }),
      );
      expect(result).toBe(template);
    });

    it('defaults content to empty object when not provided', async () => {
      const dto = { name: 'Template' };
      const template = makeTemplate();
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      await service.create(TENANT_ID, USER_ID, dto as any);

      expect(templateRepo.create).toHaveBeenCalledWith(expect.objectContaining({ content: {} }));
    });

    it('defaults tags to empty array when not provided', async () => {
      const dto = { name: 'Template', content: {} };
      const template = makeTemplate();
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      await service.create(TENANT_ID, USER_ID, dto as any);

      expect(templateRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
    });

    it('defaults variables to empty object when not provided', async () => {
      const dto = { name: 'Template', content: {} };
      const template = makeTemplate();
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      await service.create(TENANT_ID, USER_ID, dto as any);

      expect(templateRepo.create).toHaveBeenCalledWith(expect.objectContaining({ variables: {} }));
    });

    it('defaults metadata to empty object when not provided', async () => {
      const dto = { name: 'Template', content: {} };
      const template = makeTemplate();
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      await service.create(TENANT_ID, USER_ID, dto as any);

      expect(templateRepo.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });

    it('uses provided tags when given', async () => {
      const dto = { name: 'Template', content: {}, tags: ['tag1', 'tag2'] };
      const template = makeTemplate({ tags: dto.tags });
      templateRepo.create.mockReturnValue(template);
      templateRepo.save.mockResolvedValue(template);

      await service.create(TENANT_ID, USER_ID, dto as any);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['tag1', 'tag2'] }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated response shape { data, total, page, limit, totalPages }', async () => {
      const templates = [makeTemplate()];
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([templates, 1]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: templates,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('uses defaults page=1 and limit=20 when not provided', async () => {
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100', async () => {
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { limit: 9999 });

      expect(result.limit).toBe(100);
    });

    it('applies templateType filter when provided', async () => {
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { templateType: TemplateType.REPORT });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('templateType'),
        expect.objectContaining({ templateType: TemplateType.REPORT }),
      );
    });

    it('applies search filter when provided', async () => {
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { search: 'quarterly' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%quarterly%' }),
      );
    });

    it('includes GLOBAL scope templates alongside tenant templates', async () => {
      const qb = templateRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, {});

      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('globalScope'),
        expect.objectContaining({ globalScope: TemplateScope.GLOBAL }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the template when it belongs to the tenant', async () => {
      const template = makeTemplate({ tenantId: TENANT_ID, scope: TemplateScope.TENANT });
      templateRepo.findOne.mockResolvedValue(template);

      const result = await service.findById(TEMPLATE_ID, TENANT_ID);

      expect(result).toBe(template);
    });

    it('returns a GLOBAL scope template regardless of tenantId', async () => {
      const globalTemplate = makeTemplate({
        tenantId: 'another-tenant',
        scope: TemplateScope.GLOBAL,
      });
      templateRepo.findOne.mockResolvedValue(globalTemplate);

      const result = await service.findById(TEMPLATE_ID, TENANT_ID);

      expect(result).toBe(globalTemplate);
    });

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when template belongs to different tenant and is not GLOBAL', async () => {
      const otherTenantTemplate = makeTemplate({
        tenantId: 'other-tenant-uuid',
        scope: TemplateScope.TENANT,
      });
      templateRepo.findOne.mockResolvedValue(otherTenantTemplate);

      await expect(service.findById(TEMPLATE_ID, TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the template', async () => {
      const template = makeTemplate();
      templateRepo.findOne.mockResolvedValue(template);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(templateRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', TENANT_ID, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('can set isActive to false', async () => {
      const template = makeTemplate({ isActive: true });
      templateRepo.findOne.mockResolvedValue(template);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(TEMPLATE_ID, TENANT_ID, { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('can set isDefault to true', async () => {
      const template = makeTemplate({ isDefault: false });
      templateRepo.findOne.mockResolvedValue(template);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(TEMPLATE_ID, TENANT_ID, { isDefault: true });

      expect(result.isDefault).toBe(true);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt and returns { success: true }', async () => {
      const template = makeTemplate();
      templateRepo.findOne.mockResolvedValue(template);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(TEMPLATE_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(templateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── duplicate ─────────────────────────────────────────────────────────────

  describe('duplicate()', () => {
    it('creates a copy with name suffixed by " 副本"', async () => {
      const source = makeTemplate({ name: 'Original' });
      templateRepo.findOne.mockResolvedValue(source);
      const copy = makeTemplate({ name: 'Original 副本', id: 'copy-uuid' });
      templateRepo.create.mockReturnValue(copy);
      templateRepo.save.mockResolvedValue(copy);

      const result = await service.duplicate(TEMPLATE_ID, TENANT_ID);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Original 副本' }),
      );
      expect(result).toBe(copy);
    });

    it('sets isDefault=false on the copy regardless of source', async () => {
      const source = makeTemplate({ isDefault: true });
      templateRepo.findOne.mockResolvedValue(source);
      const copy = makeTemplate({ isDefault: false, id: 'copy-uuid' });
      templateRepo.create.mockReturnValue(copy);
      templateRepo.save.mockResolvedValue(copy);

      await service.duplicate(TEMPLATE_ID, TENANT_ID);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });

    it('suffixes code with "_copy" when source has a code', async () => {
      const source = makeTemplate({ code: 'INT_001' });
      templateRepo.findOne.mockResolvedValue(source);
      const copy = makeTemplate({ code: 'INT_001_copy', id: 'copy-uuid' });
      templateRepo.create.mockReturnValue(copy);
      templateRepo.save.mockResolvedValue(copy);

      await service.duplicate(TEMPLATE_ID, TENANT_ID);

      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INT_001_copy' }),
      );
    });

    it('throws NotFoundException when source template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.duplicate('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── setDefault ────────────────────────────────────────────────────────────

  describe('setDefault()', () => {
    it('sets isDefault=true on the target template', async () => {
      const template = makeTemplate({ isDefault: false });
      templateRepo.findOne.mockResolvedValue(template);
      // setDefault calls createQueryBuilder to clear others then saves the target
      const qb = templateRepo.createQueryBuilder();
      templateRepo.createQueryBuilder.mockReturnValue(qb);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.setDefault(TEMPLATE_ID, TENANT_ID);

      expect(result.isDefault).toBe(true);
    });

    it('clears isDefault on other templates via query builder', async () => {
      const template = makeTemplate();
      templateRepo.findOne.mockResolvedValue(template);
      const qb = templateRepo.createQueryBuilder();
      templateRepo.createQueryBuilder.mockReturnValue(qb);
      templateRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.setDefault(TEMPLATE_ID, TENANT_ID);

      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith({ isDefault: false });
      expect(qb.execute).toHaveBeenCalled();
    });

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.setDefault('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
