import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopilotMemoryEntity, MemoryType } from '../../entities/copilot-memory.entity';

export interface MemoryListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: MemoryType;
}

export interface MemoryListResult {
  data: CopilotMemoryEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MemoriesService {
  constructor(
    @InjectRepository(CopilotMemoryEntity)
    private readonly repo: Repository<CopilotMemoryEntity>,
  ) {}

  async findAll(
    userId: string,
    tenantId: string,
    query: MemoryListQuery,
  ): Promise<MemoryListResult> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.userId = :userId AND m.tenantId = :tenantId', { userId, tenantId });

    if (query.type) {
      qb.andWhere('m.type = :type', { type: query.type });
    }
    if (query.search) {
      qb.andWhere('m.content ILIKE :search', { search: `%${query.search}%` });
    }

    const [data, total] = await qb
      .orderBy('m.createdAt', 'DESC')
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

  async deleteOne(id: string, userId: string): Promise<{ success: boolean }> {
    await this.repo.delete({ id, userId });
    return { success: true };
  }

  async deleteAll(userId: string, tenantId: string): Promise<{ success: boolean }> {
    await this.repo.delete({ userId, tenantId });
    return { success: true };
  }

  async exportAll(userId: string, tenantId: string): Promise<CopilotMemoryEntity[]> {
    return this.repo.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}
