/**
 * backend/test/ai-proxy.e2e-spec.ts
 *
 * E2E tests for the AI proxy endpoints.
 * HttpService is mocked so no real AI service is needed.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { of } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AiProxyController } from '../src/modules/ai-proxy/ai-proxy.controller';
import { AiProxyService } from '../src/modules/ai-proxy/ai-proxy.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

const mockJwtAuthGuard = { canActivate: () => true };

const AI_INSIGHT_RESPONSE = {
  status: 'success',
  themes: [
    {
      title: '手续费过高',
      description: '用户认为跨境支付手续费远超预期',
      evidence: ['手续费太高了'],
    },
  ],
  key_quotes: [
    {
      text: '手续费太高了',
      speaker: '受访者A',
      insight: '价格敏感',
    },
  ],
  sentiment: {
    label: 'negative',
    score: -0.7,
    breakdown: { 正面: 10, 中性: 20, 负面: 70 },
  },
  summary: '用户对跨境支付成本高度不满。',
};

describe('AI Proxy API (e2e)', () => {
  let app: INestApplication;
  let mockHttpService: { post: jest.Mock };

  beforeAll(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

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

  describe('POST /ai/insight/extract', () => {
    it('forwards transcript to AI service and returns structured response', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: AI_INSIGHT_RESPONSE,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/ai/insight/extract')
        .send({ transcript: '用户反映跨境支付手续费太高，流程繁琐' })
        .expect(200);

      // Verify forwarding: post was called with correct AI service URL
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://ai-mock:8000/api/v1/insight/extract',
        expect.objectContaining({ transcript: '用户反映跨境支付手续费太高，流程繁琐' }),
        expect.objectContaining({ timeout: 120_000 }),
      );

      // Verify response structure is passed through intact
      expect(res.body).toMatchObject({
        status: 'success',
        themes: expect.arrayContaining([expect.objectContaining({ title: '手续费过高' })]),
        key_quotes: expect.any(Array),
        sentiment: expect.objectContaining({ label: 'negative' }),
        summary: expect.any(String),
      });
    });

    it('returns 400 when transcript is missing', async () => {
      await request(app.getHttpServer()).post('/ai/insight/extract').send({}).expect(400);

      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('returns 400 when transcript is empty string', async () => {
      await request(app.getHttpServer())
        .post('/ai/insight/extract')
        .send({ transcript: '' })
        .expect(400);
    });

    it('optional fields are forwarded when provided', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: AI_INSIGHT_RESPONSE,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      await request(app.getHttpServer())
        .post('/ai/insight/extract')
        .send({
          transcript: '测试文本',
          interview_id: 'session-123',
          extract_themes: true,
          extract_quotes: false,
          extract_sentiment: true,
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transcript: '测试文本',
          interview_id: 'session-123',
          extract_themes: true,
          extract_quotes: false,
        }),
        expect.any(Object),
      );
    });
  });

  describe('POST /ai/llm/chat', () => {
    it('forwards messages to LLM and returns response', async () => {
      const llmResponse = {
        choices: [{ message: { content: '测试回复' } }],
      };

      mockHttpService.post.mockReturnValue(
        of({ data: llmResponse, status: 200, statusText: 'OK', headers: {}, config: {} as any }),
      );

      const res = await request(app.getHttpServer())
        .post('/ai/llm/chat')
        .send({ messages: [{ role: 'user', content: '你好' }] })
        .expect(200);

      expect(res.body.choices[0].message.content).toBe('测试回复');
    });
  });
});
