import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CaseEntity, CaseType, CaseStatus } from '../../entities/case.entity';
import { CaseRepository } from '../case/repositories/case.repository';

export class CreateCaseDto {
  @ApiProperty({ description: '案例标题', example: 'AI助力医疗器械行业调研分析' })
  @IsString()
  @IsNotEmpty({ message: 'title 不能为空' })
  title: string;

  @ApiPropertyOptional({ description: '行业', example: '医疗器械' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: '案例类型', enum: CaseType, enumName: 'CaseType' })
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @ApiProperty({ description: '案例内容正文', example: '本次调研通过深度访谈和问卷调研...' })
  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  content: string;

  @ApiPropertyOptional({
    description: '案例摘要',
    example: '该案例展示了AI在传统医疗器械行业的应用价值...',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    description: '标签',
    type: [String],
    example: ['AI应用', '医疗器械', '深度访谈'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '元数据', type: 'object' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否公开', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateCaseDto {
  @ApiPropertyOptional({ description: '案例标题', example: 'AI助力医疗器械行业调研分析' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ description: '行业', example: '医疗器械' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: '案例类型', enum: CaseType, enumName: 'CaseType' })
  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @ApiPropertyOptional({
    description: '案例内容正文',
    example: '本次调研通过深度访谈和问卷调研...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '案例摘要',
    example: '该案例展示了AI在传统医疗器械行业的应用价值...',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    description: '标签',
    type: [String],
    example: ['AI应用', '医疗器械', '深度访谈'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '元数据', type: 'object' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否公开', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '案例状态', enum: CaseStatus, enumName: 'CaseStatus' })
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
    private readonly caseRepository: CaseRepository,
    private readonly httpService: HttpService,
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

  async similarSearch(
    tenantId: string,
    text: string,
    limit: number = 10,
  ): Promise<Array<CaseEntity & { similarity: number }>> {
    // 1. Call AI layer to get embedding
    const aiBaseUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
    const embedResp = await firstValueFrom(
      this.httpService.post<{ embedding: number[] }>(`${aiBaseUrl}/api/v1/embed`, { text }),
    );
    const embedding = embedResp.data.embedding;

    // 2. Use CaseRepository vector search
    // Use a low threshold (0.05) to ensure results even with hash-based embeddings
    return this.caseRepository.searchSimilar(tenantId, embedding, limit, 0.05);
  }
}
