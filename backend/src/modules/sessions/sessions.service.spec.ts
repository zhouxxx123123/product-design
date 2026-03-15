import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { SessionsService } from './sessions.service';
import { InterviewSessionEntity, InterviewStatus } from '../../entities/interview-session.entity';
import { SessionCommentEntity } from '../../entities/session-comment.entity';
import { SessionCaseLinkEntity } from '../../entities/session-case-link.entity';
import { StorageFileEntity } from '../../entities/storage-file.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SESSION_ID = 'session-uuid-001';
const CASE_ID = 'case-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<InterviewSessionEntity> = {}): InterviewSessionEntity {
  const s = new InterviewSessionEntity();
  s.id = SESSION_ID;
  s.tenantId = TENANT_ID;
  s.title = 'Test Interview';
  s.description = null;
  s.clientId = null;
  s.interviewerId = USER_ID;
  s.status = InterviewStatus.SCHEDULED;
  s.interviewDate = new Date('2026-04-01T10:00:00Z');
  s.plannedDurationMinutes = 60;
  s.rawTranscript = null;
  s.structuredSummary = null;
  s.executiveSummary = null;
  s.language = 'zh';
  s.recordingFileId = null;
  s.startedAt = null;
  s.completedAt = null;
  s.createdAt = new Date('2026-03-01T00:00:00Z');
  s.updatedAt = new Date('2026-03-01T00:00:00Z');
  s.deletedAt = null;
  return Object.assign(s, overrides);
}

function makeComment(overrides: Partial<SessionCommentEntity> = {}): SessionCommentEntity {
  const c = new SessionCommentEntity();
  c.id = 'comment-uuid-001';
  c.sessionId = SESSION_ID;
  c.authorId = USER_ID;
  c.tenantId = TENANT_ID;
  c.content = 'A helpful comment';
  c.targetType = null;
  c.targetId = null;
  c.createdAt = new Date('2026-03-01T00:00:00Z');
  return Object.assign(c, overrides);
}

