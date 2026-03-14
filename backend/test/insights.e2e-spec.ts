/**
 * backend/test/insights.e2e-spec.ts
 *
 * E2E tests for the insights API endpoints.
 * InsightsService is mocked to avoid real DB connections.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { InsightsController } from '../src/modules/insights/insights.controller';
import { InsightsService } from '../src/modules/insights/insights.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

const mockJwtAuthGuard = { canActivate: () => true };

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SESSION_ID = 'session-uuid-001';
const INSIGHT_ID = 'insight-uuid-001';

const mockInsightsService = {
  findBySession: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

describe('Insights API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [{ provide: InsightsService, useValue: mockInsightsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

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

  describe('POST /sessions/:id/insights', () => {
    it('creates and returns a new insight with content persisted', async () => {
      const dto = {
        layer: 2,
        content: {
          title: '支付手续费过高',
          text: '用户认为手续费是主要障碍',
          department: '财务部',
        },
      };

      const created = {
        id: 'insight-001',
        sessionId: SESSION_ID,
        tenantId: TENANT_ID,
        layer: 2,
        content: dto.content,
        editedBy: USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockInsightsService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/insights`)
        .send(dto)
        .expect(201);

      expect(res.body).toMatchObject({ id: 'insight-001', layer: 2 });
      expect(res.body.content).toMatchObject(dto.content);
      expect(mockInsightsService.create).toHaveBeenCalledWith(
        SESSION_ID,
        TENANT_ID,
        USER_ID,
        expect.objectContaining({ layer: 2 }),
      );
    });
  });

  describe('GET /sessions/:id/insights', () => {
    it('returns a list of insights for the session', async () => {
      const insights = [
        {
          id: 'insight-001',
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
          layer: 1,
          content: { title: 'L1洞察', text: '原始摘录' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'insight-002',
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
          layer: 2,
          content: { title: 'L2洞察', text: '结构化痛点' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockInsightsService.findBySession.mockResolvedValue(insights);

      const res = await request(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}/insights`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ id: 'insight-001', layer: 1 });
      expect(res.body[1].content).toMatchObject({ title: 'L2洞察' });
      expect(mockInsightsService.findBySession).toHaveBeenCalledWith(SESSION_ID, TENANT_ID);
    });
  });

  describe('POST + GET roundtrip', () => {
    it('content field is persisted and returned in subsequent GET', async () => {
      const contentPayload = {
        title: '执行摘要',
        text: '用户对当前跨境支付产品整体不满',
        department: '决策层',
      };

      const created = {
        id: 'roundtrip-001',
        sessionId: SESSION_ID,
        tenantId: TENANT_ID,
        layer: 3,
        content: contentPayload,
        editedBy: USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockInsightsService.create.mockResolvedValue(created);
      mockInsightsService.findBySession.mockResolvedValue([created]);

      // POST
      await request(app.getHttpServer())
        .post(`/sessions/${SESSION_ID}/insights`)
        .send({ layer: 3, content: contentPayload })
        .expect(201);

      // GET
      const res = await request(app.getHttpServer())
        .get(`/sessions/${SESSION_ID}/insights`)
        .expect(200);

      expect(res.body[0].content).toMatchObject(contentPayload);
    });
  });

  describe('PATCH /insights/:id', () => {
    it('updates content of an existing insight and returns the updated record', async () => {
      const updatedContent = { title: '更新后标题', text: '更新后内容' };
      const updated = {
        id: INSIGHT_ID,
        sessionId: SESSION_ID,
        tenantId: TENANT_ID,
        layer: 2,
        content: updatedContent,
        editedBy: USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockInsightsService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/insights/${INSIGHT_ID}`)
        .send({ content: updatedContent })
        .expect(200);

      expect(res.body).toMatchObject({ id: INSIGHT_ID, content: updatedContent });
      expect(mockInsightsService.update).toHaveBeenCalledWith(
        INSIGHT_ID,
        TENANT_ID,
        USER_ID,
        expect.objectContaining({ content: updatedContent }),
      );
    });

    it('returns 404 when updating a non-existent insight', async () => {
      mockInsightsService.update.mockRejectedValue(
        new NotFoundException(`洞察 non-existent 不存在`),
      );

      await request(app.getHttpServer())
        .patch('/insights/non-existent')
        .send({ content: { title: '任意' } })
        .expect(404);
    });
  });

  describe('GET /sessions/:id/insights — error cases', () => {
    it('returns 404 when service throws NotFoundException for unknown session', async () => {
      mockInsightsService.findBySession.mockRejectedValue(
        new NotFoundException('会话 unknown-session 不存在'),
      );

      await request(app.getHttpServer()).get('/sessions/unknown-session/insights').expect(404);
    });
  });
});
