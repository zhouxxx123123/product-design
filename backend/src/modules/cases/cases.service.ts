import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { CaseEntity, CaseType, CaseStatus } from '../../entities/case.entity';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty({ message: 'title 不能为空' })
  title: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  content: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}

export interface CaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  tags?: string;
}

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(CaseEntity)
    private readonly repo: Repository<CaseEntity>,
  ) {}

  async findAll(tenantId: string, query: CaseListQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.deletedAt IS NULL');

    if (query.industry) {
      qb.andWhere('c.industry = :industry', { industry: query.industry });
    }

    if (query.tags) {
      // JSONB contains check — tags query param is a comma-separated string
      const tagList = query.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        qb.andWhere('c.tags @> :tags::jsonb', {
          tags: JSON.stringify(tagList),
        });
      }
    }

    if (query.search) {
      qb.andWhere('c.title ILIKE :search', { search: `%${query.search}%` });
    }

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
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

  async findById(id: string, tenantId: string): Promise<CaseEntity> {
    const item = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(`案例 ${id} 不存在`);
    }
    return item;
  }

  async create(tenantId: string, createdBy: string, dto: CreateCaseDto): Promise<CaseEntity> {
    const item = this.repo.create({
      ...dto,
      tenantId,
      createdBy,
      tags: dto.tags ?? [],
      metadata: dto.metadata ?? {},
    });
    return this.repo.save(item);
  }

  async update(id: string, tenantId: string, dto: UpdateCaseDto): Promise<CaseEntity> {
    const item = await this.findById(id, tenantId);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const item = await this.findById(id, tenantId);
    item.deletedAt = new Date();
    await this.repo.save(item);
    return { success: true };
  }
}
