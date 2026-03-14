import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DictionaryNodeEntity } from '../../entities/dictionary-node.entity';

export interface CreateDictionaryNodeDto {
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateDictionaryNodeDto {
  name?: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}

@Injectable()
export class DictionaryService {
  constructor(
    @InjectRepository(DictionaryNodeEntity)
    private readonly repo: Repository<DictionaryNodeEntity>,
  ) {}

  async findAll(tenantId: string, parentId?: string): Promise<DictionaryNodeEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId, deletedAt: IsNull() };
    if (parentId !== undefined) {
      where.parentId = parentId || null;
    }
    return this.repo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findById(id: string, tenantId: string): Promise<DictionaryNodeEntity> {
    const item = await this.repo.findOne({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { id, tenantId, deletedAt: IsNull() } as any,
    });
    if (!item) throw new NotFoundException(`字典节点 ${id} 不存在`);
    return item;
  }

  async create(tenantId: string, dto: CreateDictionaryNodeDto): Promise<DictionaryNodeEntity> {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId, tenantId);
      level = parent.level + 1;
    }
    const item = this.repo.create({
      ...dto,
      tenantId,
      level,
      parentId: dto.parentId ?? null,
    });
    return this.repo.save(item);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateDictionaryNodeDto,
  ): Promise<DictionaryNodeEntity> {
    const item = await this.findById(id, tenantId);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const item = await this.findById(id, tenantId);
    await this.cascadeSoftDelete(item.id, tenantId);
    item.deletedAt = new Date();
    await this.repo.save(item);
    return { success: true };
  }

  private async cascadeSoftDelete(parentId: string, tenantId: string): Promise<void> {
    const children = await this.repo.find({
      where: { parentId, tenantId, deletedAt: IsNull() },
    });
    for (const child of children) {
      await this.cascadeSoftDelete(child.id, tenantId);
      child.deletedAt = new Date();
      await this.repo.save(child);
    }
  }
}
