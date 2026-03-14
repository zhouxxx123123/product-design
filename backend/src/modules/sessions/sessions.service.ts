import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InterviewSessionEntity, InterviewStatus } from '../../entities/interview-session.entity';
import { SessionCommentEntity } from '../../entities/session-comment.entity';
import { SessionCaseLinkEntity } from '../../entities/session-case-link.entity';
import { CreateSessionDto, UpdateSessionDto } from './dto';

export interface SessionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: InterviewStatus;
  clientId?: string;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(InterviewSessionEntity)
    private readonly repo: Repository<InterviewSessionEntity>,
    @InjectRepository(SessionCommentEntity)
    private readonly commentsRepo: Repository<SessionCommentEntity>,
    @InjectRepository(SessionCaseLinkEntity)
    private readonly caseLinksRepo: Repository<SessionCaseLinkEntity>,
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

    const [data, total] = await qb
      .orderBy('s.interviewDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, tenantId: string): Promise<InterviewSessionEntity> {
    const item = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(`访谈会话 ${id} 不存在`);
    }
    return item;
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
    const item = await this.findById(id, tenantId);
    if (dto.interviewDate) {
      dto.interviewDate = new Date(dto.interviewDate);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
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

  async addComment(
    sessionId: string,
    authorId: string,
    tenantId: string,
    content: string,
    targetType?: string,
    targetId?: string,
  ): Promise<SessionCommentEntity> {
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
