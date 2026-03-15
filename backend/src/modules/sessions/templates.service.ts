import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TemplateEntity, TemplateType, TemplateScope } from '../../entities/template.entity';
import { DefaultSection, DefaultQuestion } from './types/default-template.types';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

export interface TemplateListQuery {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  templateType?: TemplateType;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(TemplateEntity)
    private readonly repo: Repository<TemplateEntity>,
  ) {}

  private toResponse(template: TemplateEntity) {
    return {
      ...template,
      title: template.name, // 映射 name 到 title 给前端
    };
  }

  async findAll(tenantId: string, query: TemplateListQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.repo
      .createQueryBuilder('t')
      .where('(t.tenantId = :tenantId OR t.scope = :globalScope)', {
        tenantId,
        globalScope: TemplateScope.GLOBAL,
      })
      .andWhere('t.deletedAt IS NULL')
      .andWhere('t.isActive = true');

    if (query.templateType) {
      qb.andWhere('t.templateType = :templateType', {
        templateType: query.templateType,
      });
    }

    if (query.search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${query.search}%` });
    }

    const [data, total] = await qb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async getEntityById(id: string, tenantId: string): Promise<TemplateEntity> {
    const item = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(`模板 ${id} 不存在`);
    }
    // Allow access if global scope or owned by tenant
    if (item.scope !== TemplateScope.GLOBAL && item.tenantId !== tenantId) {
      throw new NotFoundException(`模板 ${id} 不存在`);
    }
    return item;
  }

  async findById(id: string, tenantId: string) {
    const item = await this.getEntityById(id, tenantId);
    return this.toResponse(item);
  }

  async create(tenantId: string, createdBy: string, dto: CreateTemplateDto) {
    const item = this.repo.create({
      ...dto,
      name: dto.title, // 映射前端 title 到 entity name
      tenantId,
      createdBy,
      content: (dto.content ?? {}) as any,
      tags: dto.tags ?? [],
      variables: (dto.variables ?? {}) as any,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repo.save(item);
    return this.toResponse(saved);
  }

  async update(id: string, tenantId: string, dto: UpdateTemplateDto) {
    const item = await this.getEntityById(id, tenantId);

    // 处理 title → name 映射
    if (dto.title) {
      item.name = dto.title;
    }

    // 移除 dto 中的 title，避免 Object.assign 覆盖
    const { title, ...dtoWithoutTitle } = dto;
    Object.assign(item, dtoWithoutTitle);

    const saved = await this.repo.save(item);
    return this.toResponse(saved);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const item = await this.getEntityById(id, tenantId);
    item.deletedAt = new Date();
    await this.repo.save(item);
    return { success: true };
  }

  async duplicate(id: string, tenantId: string, userId: string) {
    const source = await this.getEntityById(id, tenantId);
    const copy = this.repo.create({
      tenantId: tenantId, // always use caller's tenantId, never source.tenantId
      createdBy: userId, // use current user as creator
      name: `${source.name} 副本`,
      code: source.code ? `${source.code}_copy` : undefined,
      templateType: source.templateType,
      description: source.description,
      content: source.content,
      scope: TemplateScope.TENANT, // copies are always tenant-scoped
      tags: [...source.tags],
      variables: { ...source.variables },
      metadata: { ...source.metadata },
      isActive: source.isActive,
      isDefault: false,
    });
    const saved = await this.repo.save(copy);
    return this.toResponse(saved);
  }

  async setDefault(id: string, tenantId: string) {
    const item = await this.getEntityById(id, tenantId);
    // Clear all other defaults for this tenant
    await this.repo
      .createQueryBuilder()
      .update(TemplateEntity)
      .set({ isDefault: false })
      .where('tenantId = :tenantId AND id != :id', { tenantId, id })
      .execute();
    item.isDefault = true;
    const saved = await this.repo.save(item);
    return this.toResponse(saved);
  }

  async findCategories(tenantId: string): Promise<{ category: string; count: number }[]> {
    const result = await this.repo
      .createQueryBuilder('t')
      .select("t.metadata->>'category' as category")
      .addSelect('COUNT(*) as count')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.deletedAt IS NULL')
      .andWhere("t.metadata->>'category' IS NOT NULL")
      .groupBy("t.metadata->>'category'")
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((row) => ({
      category: row.category,
      count: parseInt(row.count, 10),
    }));
  }

  async getDefaultStructure(): Promise<{ sections: DefaultSection[] }> {
    return {
      sections: [
        {
          id: 's1',
          title: '开场白',
          description: '建立融洽关系',
          questions: [
            { id: 'q1', text: '能简单介绍一下您的工作背景和职责吗？', type: 'open' },
            { id: 'q2', text: '您在这个领域工作了多久了？', type: 'open' },
          ],
        },
        {
          id: 's2',
          title: '现状了解',
          description: '了解当前工作流程',
          questions: [
            { id: 'q3', text: '能描述一下您目前的工作流程吗？', type: 'open' },
            { id: 'q4', text: '您目前使用哪些工具来完成这项工作？', type: 'open' },
          ],
        },
        {
          id: 's3',
          title: '痛点探索',
          description: '发现核心问题',
          questions: [
            { id: 'q5', text: '在这个流程中，您觉得最困难或最耗时的部分是什么？', type: 'open' },
            { id: 'q6', text: '这些问题对您的工作效率有什么影响？', type: 'open' },
          ],
        },
        {
          id: 's4',
          title: '期望与需求',
          description: '了解理想状态',
          questions: [
            { id: 'q7', text: '如果可以改进一件事，您希望是什么？', type: 'open' },
            { id: 'q8', text: '您理想中的解决方案是什么样子的？', type: 'open' },
          ],
        },
      ],
    };
  }
}
