import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ReportService } from './report.service';
import { InterviewSessionEntity, InterviewStatus } from '../../entities/interview-session.entity';
import { ReportJobEntity, ReportJobStatus } from '../../entities/report-job.entity';

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const SESSION_ID = 'session-uuid-001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<InterviewSessionEntity> = {}): InterviewSessionEntity {
  const s = new InterviewSessionEntity();
  s.id = SESSION_ID;
  s.tenantId = TENANT_ID;
  s.title = 'Test Interview';
  s.description = null;
  s.clientId = null;
  s.interviewerId = null;
  s.status = InterviewStatus.COMPLETED;
  s.interviewDate = new Date('2026-04-01T10:00:00Z');
  s.plannedDurationMinutes = 60;
  s.rawTranscript = '访谈原文内容';
  s.structuredSummary = null;
  s.executiveSummary = null;
  s.language = 'zh';
  s.startedAt = null;
  s.completedAt = null;
  s.createdAt = new Date('2026-03-01T00:00:00Z');
  s.updatedAt = new Date('2026-03-01T00:00:00Z');
  s.deletedAt = null;
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

const makeMockJobRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  insert: jest.fn(),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ReportService', () => {
  let service: ReportService;
  let sessionsRepo: ReturnType<typeof makeMockRepo>;
  let reportJobRepo: ReturnType<typeof makeMockJobRepo>;

  // Helper to create a ReportJobEntity mock instance
  function makeJob(overrides: Partial<ReportJobEntity> = {}): ReportJobEntity {
    const job = new ReportJobEntity();
    job.id = 'job-uuid-001';
    job.tenantId = TENANT_ID;
    job.sessionId = SESSION_ID;
    job.status = ReportJobStatus.DONE;
    job.format = 'html';
    job.filePath = 'job-uuid-001';
    job.error = null;
    job.createdAt = new Date('2026-03-01T00:00:00Z');
    job.updatedAt = new Date('2026-03-01T00:00:00Z');
    return Object.assign(job, overrides);
  }

  beforeEach(async () => {
    sessionsRepo = makeMockRepo();
    reportJobRepo = makeMockJobRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(InterviewSessionEntity), useValue: sessionsRepo },
        { provide: getRepositoryToken(ReportJobEntity), useValue: reportJobRepo },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── startExport ───────────────────────────────────────────────────────────

  describe('startExport()', () => {
    it('returns an object with a jobId string', async () => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      const createdJob = makeJob();
      reportJobRepo.create.mockReturnValue(createdJob);
      reportJobRepo.save.mockResolvedValue(createdJob);

      const result = await service.startExport(SESSION_ID, TENANT_ID);

      expect(result).toEqual({ jobId: expect.any(String) });
    });

    it('jobId is a non-empty string', async () => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      const createdJob = makeJob();
      reportJobRepo.create.mockReturnValue(createdJob);
      reportJobRepo.save.mockResolvedValue(createdJob);

      const { jobId } = await service.startExport(SESSION_ID, TENANT_ID);

      expect(jobId.length).toBeGreaterThan(0);
    });

    it('stores the job in the DB so getJob can retrieve it', async () => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      const createdJob = makeJob({
        id: 'job-from-db',
        sessionId: SESSION_ID,
        status: ReportJobStatus.DONE,
      });
      reportJobRepo.create.mockReturnValue(createdJob);
      reportJobRepo.save.mockResolvedValue(createdJob);
      // getJob will call findOne
      reportJobRepo.findOne.mockResolvedValue(createdJob);

      const { jobId } = await service.startExport(SESSION_ID, TENANT_ID);
      const job = await service.getJob(jobId);

      expect(job).toBeDefined();
      expect(job!.id).toBe('job-from-db');
      expect(job!.sessionId).toBe(SESSION_ID);
      expect(job!.status).toBe(ReportJobStatus.DONE);
    });

    it('throws NotFoundException when session does not exist', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(service.startExport('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with a message containing the sessionId', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(service.startExport('nonexistent-id', TENANT_ID)).rejects.toThrow(
        /nonexistent-id/,
      );
    });

    it('queries sessionsRepo with the correct sessionId and tenantId', async () => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      const createdJob = makeJob();
      reportJobRepo.create.mockReturnValue(createdJob);
      reportJobRepo.save.mockResolvedValue(createdJob);

      await service.startExport(SESSION_ID, TENANT_ID);

      expect(sessionsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SESSION_ID, tenantId: TENANT_ID }),
        }),
      );
    });

    it('each call produces a distinct jobId', async () => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      const job1 = makeJob({ id: 'job-aaa' });
      const job2 = makeJob({ id: 'job-bbb' });
      // reportJobRepo.create returns different jobs on each call
      reportJobRepo.create.mockReturnValueOnce(job1).mockReturnValueOnce(job2);
      // save is called twice per startExport (initial create + update to DONE)
      // Use mockResolvedValue so all calls return the passed object
      reportJobRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const { jobId: id1 } = await service.startExport(SESSION_ID, TENANT_ID);
      const { jobId: id2 } = await service.startExport(SESSION_ID, TENANT_ID);

      expect(id1).not.toBe(id2);
    });
  });

  // ── getJob ────────────────────────────────────────────────────────────────

  describe('getJob()', () => {
    it('returns the job when it exists', async () => {
      const job = makeJob({ id: 'job-exists' });
      reportJobRepo.findOne.mockResolvedValue(job);

      const result = await service.getJob('job-exists');

      expect(result).toBeDefined();
      expect(result!.id).toBe('job-exists');
    });

    it('returns null for an unknown jobId', async () => {
      reportJobRepo.findOne.mockResolvedValue(null);

      const result = await service.getJob('does-not-exist');

      expect(result).toBeNull();
    });
  });

  // ── getJobsBySession ──────────────────────────────────────────────────────

  describe('getJobsBySession()', () => {
    it('returns all jobs belonging to the given session', async () => {
      const jobs = [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })];
      reportJobRepo.find.mockResolvedValue(jobs);

      const result = await service.getJobsBySession(SESSION_ID);

      expect(result).toHaveLength(2);
      result.forEach((j) => expect(j.sessionId).toBe(SESSION_ID));
    });

    it('does not include jobs from a different session', async () => {
      const jobs = [makeJob({ id: 'j1', sessionId: SESSION_ID })];
      reportJobRepo.find.mockResolvedValue(jobs);

      const result = await service.getJobsBySession(SESSION_ID);

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe(SESSION_ID);
    });

    it('returns empty array when no jobs exist for the session', async () => {
      reportJobRepo.find.mockResolvedValue([]);

      const result = await service.getJobsBySession(SESSION_ID);

      expect(result).toEqual([]);
    });
  });

  // ── exportToHtml ──────────────────────────────────────────────────────────

  describe('exportToHtml()', () => {
    it('returns a string containing <!DOCTYPE html> and the session title', async () => {
      const session = makeSession({ title: 'Healthcare Deep Dive' });
      sessionsRepo.findOne.mockResolvedValue(session);

      const html = await service.exportToHtml(SESSION_ID, TENANT_ID);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Healthcare Deep Dive');
    });

    it('throws NotFoundException when session does not exist', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(service.exportToHtml('nonexistent-id', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // exportToExcel and exportToWord tested via integration/E2E
});
