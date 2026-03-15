import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InterviewSessionEntity, InterviewStatus } from '../../entities/interview-session.entity';
import { SessionCommentEntity } from '../../entities/session-comment.entity';
import { SessionCaseLinkEntity } from '../../entities/session-case-link.entity';
import { StorageFileEntity } from '../../entities/storage-file.entity';
import { CreateSessionDto, UpdateSessionDto } from './dto';

export interface SessionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: InterviewStatus;
  clientId?: string;
}

export type SessionWithRecording = Omit<InterviewSessionEntity, 'setCreatedAt' | 'setUpdatedAt'> & {
  recordingUrl: string | null;
};

export type SessionListItem = Omit<InterviewSessionEntity, 'setCreatedAt' | 'setUpdatedAt'> & {
  insightsCount: number;
  commentsCount: number;
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(InterviewSessionEntity)
    private readonly repo: Repository<InterviewSessionEntity>,
    @InjectRepository(SessionCommentEntity)
    private readonly commentsRepo: Repository<SessionCommentEntity>,
    @InjectRepository(SessionCaseLinkEntity)
    private readonly caseLinksRepo: Repository<SessionCaseLinkEntity>,
    @InjectRepository(StorageFileEntity)
    private readonly storageFileRepo: Repository<StorageFileEntity>,
  ) {}

  async findAll(tenantId: string, query: SessionListQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.deletedAt IS NULL');

    if (query.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }

    if (query.clientId) {
      qb.andWhere('s.clientId = :clientId', { clientId: query.clientId });
    }

    if (query.search) {
      qb.andWhere('s.title ILIKE :search', { search: `%${query.search}%` });
    }

    // Add aggregation counts via subqueries
    qb.addSelect(
      '(SELECT COUNT(*) FROM session_insights si WHERE si.session_id = s.id)',
      's_insightsCount',
    ).addSelect(
      '(SELECT COUNT(*) FROM session_comments sc WHERE sc.session_id = s.id)',
      's_commentsCount',
    );

    const [data, total] = await qb
      .orderBy('s.interviewDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Transform data to include count fields
    const transformedData: SessionListItem[] = data.map((item: any) => ({
      ...item,
      insightsCount: parseInt(item.s_insightsCount) || 0,
      commentsCount: parseInt(item.s_commentsCount) || 0,
    }));

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, tenantId: string): Promise<SessionWithRecording> {
    const item = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(`访谈会话 ${id} 不存在`);
    }

    // Query for associated recording file if recordingFileId exists
    let recordingUrl: string | null = null;
    if (item.recordingFileId) {
      const storageFile = await this.storageFileRepo.findOne({
        where: {
          id: item.recordingFileId,
          tenantId,
          deletedAt: IsNull(),
        },
      });
      recordingUrl = storageFile?.url ?? null;
    }

    return {
      ...item,
      recordingUrl,
    };
  }

  async create(
    tenantId: string,
    createdBy: string,
    dto: CreateSessionDto,
  ): Promise<InterviewSessionEntity> {
    const item = this.repo.create({
      ...dto,
      tenantId,
      interviewerId: dto.interviewerId ?? createdBy,
      interviewDate: new Date(dto.interviewDate),
    });
    return this.repo.save(item);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateSessionDto,
  ): Promise<InterviewSessionEntity> {
    // Load raw entity (not the spread SessionWithRecording)
    const entity = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException(`访谈会话 ${id} 不存在`);
    }
    if (dto.interviewDate) {
      dto.interviewDate = new Date(dto.interviewDate);
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: InterviewStatus,
  ): Promise<InterviewSessionEntity> {
    const item = await this.findById(id, tenantId);
    item.status = status;

    if (status === InterviewStatus.IN_PROGRESS && !item.startedAt) {
      item.startedAt = new Date();
    }
    if (status === InterviewStatus.COMPLETED && !item.completedAt) {
      item.completedAt = new Date();
    }

    return this.repo.save(item);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const item = await this.findById(id, tenantId);
    item.deletedAt = new Date();
    await this.repo.save(item);
    return { success: true };
  }

  private async assertSessionExists(sessionId: string, tenantId: string): Promise<void> {
    const exists = await this.repo.findOne({
      where: { id: sessionId, tenantId, deletedAt: IsNull() },
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException(`会话 ${sessionId} 不存在或无权访问`);
    }
  }

  async addComment(
    sessionId: string,
    authorId: string,
    tenantId: string,
    content: string,
    targetType?: string,
    targetId?: string,
  ): Promise<SessionCommentEntity> {
    await this.assertSessionExists(sessionId, tenantId);

    const comment = this.commentsRepo.create({
      sessionId,
      authorId,
      tenantId,
      content,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
    });
    return this.commentsRepo.save(comment);
  }

  async getComments(sessionId: string, tenantId: string): Promise<SessionCommentEntity[]> {
    return this.commentsRepo.find({
      where: { sessionId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async addCaseLink(
    sessionId: string,
    caseId: string,
    tenantId: string,
    addedBy: string,
    reason?: string,
  ): Promise<SessionCaseLinkEntity> {
    await this.assertSessionExists(sessionId, tenantId);

    const link = this.caseLinksRepo.create({
      sessionId,
      caseId,
      tenantId,
      addedBy,
      reason: reason ?? null,
    });
    return this.caseLinksRepo.save(link);
  }

  async getCaseLinks(sessionId: string, tenantId: string): Promise<SessionCaseLinkEntity[]> {
    return this.caseLinksRepo.find({
      where: { sessionId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}
