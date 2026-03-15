import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ClientProfileEntity } from '../../entities/client-profile.entity';
import { ClientContactEntity } from '../../entities/client-contact.entity';
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
    @InjectRepository(ClientContactEntity)
    private readonly contactRepo: Repository<ClientContactEntity>,
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
      .leftJoinAndSelect('c.contacts', 'contacts')
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('contacts.sortOrder', 'ASC')
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
      relations: ['contacts'],
      order: { contacts: { sortOrder: 'ASC' } },
    });
    if (!entity) {
      throw new NotFoundException(`客户档案 ${id} 不存在`);
    }
    return ClientResponseDto.fromEntity(entity);
  }

  async create(tenantId: string, dto: CreateClientDto): Promise<ClientResponseDto> {
    // Create the client profile without contact fields
    const entity = this.repo.create({
      tenantId,
      company: dto.companyName,
      name: dto.companyName, // Use company name as default name
      email: null,
      phone: null,
      position: null,
      industry: dto.industry ?? null,
      size: dto.size ?? null,
      status: dto.status ?? 'potential',
      tags: dto.tags ?? null,
      notes: dto.notes ?? null,
    });
    const savedClient = await this.repo.save(entity);

    // Create contacts if provided (max 2)
    if (dto.contacts && dto.contacts.length > 0) {
      const contactEntities = dto.contacts.slice(0, 2).map((contact, index) =>
        this.contactRepo.create({
          clientId: savedClient.id,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          position: contact.title ?? null,
          sortOrder: index,
        }),
      );
      await this.contactRepo.save(contactEntities);

      // Reload client with contacts
      const clientWithContacts = await this.repo.findOne({
        where: { id: savedClient.id },
        relations: ['contacts'],
        order: { contacts: { sortOrder: 'ASC' } },
      });
      return ClientResponseDto.fromEntity(clientWithContacts!);
    }

    return ClientResponseDto.fromEntity(savedClient);
  }

  async update(id: string, tenantId: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException(`客户档案 ${id} 不存在`);
    }

    // Update client profile fields
    if (dto.companyName !== undefined) entity.company = dto.companyName;
    if (dto.industry !== undefined) entity.industry = dto.industry;
    if (dto.size !== undefined) entity.size = dto.size;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.tags !== undefined) entity.tags = dto.tags;
    if (dto.notes !== undefined) entity.notes = dto.notes;

    // Update contacts if provided
    if (dto.contacts !== undefined) {
      // Delete existing contacts
      await this.contactRepo.delete({ clientId: id });

      // Create new contacts (max 2)
      if (dto.contacts.length > 0) {
        const contactEntities = dto.contacts.slice(0, 2).map((contact, index) =>
          this.contactRepo.create({
            clientId: id,
            name: contact.name,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            position: contact.title ?? null,
            sortOrder: index,
          }),
        );
        await this.contactRepo.save(contactEntities);
      }
    }

    const saved = await this.repo.save(entity);

    // Reload with contacts
    const clientWithContacts = await this.repo.findOne({
      where: { id: saved.id },
      relations: ['contacts'],
      order: { contacts: { sortOrder: 'ASC' } },
    });
    return ClientResponseDto.fromEntity(clientWithContacts!);
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
