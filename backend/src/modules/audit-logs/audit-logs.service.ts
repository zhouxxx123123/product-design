import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity, AuditAction } from '../../entities/audit-log.entity';

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateAuditLogData {
  action: AuditAction;
  entityType: string;
  entityId: string;
  tenantId: string;
  userId: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  notes?: string | null;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async findAll(tenantId: string, query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC');

    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const [data, total] = await qb
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

  async create(data: CreateAuditLogData): Promise<AuditLogEntity> {
    const auditLog = this.auditLogRepository.create({
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      tenantId: data.tenantId,
      userId: data.userId,
      oldValues: data.oldValues ?? null,
      newValues: data.newValues ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      requestId: data.requestId ?? null,
      notes: data.notes ?? null,
    });
    return this.auditLogRepository.save(auditLog);
  }
}
