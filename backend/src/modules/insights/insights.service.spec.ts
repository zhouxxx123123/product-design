import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { InsightsService } from './insights.service';
import { SessionInsightEntity } from '../../entities/session-insight.entity';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SESSION_ID = 'session-uuid-001';
const INSIGHT_ID = 'insight-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<SessionInsightEntity> = {}): SessionInsightEntity {
  const i = new SessionInsightEntity();
  i.id = INSIGHT_ID;
  i.sessionId = SESSION_ID;
  i.tenantId = TENANT_ID;
  i.layer = 1;
  i.content = { themes: ['cost reduction', 'efficiency'], quotes: [] };
  i.editedBy = USER_ID;
  i.createdAt = new Date('2026-03-01T00:00:00Z');
  i.updatedAt = new Date('2026-03-01T00:00:00Z');
  return Object.assign(i, overrides);
}

function makeTranscriptSegment(
  overrides: Partial<TranscriptSegmentEntity> = {},
): TranscriptSegmentEntity {
  const s = new TranscriptSegmentEntity();
  s.id = 'segment-uuid-001';
  s.sessionId = SESSION_ID;
  s.tenantId = TENANT_ID;
  s.text = 'This is sample transcript text';
  s.startMs = 1000;
  s.endMs = 5000;
  s.speaker = 'Interviewer';
  s.createdAt = new Date('2026-03-01T00:00:00Z');
  return Object.assign(s, overrides);
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
  remove: jest.fn(),
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

describe('InsightsService', () => {
  let service: InsightsService;
  let insightRepo: ReturnType<typeof makeMockRepo>;
  let transcriptRepo: ReturnType<typeof makeMockRepo>;
  let mockAiProxyService: { extractInsight: jest.Mock };

  beforeEach(async () => {
    insightRepo = makeMockRepo();
    transcriptRepo = makeMockRepo();
    mockAiProxyService = { extractInsight: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: getRepositoryToken(SessionInsightEntity), useValue: insightRepo },
        { provide: getRepositoryToken(TranscriptSegmentEntity), useValue: transcriptRepo },
        { provide: AiProxyService, useValue: mockAiProxyService },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findBySession ─────────────────────────────────────────────────────────

  describe('findBySession()', () => {
    it('returns insights for the session ordered by layer ASC', async () => {
      const insights = [
        makeInsight({ layer: 1 }),
        makeInsight({ id: 'insight-uuid-002', layer: 2 }),
        makeInsight({ id: 'insight-uuid-003', layer: 3 }),
      ];
      insightRepo.find.mockResolvedValue(insights);

      const result = await service.findBySession(SESSION_ID, TENANT_ID);

      expect(insightRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
          order: { layer: 'ASC' },
        }),
      );
      expect(result).toBe(insights);
    });

    it('returns empty array when no insights exist for the session', async () => {
      insightRepo.find.mockResolvedValue([]);

      const result = await service.findBySession(SESSION_ID, TENANT_ID);

      expect(result).toEqual([]);
    });

    it('scopes query to the provided tenantId', async () => {
      insightRepo.find.mockResolvedValue([]);

      await service.findBySession(SESSION_ID, 'specific-tenant-id');

      expect(insightRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'specific-tenant-id' }),
        }),
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates an insight with sessionId, tenantId, and editedBy set', async () => {
      const dto = { layer: 1, content: { themes: ['scale'] } };
      const insight = makeInsight();
      insightRepo.create.mockReturnValue(insight);
      insightRepo.save.mockResolvedValue(insight);

      const result = await service.create(SESSION_ID, TENANT_ID, USER_ID, dto);

      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
          editedBy: USER_ID,
          layer: dto.layer,
          content: dto.content,
        }),
      );
      expect(result).toBe(insight);
    });

    it('returns the saved entity', async () => {
      const dto = { layer: 2, content: { summary: 'Key takeaway' } };
      const insight = makeInsight({ layer: 2 });
      insightRepo.create.mockReturnValue(insight);
      insightRepo.save.mockResolvedValue(insight);

      const result = await service.create(SESSION_ID, TENANT_ID, USER_ID, dto);

      expect(result).toBe(insight);
    });

    it('supports all three layer values (1, 2, 3)', async () => {
      for (const layer of [1, 2, 3]) {
        const dto = { layer, content: {} };
        const insight = makeInsight({ layer });
        insightRepo.create.mockReturnValue(insight);
        insightRepo.save.mockResolvedValue(insight);

        const result = await service.create(SESSION_ID, TENANT_ID, USER_ID, dto);

        expect(insightRepo.create).toHaveBeenCalledWith(expect.objectContaining({ layer }));
        expect(result.layer).toBe(layer);
      }
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates content and editedBy then returns the insight', async () => {
      const insight = makeInsight({ content: { themes: ['old'] }, editedBy: 'old-user' });
      insightRepo.findOne.mockResolvedValue(insight);
      insightRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const newContent = { themes: ['new theme'] };
      const result = await service.update(INSIGHT_ID, TENANT_ID, USER_ID, {
        content: newContent,
      });

      expect(result.content).toEqual(newContent);
      expect(result.editedBy).toBe(USER_ID);
      expect(insightRepo.save).toHaveBeenCalled();
    });

    it('updates editedBy even when content is not provided in dto', async () => {
      const insight = makeInsight({ editedBy: 'old-user-id' });
      insightRepo.findOne.mockResolvedValue(insight);
      insightRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(INSIGHT_ID, TENANT_ID, USER_ID, {});

      expect(result.editedBy).toBe(USER_ID);
    });

    it('does not overwrite content when content is undefined in dto', async () => {
      const originalContent = { themes: ['keep me'] };
      const insight = makeInsight({ content: originalContent });
      insightRepo.findOne.mockResolvedValue(insight);
      insightRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.update(INSIGHT_ID, TENANT_ID, USER_ID, {});

      expect(result.content).toEqual(originalContent);
    });

    it('throws NotFoundException when insight is not found', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', TENANT_ID, USER_ID, { content: {} }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for insight belonging to different tenant', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      await expect(service.update(INSIGHT_ID, 'other-tenant', USER_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('queries by both id and tenantId for tenant isolation', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      try {
        await service.update(INSIGHT_ID, TENANT_ID, USER_ID, {});
      } catch {
        // NotFoundException expected — we only care about the findOne call
      }

      expect(insightRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: INSIGHT_ID, tenantId: TENANT_ID }),
        }),
      );
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deletes an existing insight', async () => {
      const insight = makeInsight();
      insightRepo.findOne.mockResolvedValue(insight);
      insightRepo.remove.mockResolvedValue(insight);

      await service.delete(INSIGHT_ID, TENANT_ID);

      expect(insightRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: INSIGHT_ID, tenantId: TENANT_ID }),
        }),
      );
      expect(insightRepo.remove).toHaveBeenCalledWith(insight);
    });

    it('throws NotFoundException when insight is not found', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id', TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for insight belonging to different tenant', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(INSIGHT_ID, 'other-tenant')).rejects.toThrow(NotFoundException);
    });

    it('queries by both id and tenantId for tenant isolation', async () => {
      insightRepo.findOne.mockResolvedValue(null);

      try {
        await service.delete(INSIGHT_ID, TENANT_ID);
      } catch {
        // NotFoundException expected — we only care about the findOne call
      }

      expect(insightRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: INSIGHT_ID, tenantId: TENANT_ID }),
        }),
      );
    });
  });

  // ── extractFromSession ────────────────────────────────────────────────────

  describe('extractFromSession()', () => {
    it('extracts insights from transcript segments and saves them', async () => {
      const segments = [
        makeTranscriptSegment({ speaker: 'Interviewer', text: 'What are your pain points?' }),
        makeTranscriptSegment({ id: 'segment-002', speaker: 'User', text: 'Cost is too high' }),
      ];
      transcriptRepo.find.mockResolvedValue(segments);

      const aiResult = [
        { layer: 1, content: { themes: ['cost'], quotes: ['Cost is too high'] } },
        { layer: 2, content: { summary: 'User concerned about pricing' } },
      ];
      mockAiProxyService.extractInsight.mockResolvedValue(aiResult);

      const savedInsights = [makeInsight({ layer: 1 }), makeInsight({ layer: 2 })];
      insightRepo.create.mockImplementation((data) => ({ ...data, id: 'new-id' }));
      insightRepo.save.mockResolvedValue(savedInsights);

      const result = await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      expect(transcriptRepo.find).toHaveBeenCalledWith({
        where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
        order: { startMs: 'ASC' },
      });

      expect(mockAiProxyService.extractInsight).toHaveBeenCalledWith({
        transcript: '[Interviewer]: What are your pain points?\n[User]: Cost is too high',
        interviewId: SESSION_ID,
      });

      expect(insightRepo.delete).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        tenantId: TENANT_ID,
      });
      expect(insightRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedInsights);
    });

    it('throws BadRequestException when no transcript segments exist', async () => {
      transcriptRepo.find.mockResolvedValue([]);

      await expect(service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID)).rejects.toThrow(
        BadRequestException,
      );

      expect(transcriptRepo.find).toHaveBeenCalledWith({
        where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
        order: { startMs: 'ASC' },
      });
    });

    it('handles AI service returning non-array result', async () => {
      const segments = [makeTranscriptSegment()];
      transcriptRepo.find.mockResolvedValue(segments);
      mockAiProxyService.extractInsight.mockResolvedValue({ not: 'an array' });
      insightRepo.save.mockResolvedValue([]);

      const result = await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      expect(insightRepo.delete).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        tenantId: TENANT_ID,
      });
      expect(result).toEqual([]);
    });

    it('filters out non-object items from AI result', async () => {
      const segments = [makeTranscriptSegment()];
      transcriptRepo.find.mockResolvedValue(segments);

      const aiResult = [
        { layer: 1, content: { text: 'valid insight' } },
        'invalid string',
        null,
        undefined,
        42,
        { layer: 2, content: { text: 'another valid insight' } },
      ];
      mockAiProxyService.extractInsight.mockResolvedValue(aiResult);

      insightRepo.create.mockImplementation((data) => data);
      const savedInsights = [makeInsight(), makeInsight()];
      insightRepo.save.mockResolvedValue(savedInsights);

      await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      // Should create exactly 2 insights (only the valid objects)
      expect(insightRepo.create).toHaveBeenCalledTimes(2);
      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
          editedBy: USER_ID,
          layer: 1,
          content: { text: 'valid insight' },
        }),
      );
      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
          editedBy: USER_ID,
          layer: 2,
          content: { text: 'another valid insight' },
        }),
      );
    });

    it('uses default layer 1 when layer is not a number', async () => {
      const segments = [makeTranscriptSegment()];
      transcriptRepo.find.mockResolvedValue(segments);

      const aiResult = [{ layer: 'not-a-number', content: { text: 'insight' } }];
      mockAiProxyService.extractInsight.mockResolvedValue(aiResult);

      insightRepo.create.mockImplementation((data) => data);
      insightRepo.save.mockResolvedValue([makeInsight()]);

      await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      expect(insightRepo.create).toHaveBeenCalledWith(expect.objectContaining({ layer: 1 }));
    });

    it('normalizes non-object content to { text: string }', async () => {
      const segments = [makeTranscriptSegment()];
      transcriptRepo.find.mockResolvedValue(segments);

      const aiResult = [
        { layer: 1, content: 'string content' },
        { layer: 2, content: 42 },
        { layer: 3, content: null },
        { layer: 4, content: undefined },
      ];
      mockAiProxyService.extractInsight.mockResolvedValue(aiResult);

      insightRepo.create.mockImplementation((data) => data);
      insightRepo.save.mockResolvedValue([]);

      await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: { text: 'string content' } }),
      );
      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: { text: '42' } }),
      );
      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: { text: '' } }),
      );
      expect(insightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: { text: '' } }),
      );
    });

    it('handles transcript segments with null speaker', async () => {
      const segments = [makeTranscriptSegment({ speaker: null, text: 'Anonymous message' })];
      transcriptRepo.find.mockResolvedValue(segments);
      mockAiProxyService.extractInsight.mockResolvedValue([]);
      insightRepo.save.mockResolvedValue([]);

      await service.extractFromSession(SESSION_ID, TENANT_ID, USER_ID);

      expect(mockAiProxyService.extractInsight).toHaveBeenCalledWith({
        transcript: '[未知]: Anonymous message',
        interviewId: SESSION_ID,
      });
    });
  });
});
