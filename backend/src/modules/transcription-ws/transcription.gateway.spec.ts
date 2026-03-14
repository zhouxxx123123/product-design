import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { TranscriptionEntity, TranscriptionStatus } from '../../entities/transcription.entity';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSocket(id = 'socket-001'): jest.Mocked<any> {
  return {
    id,
    data: {},
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  };
}

function makeJwtPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-uuid-001',
    email: 'user@example.com',
    role: 'member',
    tenantId: 'tenant-uuid-001',
    ...overrides,
  };
}

function makeTranscription(overrides: Partial<TranscriptionEntity> = {}): TranscriptionEntity {
  const t = new TranscriptionEntity();
  t.id = 'transcription-uuid-001';
  t.sessionId = 'session-uuid-001';
  t.recordingId = null;
  t.content = '';
  t.segments = null;
  t.speakerLabels = null;
  t.status = TranscriptionStatus.COMPLETED;
  t.engine = 'tencent' as any;
  t.confidenceScore = null;
  t.language = 'zh';
  t.rawResponse = null;
  t.createdAt = new Date('2026-03-01T00:00:00Z');
  t.updatedAt = new Date('2026-03-01T00:00:00Z');
  t.deletedAt = null;
  return Object.assign(t, overrides);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TranscriptionGateway', () => {
  let gateway: TranscriptionGateway;
  let segmentRepo: { create: jest.Mock; save: jest.Mock };
  let transcriptionRepo: { findOne: jest.Mock };
  let jwtService: { verify: jest.Mock };

  beforeEach(async () => {
    segmentRepo = { create: jest.fn(), save: jest.fn() };
    transcriptionRepo = { findOne: jest.fn() };
    jwtService = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionGateway,
        { provide: getRepositoryToken(TranscriptSegmentEntity), useValue: segmentRepo },
        { provide: getRepositoryToken(TranscriptionEntity), useValue: transcriptionRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<TranscriptionGateway>(TranscriptionGateway);

    // Inject a mock server so broadcast calls do not blow up
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
  });

  afterEach(() => jest.clearAllMocks());

  // ── handleConnection ──────────────────────────────────────────────────────

  describe('handleConnection()', () => {
    it('does not call socket.emit on connect (no error emitted)', () => {
      const socket = makeSocket();

      expect(() => gateway.handleConnection(socket)).not.toThrow();
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  // ── handleDisconnect ──────────────────────────────────────────────────────

  describe('handleDisconnect()', () => {
    it('removes the socket from socketUsers so the user is no longer tracked', async () => {
      const socket = makeSocket('socket-disconnect-test');
      const payload = { sessionId: 'session-001', token: 'valid.token' };
      jwtService.verify.mockReturnValue(makeJwtPayload());

      // Register the user by joining a session first
      await gateway.handleJoinSession(socket, payload);
      // Confirm the socket has a user registered (join emits 'joined')
      expect(socket.emit).toHaveBeenCalledWith('joined', expect.any(Object));

      // Now disconnect — the internal map entry should be removed
      gateway.handleDisconnect(socket);

      // Attempting to send a transcript chunk must now emit 'error' (no user)
      const chunkPayload = { sessionId: 'session-001', text: 'text', startMs: 0, endMs: 100 };
      segmentRepo.create.mockReturnValue({});
      segmentRepo.save.mockResolvedValue({});
      await gateway.handleTranscriptChunk(socket, chunkPayload);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: '请先加入会话' });
    });
  });

  // ── handleJoinSession ─────────────────────────────────────────────────────

  describe('handleJoinSession()', () => {
    it('with valid token: socket joins the room and emits "joined" with sessionId and userId', async () => {
      const socket = makeSocket();
      const user = makeJwtPayload({ sub: 'user-uuid-001' });
      jwtService.verify.mockReturnValue(user);
      const payload = { sessionId: 'session-abc', token: 'good.token' };

      await gateway.handleJoinSession(socket, payload);

      expect(socket.join).toHaveBeenCalledWith('session:session-abc');
      expect(socket.emit).toHaveBeenCalledWith('joined', {
        sessionId: 'session-abc',
        userId: 'user-uuid-001',
      });
    });

    it('with invalid token: socket emits "error" with an error message', async () => {
      const socket = makeSocket();
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const payload = { sessionId: 'session-abc', token: 'bad.token' };

      await gateway.handleJoinSession(socket, payload);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', { message: '无效的身份验证 token' });
    });
  });

  // ── handleLeaveSession ────────────────────────────────────────────────────

  describe('handleLeaveSession()', () => {
    it('socket leaves the room and emits "left" with sessionId', async () => {
      const socket = makeSocket();
      const payload = { sessionId: 'session-leave' };

      await gateway.handleLeaveSession(socket, payload);

      expect(socket.leave).toHaveBeenCalledWith('session:session-leave');
      expect(socket.emit).toHaveBeenCalledWith('left', { sessionId: 'session-leave' });
    });
  });

  // ── handleTranscriptChunk ─────────────────────────────────────────────────

  describe('handleTranscriptChunk()', () => {
    it('without prior join: emits "error" with 请先加入会话', async () => {
      const socket = makeSocket('no-auth-socket');
      const payload = { sessionId: 'session-001', text: 'hello', startMs: 0, endMs: 100 };

      await gateway.handleTranscriptChunk(socket, payload);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: '请先加入会话' });
      expect(segmentRepo.save).not.toHaveBeenCalled();
    });

    it('after joining: saves segment to repo and broadcasts transcript-update to the room', async () => {
      const socket = makeSocket('authed-socket');
      const user = makeJwtPayload({ sub: 'user-001', tenantId: 'tenant-001' });
      jwtService.verify.mockReturnValue(user);

      // First join to register the user
      await gateway.handleJoinSession(socket, { sessionId: 'session-xyz', token: 'valid.token' });

      const savedSegment = new TranscriptSegmentEntity();
      savedSegment.id = 'seg-new';
      segmentRepo.create.mockReturnValue(savedSegment);
      segmentRepo.save.mockResolvedValue(savedSegment);

      const mockRoomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: mockRoomEmit });

      const chunkPayload = {
        sessionId: 'session-xyz',
        text: 'This is a transcript',
        startMs: 100,
        endMs: 500,
        speaker: 'Interviewer',
      };

      await gateway.handleTranscriptChunk(socket, chunkPayload);

      expect(segmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-xyz',
          tenantId: 'tenant-001',
          text: 'This is a transcript',
          startMs: 100,
          endMs: 500,
          speaker: 'Interviewer',
        }),
      );
      expect(segmentRepo.save).toHaveBeenCalledWith(savedSegment);
      expect(gateway.server.to).toHaveBeenCalledWith('session:session-xyz');
      expect(mockRoomEmit).toHaveBeenCalledWith(
        'transcript-update',
        expect.objectContaining({
          sessionId: 'session-xyz',
          text: 'This is a transcript',
        }),
      );
    });
  });

  // ── handleRequestStatus ───────────────────────────────────────────────────

  describe('handleRequestStatus()', () => {
    it('finds the transcription and emits status-update with its status', async () => {
      const socket = makeSocket();
      const transcription = makeTranscription({ status: TranscriptionStatus.COMPLETED });
      transcriptionRepo.findOne.mockResolvedValue(transcription);

      await gateway.handleRequestStatus(socket, { sessionId: 'session-status' });

      expect(socket.emit).toHaveBeenCalledWith('status-update', {
        sessionId: 'session-status',
        status: TranscriptionStatus.COMPLETED,
      });
    });

    it('emits status-update with status "unknown" when no transcription is found', async () => {
      const socket = makeSocket();
      transcriptionRepo.findOne.mockResolvedValue(null);

      await gateway.handleRequestStatus(socket, { sessionId: 'session-missing' });

      expect(socket.emit).toHaveBeenCalledWith('status-update', {
        sessionId: 'session-missing',
        status: 'unknown',
      });
    });
  });
});
