/**
 * ai-proxy.service.spec.ts
 *
 * Unit tests for AiProxyService.
 * HttpService and ConfigService are mocked.
 *
 * Note: chatStream() is intentionally excluded — it requires a live
 * NodeJS ReadableStream piped through an Express Response object;
 * that interaction is better covered by integration/e2e tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';

import { AiProxyService } from './ai-proxy.service';
import { ChatDto } from './dto/chat.dto';
import { InsightProxyDto } from './dto/insight.dto';
import { GenerateOutlineDto, OptimizeOutlineDto } from './dto/outline.dto';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';
import { CopilotComponentTemplateEntity } from '../../entities/copilot-component-template.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AI_BASE = 'http://localhost:8000';

/** Wrap a value in an axios-like AxiosResponse observable */
function axiosOf(data: unknown) {
  return of({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any });
}

/** Simulate a 5xx AxiosError observable */
function axios5xx(status = 500) {
  const err: any = new Error('Internal Server Error');
  err.response = { status };
  return throwError(() => err);
}

/** Simulate a 4xx AxiosError observable */
function axios4xx(status = 400) {
  const err: any = new Error('Bad Request');
  err.response = { status };
  return throwError(() => err);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const chatDto: ChatDto = {
  messages: [{ role: 'user', content: '你好' }],
};

const insightDto: InsightProxyDto = {
  transcript: '面试转录文本内容',
  interview_id: 'interview-001',
};

const outlineDto: GenerateOutlineDto = {
  sessionId: 'session-001',
  clientBackground: '金融科技公司',
  researchGoals: ['了解支付痛点'],
};

const optimizeDto: OptimizeOutlineDto = {
  sessionId: 'session-001',
  existingOutline: [{ id: 's1', title: '开场', questions: ['请介绍自己'] }],
  feedback: '需要更深入的问题',
};

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('AiProxyService', () => {
  let service: AiProxyService;
  let httpService: { post: jest.Mock };
  let sessionRepo: { findOne: jest.Mock };
  let componentTemplateRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };
    sessionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'session-001', title: '减速器调研' }),
    };
    componentTemplateRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProxyService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(AI_BASE) },
        },
        {
          provide: getRepositoryToken(InterviewSessionEntity),
          useValue: sessionRepo,
        },
        {
          provide: getRepositoryToken(CopilotComponentTemplateEntity),
          useValue: componentTemplateRepo,
        },
      ],
    }).compile();

    service = module.get<AiProxyService>(AiProxyService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── chat() ──────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('returns response data on success', async () => {
      const mockData = { content: 'Hello from AI' };
      httpService.post.mockReturnValue(axiosOf(mockData));

      const result = await service.chat(chatDto);

      expect(result).toEqual(mockData);
    });

    it('calls the correct URL', async () => {
      httpService.post.mockReturnValue(axiosOf({}));

      await service.chat(chatDto);

      expect(httpService.post).toHaveBeenCalledWith(
        `${AI_BASE}/api/v1/llm/chat`,
        chatDto,
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
      );
    });

    it('retries on 5xx and succeeds on 3rd attempt', async () => {
      // First two calls fail with 5xx, third succeeds
      const successData = { content: 'Retry success' };
      httpService.post
        .mockReturnValueOnce(axios5xx(500))
        .mockReturnValueOnce(axios5xx(503))
        .mockReturnValueOnce(axiosOf(successData));

      // Patch withRetry delay to 0ms so test runs fast
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });

      const result = await service.chat(chatDto);

      jest.restoreAllMocks();
      expect(httpService.post).toHaveBeenCalledTimes(3);
      expect(result).toEqual(successData);
    });

    it('does NOT retry on 4xx — throws InternalServerErrorException immediately after 1 call', async () => {
      httpService.post.mockReturnValue(axios4xx(400));

      await expect(service.chat(chatDto)).rejects.toThrow(InternalServerErrorException);
      // 4xx → withRetry throws immediately; outer .catch wraps in InternalServerErrorException
      expect(httpService.post).toHaveBeenCalledTimes(1);
    });

    it('throws InternalServerErrorException after exhausting all retries', async () => {
      httpService.post.mockReturnValue(axios5xx(500));
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });

      await expect(service.chat(chatDto)).rejects.toThrow(InternalServerErrorException);

      jest.restoreAllMocks();
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });
  });

  // ── extractInsight() ────────────────────────────────────────────────────────

  describe('extractInsight()', () => {
    it('returns response data and calls correct URL', async () => {
      const mockData = { themes: ['支付延迟'] };
      httpService.post.mockReturnValue(axiosOf(mockData));

      const result = await service.extractInsight(insightDto);

      expect(result).toEqual(mockData);
      expect(httpService.post).toHaveBeenCalledWith(
        `${AI_BASE}/api/v1/insight/extract`,
        insightDto,
        expect.anything(),
      );
    });

    it('throws InternalServerErrorException on failure', async () => {
      httpService.post.mockReturnValue(axios5xx());
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });

      await expect(service.extractInsight(insightDto)).rejects.toThrow(
        InternalServerErrorException,
      );

      jest.restoreAllMocks();
    });
  });

  // ── generateOutline() ──────────────────────────────────────────────────────

  describe('generateOutline()', () => {
    it('returns response data and calls correct URL', async () => {
      const mockData = { sections: [{ title: '开场' }] };
      httpService.post.mockReturnValue(axiosOf(mockData));

      const result = await service.generateOutline(outlineDto);

      expect(result).toEqual(mockData);
      expect(httpService.post).toHaveBeenCalledWith(
        `${AI_BASE}/api/v1/outline/generate`,
        expect.objectContaining({ topic: '减速器调研' }),
        expect.anything(),
      );
    });
  });

  // ── optimizeOutline() ──────────────────────────────────────────────────────

  describe('optimizeOutline()', () => {
    it('returns response data and calls correct URL', async () => {
      const mockData = { sections: [{ title: '优化后开场' }] };
      httpService.post.mockReturnValue(axiosOf(mockData));

      const result = await service.optimizeOutline(optimizeDto);

      expect(result).toEqual(mockData);
      expect(httpService.post).toHaveBeenCalledWith(
        `${AI_BASE}/api/v1/outline/optimize`,
        optimizeDto,
        expect.anything(),
      );
    });
  });
});
