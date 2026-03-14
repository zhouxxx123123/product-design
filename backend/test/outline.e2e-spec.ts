/**
 * backend/test/outline.e2e-spec.ts
 *
 * E2E tests for the outline proxy endpoints:
 *   POST /ai/outline/generate
 *   POST /ai/outline/optimize
 *
 * HttpService is mocked so no real AI service is required.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AiProxyController } from '../src/modules/ai-proxy/ai-proxy.controller';
import { AiProxyService } from '../src/modules/ai-proxy/ai-proxy.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

// ── Mock guard ────────────────────────────────────────────────────────────────

const mockJwtAuthGuard = { canActivate: () => true };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OUTLINE_RESPONSE = {
  status: 'success',
  sections: [
    {
      id: 'sec-1',
      title: '背景了解',
      questions: ['请介绍一下贵公司的业务？', '您的主要客户群体是什么？'],
    },
    {
      id: 'sec-2',
      title: '痛点挖掘',
      questions: ['目前最大的业务挑战是什么？', '您是如何应对这些挑战的？'],
    },
  ],
};

function makeRxjsResponse(data: unknown) {
  return of({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('Outline Proxy API (e2e)', () => {
  let app: INestApplication;
  let mockHttpService: { post: jest.Mock };

  beforeAll(async () => {
    mockHttpService = { post: jest.fn() };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, def?: string) => {
        if (key === 'AI_SERVICE_URL') return 'http://ai-mock:8000';
        return def;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AiProxyController],
      providers: [
        AiProxyService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: 'user-001', tenantId: 'tenant-001', role: 'consultant' };
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

  // ── POST /ai/outline/generate ────────────────────────────────────────────────

  describe('POST /ai/outline/generate', () => {
    it('forwards sessionId to AI service and returns outline', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      const res = await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({ sessionId: 'session-001' })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://ai-mock:8000/api/v1/outline/generate',
        expect.objectContaining({ sessionId: 'session-001' }),
        expect.objectContaining({ timeout: 120_000 }),
      );

      expect(res.body.sections).toHaveLength(2);
      expect(res.body.sections[0].title).toBe('背景了解');
    });

    it('forwards optional clientBackground and researchGoals', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({
          sessionId: 'session-001',
          clientBackground: '科技公司，专注于B2B SaaS',
          researchGoals: ['了解采购决策流程', '挖掘痛点'],
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          clientBackground: '科技公司，专注于B2B SaaS',
          researchGoals: expect.arrayContaining(['了解采购决策流程']),
        }),
        expect.any(Object),
      );
    });

    it('returns 400 when sessionId is missing', async () => {
      await request(app.getHttpServer()).post('/ai/outline/generate').send({}).expect(400);

      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('returns 400 when sessionId exceeds MaxLength(100)', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({ sessionId: 'x'.repeat(101) })
        .expect(400);
    });

    it('returns 400 when clientBackground exceeds MaxLength(2000)', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({
          sessionId: 'session-001',
          clientBackground: 'a'.repeat(2001),
        })
        .expect(400);
    });

    it('strips unknown fields (whitelist: true)', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({ sessionId: 'session-001', hackerField: 'injected' })
        .expect(200);

      const sentBody = mockHttpService.post.mock.calls[0][1];
      expect(sentBody).not.toHaveProperty('hackerField');
    });

    it('returns 500 when AI service is unavailable', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 503 }, message: 'Service unavailable' })),
      );

      await request(app.getHttpServer())
        .post('/ai/outline/generate')
        .send({ sessionId: 'session-001' })
        .expect(500);
    });
  });

  // ── POST /ai/outline/optimize ────────────────────────────────────────────────

  describe('POST /ai/outline/optimize', () => {
    const VALID_OUTLINE = [
      {
        id: 'sec-1',
        title: '背景了解',
        questions: ['请介绍一下您的业务？'],
      },
    ];

    it('forwards existingOutline and returns optimized outline', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      const res = await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: VALID_OUTLINE,
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://ai-mock:8000/api/v1/outline/optimize',
        expect.objectContaining({
          sessionId: 'session-001',
          existingOutline: expect.arrayContaining([expect.objectContaining({ id: 'sec-1' })]),
        }),
        expect.objectContaining({ timeout: 120_000 }),
      );

      expect(res.body).toEqual(MOCK_OUTLINE_RESPONSE);
    });

    it('forwards optional feedback', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: VALID_OUTLINE,
          feedback: '请增加更多开放式问题',
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ feedback: '请增加更多开放式问题' }),
        expect.any(Object),
      );
    });

    it('returns 400 when sessionId is missing', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({ existingOutline: VALID_OUTLINE })
        .expect(400);
    });

    it('returns 400 when existingOutline is missing', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({ sessionId: 'session-001' })
        .expect(400);
    });

    it('returns 400 when existingOutline item is missing title', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: [{ id: 'sec-1', questions: ['q?'] }], // missing title
        })
        .expect(400);
    });

    it('returns 400 when feedback exceeds MaxLength(2000)', async () => {
      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: VALID_OUTLINE,
          feedback: 'f'.repeat(2001),
        })
        .expect(400);
    });

    it('strips unknown fields from outline sections (whitelist: true)', async () => {
      mockHttpService.post.mockReturnValue(makeRxjsResponse(MOCK_OUTLINE_RESPONSE));

      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: [
            {
              id: 'sec-1',
              title: '背景了解',
              questions: ['问题1'],
              injectedField: 'malicious',
            },
          ],
        })
        .expect(200);

      const sentSections = mockHttpService.post.mock.calls[0][1].existingOutline;
      expect(sentSections[0]).not.toHaveProperty('injectedField');
    });

    it('returns 500 when AI service is unavailable', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => ({ message: 'Service unavailable' })));

      await request(app.getHttpServer())
        .post('/ai/outline/optimize')
        .send({
          sessionId: 'session-001',
          existingOutline: VALID_OUTLINE,
        })
        .expect(500);
    });
  });
});
