import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UserEntity, UserRole } from '../../entities/user.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const user = new UserEntity();
  user.id = USER_ID;
  user.email = 'admin@example.com';
  user.displayName = 'Admin User';
  user.password = '$2b$10$hashedpassword'; // placeholder, overridden in tests
  user.role = UserRole.ADMIN;
  user.tenantId = TENANT_ID;
  user.isActive = true;
  user.refreshToken = null;
  user.deletedAt = null;
  return Object.assign(user, overrides);
}

// ─── Mock QueryBuilder ───────────────────────────────────────────────────────

function makeQueryBuilder(returnValue: UserEntity | null) {
  const qb: any = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(returnValue),
  };
  return qb;
}

// ─── Mock Repository ─────────────────────────────────────────────────────────

const mockUserRepository = {
  createQueryBuilder: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
};

// ─── Mock JWT / Config ───────────────────────────────────────────────────────

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string> = {
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };
    return values[key] ?? `value-for-${key}`;
  }),
  get: jest.fn((key: string, defaultValue?: string) => {
    const values: Record<string, string> = {
      JWT_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY: '7d',
    };
    return values[key] ?? defaultValue;
  }),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login ────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('returns tokens and user profile on valid credentials', async () => {
      const plainPassword = 'correct-password';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user = makeUser({ password: hashedPassword });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));
      mockUserRepository.update.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access.token')
        .mockResolvedValueOnce('refresh.token');

      const result = await service.login({ email: user.email, password: plainPassword });

      expect(result.accessToken).toBe('access.token');
      expect(result.refreshToken).toBe('refresh.token');
      expect(result.user.id).toBe(USER_ID);
      expect(result.user.email).toBe(user.email);
      expect(result.user.role).toBe(UserRole.ADMIN);
      expect(result.user.tenantId).toBe(TENANT_ID);
    });

    it('uses email as displayName when displayName is null', async () => {
      const plainPassword = 'correct-password';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user = makeUser({ password: hashedPassword, displayName: null });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));
      mockUserRepository.update.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access.token')
        .mockResolvedValueOnce('refresh.token');

      const result = await service.login({ email: user.email, password: plainPassword });

      expect(result.user.displayName).toBe(user.email);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(null));

      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when account is disabled', async () => {
      const plainPassword = 'correct-password';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user = makeUser({ password: hashedPassword, isActive: false });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(service.login({ email: user.email, password: plainPassword })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws UnauthorizedException when password is null in DB', async () => {
      const user = makeUser({ password: null });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(service.login({ email: user.email, password: 'any' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      const user = makeUser({ password: hashedPassword });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('persists a hashed refresh token after successful login', async () => {
      const plainPassword = 'correct-password';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user = makeUser({ password: hashedPassword });

      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));
      mockUserRepository.update.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access.token')
        .mockResolvedValueOnce('raw-refresh-token');

      await service.login({ email: user.email, password: plainPassword });

      // update called with hashed token (not raw)
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: USER_ID },
        expect.objectContaining({ refreshToken: expect.any(String) }),
      );
      const savedHash = mockUserRepository.update.mock.calls[0][1].refreshToken as string;
      expect(savedHash).not.toBe('raw-refresh-token');
      expect(await bcrypt.compare('raw-refresh-token', savedHash)).toBe(true);
    });
  });

  // ── refreshToken ─────────────────────────────────────────────────────────

  describe('refreshToken()', () => {
    it('returns new token pair when refresh token is valid', async () => {
      const rawRefreshToken = 'valid.refresh.token';
      const storedHash = await bcrypt.hash(rawRefreshToken, 10);
      const user = makeUser({ refreshToken: storedHash });

      mockJwtService.verify.mockReturnValue({ sub: USER_ID, email: user.email });
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));
      mockUserRepository.update.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new.access.token')
        .mockResolvedValueOnce('new.refresh.token');

      const result = await service.refreshToken(rawRefreshToken);

      expect(result.accessToken).toBe('new.access.token');
      expect(result.refreshToken).toBe('new.refresh.token');
    });

    it('throws UnauthorizedException when JWT verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found in DB', async () => {
      mockJwtService.verify.mockReturnValue({ sub: USER_ID });
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(null));

      await expect(service.refreshToken('some.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when stored refreshToken is null', async () => {
      const user = makeUser({ refreshToken: null });

      mockJwtService.verify.mockReturnValue({ sub: USER_ID });
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(service.refreshToken('some.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token does not match stored hash', async () => {
      const storedHash = await bcrypt.hash('correct.token', 10);
      const user = makeUser({ refreshToken: storedHash });

      mockJwtService.verify.mockReturnValue({ sub: USER_ID });
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(service.refreshToken('wrong.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when account is disabled during refresh', async () => {
      const rawRefreshToken = 'valid.refresh.token';
      const storedHash = await bcrypt.hash(rawRefreshToken, 10);
      const user = makeUser({ refreshToken: storedHash, isActive: false });

      mockJwtService.verify.mockReturnValue({ sub: USER_ID });
      mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder(user));

      await expect(service.refreshToken(rawRefreshToken)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('sets refreshToken to null for the given user', async () => {
      mockUserRepository.update.mockResolvedValue(undefined);

      await service.logout(USER_ID);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: USER_ID },
        { refreshToken: null },
      );
    });

    it('resolves without error', async () => {
      mockUserRepository.update.mockResolvedValue(undefined);
      await expect(service.logout(USER_ID)).resolves.toBeUndefined();
    });
  });
});
