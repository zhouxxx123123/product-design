import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TranscriptSegmentEntity } from '../../entities/transcript-segment.entity';
import { InterviewSessionEntity } from '../../entities/interview-session.entity';
import { CreateSegmentDto, BulkCreateTranscriptSegmentDto } from './transcript.dto';

export { CreateSegmentDto } from './transcript.dto';

@Injectable()
export class TranscriptService {
  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly repo: Repository<TranscriptSegmentEntity>,
    @InjectRepository(InterviewSessionEntity)
    private readonly sessionRepo: Repository<InterviewSessionEntity>,
  ) {}

  private async assertSessionExists(sessionId: string, tenantId: string): Promise<void> {
    const exists = await this.sessionRepo.findOne({
      where: { id: sessionId, tenantId, deletedAt: IsNull() },
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException(`会话 ${sessionId} 不存在或无权访问`);
    }
  }

  async findBySession(sessionId: string, tenantId: string): Promise<TranscriptSegmentEntity[]> {
    return this.repo.find({
      where: { sessionId, tenantId },
      order: { startMs: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(
    sessionId: string,
    tenantId: string,
    dto: CreateSegmentDto,
  ): Promise<TranscriptSegmentEntity> {
    await this.assertSessionExists(sessionId, tenantId);

    const segment = this.repo.create({
      sessionId,
      tenantId,
      text: dto.text,
      startMs: dto.startMs ?? null,
      endMs: dto.endMs ?? null,
      speaker: dto.speaker ?? null,
    });
    return this.repo.save(segment);
  }

  async bulkCreateSegments(
    sessionId: string,
    tenantId: string,
    dto: BulkCreateTranscriptSegmentDto,
  ): Promise<TranscriptSegmentEntity[]> {
    await this.assertSessionExists(sessionId, tenantId);

    const entities = dto.segments.map((seg) =>
      this.repo.create({
        sessionId,
        tenantId,
        text: seg.text,
        startMs: seg.startMs ?? null,
        endMs: seg.endMs ?? null,
        speaker: seg.speaker ?? null,
      }),
    );
    return this.repo.save(entities);
  }
}
