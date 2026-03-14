import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { TranscriptionEntity } from '../../entities/transcription.entity';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface JoinSessionPayload {
  sessionId: string;
  token: string;
}

interface LeaveSessionPayload {
  sessionId: string;
}

interface TranscriptChunkPayload {
  sessionId: string;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
}

interface RequestStatusPayload {
  sessionId: string;
}

@WebSocketGateway({
  namespace: '/transcription',
  cors: { origin: '*', credentials: true },
})
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // socketId → JwtUser
  private readonly socketUsers = new Map<string, JwtPayload>();

  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly segmentRepo: Repository<TranscriptSegmentEntity>,
    @InjectRepository(TranscriptionEntity)
    private readonly transcriptionRepo: Repository<TranscriptionEntity>,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(socket: Socket): void {
    this.logger.log(`Client connected: ${socket.id}`);
    this.resetIdleTimeout(socket);
  }

  handleDisconnect(socket: Socket): void {
    const timeout = socket.data['idleTimeout'] as NodeJS.Timeout | undefined;
    if (timeout) clearTimeout(timeout);
    this.socketUsers.delete(socket.id);
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ): Promise<void> {
    try {
      const user = this.jwtService.verify<JwtPayload>(payload.token);
      this.socketUsers.set(socket.id, user);
      await socket.join(`session:${payload.sessionId}`);
      socket.emit('joined', { sessionId: payload.sessionId, userId: user.sub });
      this.logger.log(`User ${user.sub} joined session ${payload.sessionId}`);
    } catch {
      socket.emit('error', { message: '无效的身份验证 token' });
    }
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LeaveSessionPayload,
  ): Promise<void> {
    await socket.leave(`session:${payload.sessionId}`);
    socket.emit('left', { sessionId: payload.sessionId });
  }

  @SubscribeMessage('transcript-chunk')
  async handleTranscriptChunk(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: TranscriptChunkPayload,
  ): Promise<void> {
    const user = this.socketUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { message: '请先加入会话' });
      return;
    }

    try {
      const segment = this.segmentRepo.create({
        sessionId: payload.sessionId,
        tenantId: user.tenantId,
        text: payload.text,
        startMs: payload.startMs,
        endMs: payload.endMs,
        speaker: payload.speaker ?? null,
      });
      await this.segmentRepo.save(segment);

      const broadcastPayload = {
        sessionId: payload.sessionId,
        text: payload.text,
        startMs: payload.startMs,
        endMs: payload.endMs,
        speaker: payload.speaker ?? null,
        timestamp: new Date(),
      };
      this.server.to(`session:${payload.sessionId}`).emit('transcript-update', broadcastPayload);
    } catch (err) {
      this.logger.error('Failed to save transcript segment', err);
      socket.emit('error', { message: '转写片段保存失败' });
    }
  }

  @SubscribeMessage('request-status')
  async handleRequestStatus(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: RequestStatusPayload,
  ): Promise<void> {
    try {
      const transcription = await this.transcriptionRepo.findOne({
        where: { sessionId: payload.sessionId },
        order: { createdAt: 'DESC' },
      });

      socket.emit('status-update', {
        sessionId: payload.sessionId,
        status: transcription?.status ?? 'unknown',
      });
    } catch (err) {
      this.logger.error('Failed to query transcription status', err);
      socket.emit('error', { message: '状态查询失败' });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket, @MessageBody() payload: { token?: string }): void {
    this.resetIdleTimeout(socket);

    if (payload?.token) {
      try {
        const user = this.jwtService.verify<JwtPayload>(payload.token);
        this.socketUsers.set(socket.id, user);
        socket.emit('pong', { status: 'ok', tokenRefreshed: true });
      } catch {
        socket.emit('token-expired', { message: '新 token 验证失败，请重新登录' });
        socket.disconnect(true);
      }
      return;
    }

    if (!this.socketUsers.has(socket.id)) {
      socket.emit('token-expired', { message: '请先加入会话' });
      return;
    }
    socket.emit('pong', { status: 'ok', tokenRefreshed: false });
  }

  private resetIdleTimeout(socket: Socket): void {
    const existing = socket.data['idleTimeout'] as NodeJS.Timeout | undefined;
    if (existing) clearTimeout(existing);
    socket.data['idleTimeout'] = setTimeout(() => {
      this.logger.warn(`Socket ${socket.id} idle timeout reached, disconnecting`);
      socket.emit('token-expired', { message: '连接超时，请重新连接' });
      socket.disconnect(true);
    }, this.IDLE_TIMEOUT_MS);
  }
}
