import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ClientsService } from './clients.service';
import { ClientProfileEntity } from '../../entities/client-profile.entity';
import { ClientContactEntity } from '../../entities/client-contact.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const CLIENT_ID = 'client-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<ClientProfileEntity> = {}): ClientProfileEntity {
  const c = new ClientProfileEntity();
  c.id = CLIENT_ID;
  c.tenantId = TENANT_ID;
  c.name = 'Zhang Wei';
  c.email = 'zhangwei@company.com';
  c.phone = '13800138000';
  c.position = 'CTO';
  c.company = 'Example Corp';
  c.industry = 'Technology';
  c.tags = ['vip', 'enterprise'];
  c.notes = 'Key decision maker';
  c.lastInterviewAt = null;
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
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ClientsService', () => {
  let service: ClientsService;
  let clientRepo: ReturnType<typeof makeMockRepo>;
  let contactRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    clientRepo = makeMockRepo();
    contactRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(ClientProfileEntity), useValue: clientRepo },
        { provide: getRepositoryToken(ClientContactEntity), useValue: contactRepo },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a client and sets tenantId from parameter', async () => {
      const dto = { companyName: 'Acme Ltd' };
      const client = makeClient({ company: dto.companyName });
      clientRepo.create.mockReturnValue(client);
      clientRepo.save.mockResolvedValue(client);

      const result = await service.create(TENANT_ID, dto);

      expect(clientRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, company: dto.companyName }),
      );
      expect(result).toBeDefined();
    });

    it('returns the saved entity', async () => {
      const dto = { companyName: 'Li Ming Corp' };
      const client = makeClient();
      clientRepo.create.mockReturnValue(client);
      clientRepo.save.mockResolvedValue(client);

      const result = await service.create(TENANT_ID, dto);

      expect(result).toBeDefined();
    });

    it('passes all optional fields to the repository', async () => {
      const dto = {
        companyName: 'Corp Inc',
        industry: 'Finance',
        tags: ['key-account'],
        notes: 'Negotiated deal in Q1',
        contacts: [
          {
            name: 'Wang Fang',
            email: 'wangfang@corp.com',
            phone: '13912345678',
            title: 'VP',
          },
        ],
      };
      const client = makeClient();
      clientRepo.create.mockReturnValue(client);
      clientRepo.save.mockResolvedValue(client);
      // Mock the reload of client with contacts
      clientRepo.findOne.mockResolvedValue(client);

      await service.create(TENANT_ID, dto);

      expect(clientRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          industry: dto.industry,
          company: dto.companyName,
          name: dto.companyName, // company name is used as name
          email: null, // contact fields are null on client entity
          phone: null,
          position: null,
          tags: dto.tags,
          notes: dto.notes,
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated response shape { data, total, page, limit, totalPages }', async () => {
      const clients = [makeClient()];
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([clients, 1]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
    });

    it('uses defaults page=1 and limit=20 when not provided', async () => {
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100', async () => {
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { limit: 500 });

      expect(result.limit).toBe(100);
    });

    it('applies search filter on company and name when provided', async () => {
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { search: 'Acme' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%Acme%' }),
      );
    });

    it('correctly calculates totalPages', async () => {
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 33]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result.totalPages).toBe(4);
    });

    it('returns totalPages=0 when total is 0', async () => {
      const qb = clientRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      clientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.totalPages).toBe(0);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the client DTO when found', async () => {
      const client = makeClient();
      clientRepo.findOne.mockResolvedValue(client);

      const result = await service.findById(CLIENT_ID, TENANT_ID);

      expect(clientRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CLIENT_ID, tenantId: TENANT_ID }),
        }),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe(CLIENT_ID);
    });

    it('throws NotFoundException when client is not found', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for client belonging to a different tenant', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(CLIENT_ID, 'other-tenant')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the client', async () => {
      const client = makeClient();
      clientRepo.findOne.mockResolvedValue(client);
      clientRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CLIENT_ID, TENANT_ID, { companyName: 'Updated Corp' });

      expect(result.companyName).toBe('Updated Corp');
      expect(clientRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when client does not exist', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', TENANT_ID, { companyName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('can update multiple fields at once', async () => {
      const client = makeClient();
      clientRepo.findOne.mockResolvedValue(client);
      clientRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(CLIENT_ID, TENANT_ID, {
        companyName: 'New Corp',
        industry: 'Healthcare',
        notes: 'Updated notes',
      });

      expect(result.companyName).toBe('New Corp');
      expect(result.industry).toBe('Healthcare');
      expect(result.notes).toBe('Updated notes');
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt and returns { success: true }', async () => {
      const client = makeClient();
      clientRepo.findOne.mockResolvedValue(client);
      clientRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(CLIENT_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(clientRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when client does not exist', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
