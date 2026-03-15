import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TranscriptService, CreateSegmentDto } from './transcript.service';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';
import { BulkCreateTranscriptSegmentDto } from './transcript.dto';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const SESSION_ID = 'session-uuid-001';
const SEGMENT_ID = 'segment-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSegment(overrides: Partial<TranscriptSegmentEntity> = {}): TranscriptSegmentEntity {
  const s = new TranscriptSegmentEntity();
  s.id = SEGMENT_ID;
  s.sessionId = SESSION_ID;
  s.tenantId = TENANT_ID;
  s.text = 'Hello world';
  s.startMs = 0;
  s.endMs = 1000;
  s.speaker = 'Speaker A';
  s.createdAt = new Date('2026-03-01T00:00:00Z');
  return Object.assign(s, overrides);
}

// ─── Mock repository factory ──────────────────────────────────────────────────

const makeMockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TranscriptService', () => {
  let service: TranscriptService;
  let repo: ReturnType<typeof makeMockRepo>;
  let sessionRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    repo = makeMockRepo();
    sessionRepo = makeMockRepo();
    // Mock session existence check by default
    sessionRepo.findOne.mockResolvedValue({ id: SESSION_ID, tenantId: TENANT_ID });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptService,
        { provide: getRepositoryToken(TranscriptSegmentEntity), useValue: repo },
        { provide: getRepositoryToken(InterviewSessionEntity), useValue: sessionRepo },
      ],
    }).compile();

    service = module.get<TranscriptService>(TranscriptService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findBySession ─────────────────────────────────────────────────────────

  describe('findBySession()', () => {
    it('returns segments ordered by startMs ASC for the given session and tenant', async () => {
      const segments = [
        makeSegment({ startMs: 0 }),
        makeSegment({ id: 'segment-uuid-002', startMs: 1000 }),
      ];
      repo.find.mockResolvedValue(segments);

      const result = await service.findBySession(SESSION_ID, TENANT_ID);

      expect(repo.find).toHaveBeenCalledWith({
        where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
        order: { startMs: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toBe(segments);
    });

    it('returns empty array when no segments exist for the session', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findBySession(SESSION_ID, TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('passes sessionId and tenantId to repo.create', async () => {
      const dto: CreateSegmentDto = { text: 'Hello' };
      const segment = makeSegment({ text: 'Hello' });
      repo.create.mockReturnValue(segment);
      repo.save.mockResolvedValue(segment);

      await service.create(SESSION_ID, TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          tenantId: TENANT_ID,
        }),
      );
    });

    it('defaults startMs, endMs and speaker to null when omitted', async () => {
      const dto: CreateSegmentDto = { text: 'No timing' };
      const segment = makeSegment({ startMs: null, endMs: null, speaker: null });
      repo.create.mockReturnValue(segment);
      repo.save.mockResolvedValue(segment);

      await service.create(SESSION_ID, TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startMs: null, endMs: null, speaker: null }),
      );
    });

    it('uses provided startMs, endMs and speaker when given', async () => {
      const dto: CreateSegmentDto = { text: 'Timed', startMs: 200, endMs: 800, speaker: 'Alice' };
      const segment = makeSegment(dto);
      repo.create.mockReturnValue(segment);
      repo.save.mockResolvedValue(segment);

      await service.create(SESSION_ID, TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startMs: 200, endMs: 800, speaker: 'Alice' }),
      );
    });

    it('saves the created entity and returns the saved result', async () => {
      const dto: CreateSegmentDto = { text: 'Saved' };
      const created = makeSegment({ text: 'Saved' });
      const saved = makeSegment({ text: 'Saved', id: 'saved-uuid' });
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(saved);

      const result = await service.create(SESSION_ID, TENANT_ID, dto);

      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(saved);
    });
  });

  // ── bulkCreateSegments ────────────────────────────────────────────────────

  describe('bulkCreateSegments()', () => {
    it('creates one entity per segment item in the dto', async () => {
      const dto: BulkCreateTranscriptSegmentDto = {
        segments: [
          { text: 'Segment one', startMs: 0, endMs: 500 },
          { text: 'Segment two', startMs: 500, endMs: 1000 },
        ],
      };
      const entities = dto.segments.map((s, i) => makeSegment({ id: `seg-${i}`, text: s.text }));
      repo.create.mockReturnValueOnce(entities[0]).mockReturnValueOnce(entities[1]);
      repo.save.mockResolvedValue(entities);

      await service.bulkCreateSegments(SESSION_ID, TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledTimes(2);
    });

    it('attaches correct sessionId and tenantId to every created entity', async () => {
      const dto: BulkCreateTranscriptSegmentDto = {
        segments: [{ text: 'A' }, { text: 'B' }],
      };
      const entityA = makeSegment({ text: 'A' });
      const entityB = makeSegment({ text: 'B', id: 'seg-b' });
      repo.create.mockReturnValueOnce(entityA).mockReturnValueOnce(entityB);
      repo.save.mockResolvedValue([entityA, entityB]);

      await service.bulkCreateSegments(SESSION_ID, TENANT_ID, dto);

      for (const call of repo.create.mock.calls) {
        expect(call[0]).toMatchObject({ sessionId: SESSION_ID, tenantId: TENANT_ID });
      }
    });

    it('defaults startMs, endMs and speaker to null for items missing those fields', async () => {
      const dto: BulkCreateTranscriptSegmentDto = {
        segments: [{ text: 'No metadata' }],
      };
      const entity = makeSegment({ startMs: null, endMs: null, speaker: null });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue([entity]);

      await service.bulkCreateSegments(SESSION_ID, TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startMs: null, endMs: null, speaker: null }),
      );
    });

    it('saves all entities at once and returns the array', async () => {
      const dto: BulkCreateTranscriptSegmentDto = {
        segments: [{ text: 'X' }, { text: 'Y' }],
      };
      const entityX = makeSegment({ text: 'X' });
      const entityY = makeSegment({ text: 'Y', id: 'seg-y' });
      repo.create.mockReturnValueOnce(entityX).mockReturnValueOnce(entityY);
      const saved = [entityX, entityY];
      repo.save.mockResolvedValue(saved);

      const result = await service.bulkCreateSegments(SESSION_ID, TENANT_ID, dto);

      expect(repo.save).toHaveBeenCalledWith([entityX, entityY]);
      expect(result).toBe(saved);
    });
  });
});