function makeCaseLink(overrides: Partial<SessionCaseLinkEntity> = {}): SessionCaseLinkEntity {
  const l = new SessionCaseLinkEntity();
  l.id = 'link-uuid-001';
  l.sessionId = SESSION_ID;
  l.caseId = CASE_ID;
  l.tenantId = TENANT_ID;
  l.addedBy = USER_ID;
  l.reason = null;
  l.createdAt = new Date('2026-03-01T00:00:00Z');
  return Object.assign(l, overrides);
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
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepo: ReturnType<typeof makeMockRepo>;
  let commentsRepo: ReturnType<typeof makeMockRepo>;
  let caseLinksRepo: ReturnType<typeof makeMockRepo>;
  let storageFileRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    sessionRepo = makeMockRepo();
    commentsRepo = makeMockRepo();
    caseLinksRepo = makeMockRepo();
    storageFileRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(InterviewSessionEntity), useValue: sessionRepo },
        { provide: getRepositoryToken(SessionCommentEntity), useValue: commentsRepo },
        { provide: getRepositoryToken(SessionCaseLinkEntity), useValue: caseLinksRepo },
        { provide: getRepositoryToken(StorageFileEntity), useValue: storageFileRepo },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a session and sets tenantId from parameter', async () => {
      const dto = {
        title: 'New Interview',
        interviewDate: '2026-04-15T10:00:00Z',
        plannedDurationMinutes: 60,
      };
      const session = makeSession({ title: dto.title });
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          title: dto.title,
          interviewDate: expect.any(Date),
        }),
      );
      expect(sessionRepo.save).toHaveBeenCalledWith(session);
      expect(result).toBe(session);
    });

    it('defaults interviewerId to createdBy when not provided', async () => {
      const dto = { title: 'Interview', interviewDate: '2026-04-15T10:00:00Z' };
      const session = makeSession();
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      await service.create(TENANT_ID, USER_ID, dto);

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ interviewerId: USER_ID }),
      );
    });

    it('uses provided interviewerId when given', async () => {
      const interviewerId = 'another-user-uuid';
      const dto = { title: 'Interview', interviewDate: '2026-04-15T10:00:00Z', interviewerId };
      const session = makeSession({ interviewerId });
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      await service.create(TENANT_ID, USER_ID, dto);

      expect(sessionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ interviewerId }));
    });

    it('converts interviewDate string to Date object', async () => {
      const dto = { title: 'Interview', interviewDate: '2026-04-15T10:00:00Z' };
      const session = makeSession();
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      await service.create(TENANT_ID, USER_ID, dto);

      const callArg = sessionRepo.create.mock.calls[0][0];
      expect(callArg.interviewDate).toBeInstanceOf(Date);
    });

    it('returns the saved entity', async () => {
      const dto = { title: 'Interview', interviewDate: new Date() };
      const session = makeSession();
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(result).toBe(session);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated response shape { data, total, page, limit, totalPages }', async () => {
      const sessionData = { ...makeSession(), s_insightsCount: '5', s_commentsCount: '3' };
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[sessionData], 1]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: [expect.objectContaining({
          ...makeSession(),
          insightsCount: 5,
          commentsCount: 3,
        })],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('uses defaults page=1 and limit=20 when not provided', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit at 100 even if query requests more', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { limit: 9999 });

      expect(result.limit).toBe(100);
    });

    it('calculates totalPages correctly for multiple pages', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 55]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.totalPages).toBe(3);
    });

    it('returns empty data with total=0 when no sessions found', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('applies status filter to query builder when status is provided', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { status: InterviewStatus.COMPLETED });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({ status: InterviewStatus.COMPLETED }),
      );
    });

    it('applies search filter to query builder when search is provided', async () => {
      const qb = sessionRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      sessionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(TENANT_ID, { search: 'quarterly' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%quarterly%' }),
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the session when found', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.findById(SESSION_ID, TENANT_ID);

      expect(sessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SESSION_ID, tenantId: TENANT_ID }),
        }),
      );
      expect(result).toEqual({
        ...session,
        recordingUrl: null,
      });
    });

    it('returns session with recording URL when recordingFileId exists', async () => {
      const session = makeSession({ recordingFileId: 'file-uuid-001' });
      const storageFile = { id: 'file-uuid-001', url: 'https://example.com/recording.mp3' };
      sessionRepo.findOne.mockResolvedValue(session);
      storageFileRepo.findOne.mockResolvedValue(storageFile);

      const result = await service.findById(SESSION_ID, TENANT_ID);

      expect(storageFileRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'file-uuid-001',
          tenantId: TENANT_ID,
          deletedAt: expect.anything(),
        },
      });
      expect(result).toEqual({
        ...session,
        recordingUrl: 'https://example.com/recording.mp3',
      });
    });

    it('throws NotFoundException when session is not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a session belonging to a different tenant', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(SESSION_ID, 'other-tenant')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the session', async () => {
      const session = makeSession();
      const updated = makeSession({ title: 'Updated Title' });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(updated);

      const result = await service.update(SESSION_ID, TENANT_ID, { title: 'Updated Title' });

      expect(sessionRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('throws NotFoundException when session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', TENANT_ID, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('converts interviewDate string to Date when provided', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.update(SESSION_ID, TENANT_ID, {
        interviewDate: '2026-05-01T09:00:00Z',
      });

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ interviewDate: expect.any(Date) }),
      );
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('updates status and returns the session', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateStatus(SESSION_ID, TENANT_ID, InterviewStatus.COMPLETED);

      expect(result.status).toBe(InterviewStatus.COMPLETED);
    });

    it('sets startedAt when transitioning to IN_PROGRESS for the first time', async () => {
      const session = makeSession({ startedAt: null });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateStatus(SESSION_ID, TENANT_ID, InterviewStatus.IN_PROGRESS);

      expect(result.startedAt).toBeInstanceOf(Date);
    });

    it('does not overwrite startedAt if already set', async () => {
      const existingStartedAt = new Date('2026-03-10T08:00:00Z');
      const session = makeSession({ startedAt: existingStartedAt });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateStatus(SESSION_ID, TENANT_ID, InterviewStatus.IN_PROGRESS);

      expect(result.startedAt).toBe(existingStartedAt);
    });

    it('sets completedAt when transitioning to COMPLETED for the first time', async () => {
      const session = makeSession({ completedAt: null });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateStatus(SESSION_ID, TENANT_ID, InterviewStatus.COMPLETED);

      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent-id', TENANT_ID, InterviewStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets deletedAt and returns { success: true }', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.softDelete(SESSION_ID, TENANT_ID);

      expect(result).toEqual({ success: true });
      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── addComment ────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('creates and saves a comment', async () => {
      const comment = makeComment();
      // Mock assertSessionExists check
      sessionRepo.findOne.mockResolvedValueOnce(makeSession()); // for assertSessionExists
      commentsRepo.create.mockReturnValue(comment);
      commentsRepo.save.mockResolvedValue(comment);

      const result = await service.addComment(SESSION_ID, USER_ID, TENANT_ID, 'A helpful comment');

      expect(commentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          authorId: USER_ID,
          tenantId: TENANT_ID,
          content: 'A helpful comment',
        }),
      );
      expect(result).toBe(comment);
    });

    it('sets targetType and targetId when provided', async () => {
      const comment = makeComment({ targetType: 'segment', targetId: 'seg-001' });
      // Mock assertSessionExists check
      sessionRepo.findOne.mockResolvedValueOnce(makeSession()); // for assertSessionExists
      commentsRepo.create.mockReturnValue(comment);
      commentsRepo.save.mockResolvedValue(comment);

      await service.addComment(
        SESSION_ID,
        USER_ID,
        TENANT_ID,
        'Comment on segment',
        'segment',
        'seg-001',
      );

      expect(commentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'segment', targetId: 'seg-001' }),
      );
    });

    it('defaults targetType and targetId to null when not provided', async () => {
      const comment = makeComment();
      // Mock assertSessionExists check
      sessionRepo.findOne.mockResolvedValueOnce(makeSession()); // for assertSessionExists
      commentsRepo.create.mockReturnValue(comment);
      commentsRepo.save.mockResolvedValue(comment);

      await service.addComment(SESSION_ID, USER_ID, TENANT_ID, 'Content');

      expect(commentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: null, targetId: null }),
      );
    });
  });

  // ── getComments ───────────────────────────────────────────────────────────

  describe('getComments()', () => {
    it('returns all comments for the session ordered by createdAt ASC', async () => {
      const comments = [makeComment()];
      commentsRepo.find.mockResolvedValue(comments);

      const result = await service.getComments(SESSION_ID, TENANT_ID);

      expect(commentsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
          order: { createdAt: 'ASC' },
        }),
      );
      expect(result).toBe(comments);
    });

    it('returns empty array when no comments exist', async () => {
      commentsRepo.find.mockResolvedValue([]);

      const result = await service.getComments(SESSION_ID, TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  // ── addCaseLink ───────────────────────────────────────────────────────────

  describe('addCaseLink()', () => {
    it('creates and saves a case link', async () => {
      const link = makeCaseLink();
      // Mock assertSessionExists check
      sessionRepo.findOne.mockResolvedValueOnce(makeSession()); // for assertSessionExists
      caseLinksRepo.create.mockReturnValue(link);
      caseLinksRepo.save.mockResolvedValue(link);

      const result = await service.addCaseLink(SESSION_ID, CASE_ID, TENANT_ID, USER_ID, 'relevant');

      expect(caseLinksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          caseId: CASE_ID,
          tenantId: TENANT_ID,
          addedBy: USER_ID,
          reason: 'relevant',
        }),
      );
      expect(result).toBe(link);
    });

    it('sets reason to null when not provided', async () => {
      const link = makeCaseLink();
      // Mock assertSessionExists check
      sessionRepo.findOne.mockResolvedValueOnce(makeSession()); // for assertSessionExists
      caseLinksRepo.create.mockReturnValue(link);
      caseLinksRepo.save.mockResolvedValue(link);

      await service.addCaseLink(SESSION_ID, CASE_ID, TENANT_ID, USER_ID);

      expect(caseLinksRepo.create).toHaveBeenCalledWith(expect.objectContaining({ reason: null }));
    });
  });

  // ── getCaseLinks ──────────────────────────────────────────────────────────

  describe('getCaseLinks()', () => {
    it('returns all case links for the session ordered by createdAt DESC', async () => {
      const links = [makeCaseLink()];
      caseLinksRepo.find.mockResolvedValue(links);

      const result = await service.getCaseLinks(SESSION_ID, TENANT_ID);

      expect(caseLinksRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: SESSION_ID, tenantId: TENANT_ID },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toBe(links);
    });
  });
});
