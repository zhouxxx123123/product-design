import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ClientProfileEntity } from '../../entities/client-profile.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';

export interface ClientListQuery {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientProfileEntity)
    private readonly repo: Repository<ClientProfileEntity>,
  ) {}

  async findAll(tenantId: string, query: ClientListQuery) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('(c.company ILIKE :search OR c.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.industry) {
      qb.andWhere('c.industry = :industry', { industry: query.industry });
    }

    const [entities, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: entities.map(ClientResponseDto.fromEntity),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, tenantId: string): Promise<ClientResponseDto> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException(`客户档案 ${id} 不存在`);
    }
    return ClientResponseDto.fromEntity(entity);
  }

  async create(tenantId: string, dto: CreateClientDto): Promise<ClientResponseDto> {
    const firstContact = dto.contacts?.[0];
    const entity = this.repo.create({
      tenantId,
      company: dto.companyName,
      name: firstContact?.name ?? dto.companyName,
      email: firstContact?.email ?? null,
      phone: firstContact?.phone ?? null,
      position: firstContact?.title ?? null,
      industry: dto.industry ?? null,
      size: dto.size ?? null,
      status: dto.status ?? 'potential',
      tags: dto.tags ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.repo.save(entity);
    return ClientResponseDto.fromEntity(saved);
  }

  async update(id: string, tenantId: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException(`客户档案 ${id} 不存在`);
    }
    if (dto.companyName !== undefined) entity.company = dto.companyName;
    if (dto.industry !== undefined) entity.industry = dto.industry;
    if (dto.size !== undefined) entity.size = dto.size;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.tags !== undefined) entity.tags = dto.tags;
    if (dto.notes !== undefined) entity.notes = dto.notes;
    // Update contact fields from first contact
    if (dto.contacts !== undefined) {
      const firstContact = dto.contacts[0];
      if (firstContact) {
        if (firstContact.name !== undefined) entity.name = firstContact.name;
        if (firstContact.email !== undefined) entity.email = firstContact.email;
        if (firstContact.phone !== undefined) entity.phone = firstContact.phone;
        if (firstContact.title !== undefined) entity.position = firstContact.title;
      }
    }
    const saved = await this.repo.save(entity);
    return ClientResponseDto.fromEntity(saved);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException(`客户档案 ${id} 不存在`);
    }
    entity.deletedAt = new Date();
    await this.repo.save(entity);
    return { success: true };
  }
}
