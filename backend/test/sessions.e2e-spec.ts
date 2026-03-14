/**
 * backend/test/sessions.e2e-spec.ts
 *
 * E2E tests for the sessions API endpoints.
 * SessionsService is mocked to avoid real DB connections.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SessionsController } from '../src/modules/sessions/sessions.controller';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

// Minimal stub that satisfies the guard interface
const mockJwtAuthGuard = { canActivate: () => true };

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';

const mockSessionsService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  softDelete: jest.fn(),
};

describe('Sessions API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: mockSessionsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Attach a fake user to every request (simulates JwtAuthGuard population)
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: USER_ID, tenantId: TENANT_ID, role: 'consultant' };
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /sessions', () => {
    it('returns paginated sessions list', async () => {
      const mockPage = {
        data: [
          {
            id: 'session-001',
            title: '跨境支付访谈',
            status: 'DRAFT',
            tenantId: TENANT_ID,
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      mockSessionsService.findAll.mockResolvedValue(mockPage);

      const res = await request(app.getHttpServer()).get('/sessions').expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(mockSessionsService.findAll).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ page: undefined, limit: undefined }),
      );
    });

    it('passes page and limit query params to service', async () => {
      mockSessionsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await request(app.getHttpServer()).get('/sessions?page=2&limit=10').expect(200);

      expect(mockSessionsService.findAll).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  describe('POST /sessions', () => {
    it('creates a session and returns the created object', async () => {
      const dto = {
        title: '新访谈会话',
        interviewDate: '2026-03-15T10:00:00.000Z',
      };

      const created = {
        id: 'new-session-id',
        title: dto.title,
        status: 'DRAFT',
        tenantId: TENANT_ID,
        createdAt: new Date().toISOString(),
      };

      mockSessionsService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer()).post('/sessions').send(dto).expect(201);

      expect(res.body).toMatchObject({ id: 'new-session-id', title: '新访谈会话' });
      expect(mockSessionsService.create).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({ title: dto.title }),
      );
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/sessions')
        .send({ interviewDate: '2026-03-15T10:00:00.000Z' })
        .expect(400);

      expect(mockSessionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /sessions/:id', () => {
    it('returns the session matching the given id', async () => {
      const session = {
        id: 'session-001',
        title: '跨境支付访谈',
        status: 'DRAFT',
        tenantId: TENANT_ID,
        createdAt: new Date().toISOString(),
      };

      mockSessionsService.findById.mockResolvedValue(session);

      const res = await request(app.getHttpServer()).get('/sessions/session-001').expect(200);

      expect(res.body).toMatchObject({ id: 'session-001', title: '跨境支付访谈' });
      expect(mockSessionsService.findById).toHaveBeenCalledWith('session-001', TENANT_ID);
    });

    it('returns 404 when session does not exist', async () => {
      mockSessionsService.findById.mockRejectedValue(
        new NotFoundException('会话 non-existent 不存在'),
      );

      await request(app.getHttpServer()).get('/sessions/non-existent').expect(404);
    });
  });

  describe('PATCH /sessions/:id', () => {
    it('updates session fields and returns the updated session', async () => {
      const updated = {
        id: 'session-001',
        title: '更新后标题',
        status: 'DRAFT',
        tenantId: TENANT_ID,
        createdAt: new Date().toISOString(),
      };

      mockSessionsService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/sessions/session-001')
        .send({ title: '更新后标题' })
        .expect(200);

      expect(res.body).toMatchObject({ id: 'session-001', title: '更新后标题' });
      expect(mockSessionsService.update).toHaveBeenCalledWith(
        'session-001',
        TENANT_ID,
        expect.objectContaining({ title: '更新后标题' }),
      );
    });
  });

  describe('PATCH /sessions/:id/status', () => {
    it('transitions session to IN_PROGRESS status', async () => {
      const updated = {
        id: 'session-001',
        title: '跨境支付访谈',
        status: 'IN_PROGRESS',
        tenantId: TENANT_ID,
      };

      mockSessionsService.updateStatus.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/sessions/session-001/status')
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body).toMatchObject({ status: 'IN_PROGRESS' });
      expect(mockSessionsService.updateStatus).toHaveBeenCalledWith(
        'session-001',
        TENANT_ID,
        'IN_PROGRESS',
      );
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('soft-deletes a session and returns a success response', async () => {
      mockSessionsService.softDelete.mockResolvedValue({ success: true });

      await request(app.getHttpServer()).delete('/sessions/session-001').expect(200);

      expect(mockSessionsService.softDelete).toHaveBeenCalledWith('session-001', TENANT_ID);
    });
  });
});
