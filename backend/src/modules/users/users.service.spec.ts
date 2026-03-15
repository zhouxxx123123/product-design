import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { UserEntity, UserRole } from '../../entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = USER_ID;
  u.email = 'user@example.com';
  u.displayName = 'Test User';
  u.password = '$2b$10$placeholder_hash';
  u.role = UserRole.SALES;
  u.tenantId = TENANT_ID;
  u.isActive = true;
  u.avatarUrl = null;
  u.refreshToken = null;
  u.createdAt = new Date('2026-03-01T00:00:00Z');
  u.updatedAt = new Date('2026-03-01T00:00:00Z');
  u.deletedAt = null;
  return Object.assign(u, overrides);
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

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof makeMockRepo>;
  let auditLogsService: jest.Mocked<AuditLogsService>;

  beforeEach(async () => {
    userRepo = makeMockRepo();
    auditLogsService = {
      create: jest.fn().mockResolvedValue({}),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('hashes the password before saving', async () => {
      const dto = { email: 'new@example.com', displayName: 'New User', password: 'plain-password' };
      const user = makeUser({ email: dto.email });
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.create(TENANT_ID, dto);

      const createArg = userRepo.create.mock.calls[0][0];
      expect(createArg.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, createArg.password as string)).toBe(true);
    });

    it('sets tenantId from parameter, not from DTO', async () => {
      const dto = { email: 'new@example.com', displayName: 'New User', password: 'secret123' };
      const user = makeUser();
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.create(TENANT_ID, dto);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID }),
      );
    });

    it('defaults role to SALES when not provided', async () => {
      const dto = { email: 'new@example.com', displayName: 'New User', password: 'secret123' };
      const user = makeUser();
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.create(TENANT_ID, dto);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.SALES }),
      );
    });

    it('uses provided role when given', async () => {
      const dto = { email: 'admin@example.com', displayName: 'Admin User', password: 'secret123', role: UserRole.ADMIN };
      const user = makeUser({ role: UserRole.ADMIN });
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      await service.create(TENANT_ID, dto);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
    });

    it('returns the saved user entity', async () => {
      const dto = { email: 'new@example.com', displayName: 'New User', password: 'secret123' };
      const user = makeUser();
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.create(TENANT_ID, dto);

      expect(result).toEqual(expect.objectContaining({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        tenantId: user.tenantId,
      }));
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated response shape { data, total, page, limit, totalPages }', async () => {
      const users = [makeUser()];
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([users, 1]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: [expect.objectContaining({
          id: users[0].id,
          email: users[0].email,
          displayName: users[0].displayName,
          role: users[0].role,
          tenantId: users[0].tenantId,
          isActive: users[0].isActive,
          createdAt: users[0].createdAt,
        })],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('uses defaults page=1 and limit=20 when not provided', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { limit: 500 });

      expect(result.limit).toBe(100);
    });

    it('applies search filter when search is provided', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { search: 'alice' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%alice%' }),
      );
    });

    it('correctly calculates totalPages', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 45]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.totalPages).toBe(3);
    });

    it('returns totalPages=0 when total is 0', async () => {
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.totalPages).toBe(0);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findById(USER_ID);

      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } }),
      );
      expect(result).toEqual(expect.objectContaining({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }));
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('returns the user when found by email', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('user@example.com');

      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'user@example.com' } }),
      );
      expect(result).toBe(user);
    });

    it('returns null when no user matches the email', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('ghost@example.com');

      expect(result).toBeNull();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the user', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(USER_ID, TENANT_ID, { displayName: 'New Name' }, UserRole.ADMIN);

      expect(result.displayName).toBe('New Name');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', TENANT_ID, { displayName: 'X' }, UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes the password when password field is updated', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update(USER_ID, TENANT_ID, { password: 'new-plain-password' }, UserRole.ADMIN);

      const savedUser = userRepo.save.mock.calls[0][0] as UserEntity;
      expect(savedUser.password).not.toBe('new-plain-password');
      expect(await bcrypt.compare('new-plain-password', savedUser.password as string)).toBe(true);
    });

    it('does not re-hash password when password field is not provided', async () => {
      const originalHash = '$2b$10$placeholder_hash';
      const user = makeUser({ password: originalHash });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update(USER_ID, TENANT_ID, { displayName: 'Name Only' }, UserRole.SALES);

      const savedUser = userRepo.save.mock.calls[0][0] as UserEntity;
      expect(savedUser.password).toBe(originalHash);
    });

    it('can update role to EXPERT', async () => {
      const user = makeUser({ role: UserRole.SALES });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(USER_ID, TENANT_ID, { role: UserRole.EXPERT }, UserRole.ADMIN);

      expect(result.role).toBe(UserRole.EXPERT);
    });

    it('can set isActive to false', async () => {
      const user = makeUser({ isActive: true });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(USER_ID, TENANT_ID, { isActive: false }, UserRole.ADMIN);

      expect(result.isActive).toBe(false);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt on the user and returns { success: true }', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(USER_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for user belonging to a different tenant', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete(USER_ID, 'other-tenant')).rejects.toThrow(NotFoundException);
    });
  });

  // ── changeRole ────────────────────────────────────────────────────────────

  describe('changeRole()', () => {
    it('changes user role and creates audit log', async () => {
      const user = makeUser({ role: UserRole.SALES });
      const updatedUser = makeUser({ role: UserRole.EXPERT });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(updatedUser);

      const result = await service.changeRole(USER_ID, TENANT_ID, UserRole.EXPERT, 'admin-uuid');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.EXPERT }),
      );
      expect(auditLogsService.create).toHaveBeenCalledWith({
        action: expect.any(String), // AuditAction.UPDATE
        entityType: 'user',
        entityId: USER_ID,
        tenantId: TENANT_ID,
        userId: 'admin-uuid',
        newValues: { roleChange: { from: UserRole.SALES, to: UserRole.EXPERT } },
        notes: 'USER_ROLE_CHANGED',
      });
      expect(result).toEqual(expect.objectContaining({ role: UserRole.EXPERT }));
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changeRole('nonexistent-id', TENANT_ID, UserRole.EXPERT, 'admin-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
