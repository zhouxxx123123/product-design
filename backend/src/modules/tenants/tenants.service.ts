import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TenantEntity } from '../../entities/tenant.entity';
import { TenantMemberEntity, MemberRole } from '../../entities/tenant-member.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export interface TenantListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedTenants {
  data: TenantEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly memberRepository: Repository<TenantMemberEntity>,
  ) {}

  async findAll(query: TenantListQuery): Promise<PaginatedTenants> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.tenantRepository
      .createQueryBuilder('t')
      .where('t.deletedAt IS NULL')
      .orderBy('t.createdAt', 'DESC');

    if (query.search) {
      qb.andWhere('(t.name ILIKE :search OR t.slug ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!tenant) throw new NotFoundException(`租户 ${id} 不存在`);
    return tenant;
  }

  async create(dto: CreateTenantDto): Promise<TenantEntity> {
    const existing = await this.tenantRepository.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`slug "${dto.slug}" 已被使用`);

    const tenant = this.tenantRepository.create({
      name: dto.name,
      slug: dto.slug,
      aiConfig: dto.aiConfig ?? { provider: 'moonshot', model: 'kimi-k2.5', temperature: 0.7 },
      settings: dto.settings ?? {},
    });
    return this.tenantRepository.save(tenant);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantEntity> {
    const tenant = await this.findById(id);
    const updated = Object.assign({}, tenant, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.aiConfig !== undefined && { aiConfig: dto.aiConfig }),
      ...(dto.settings !== undefined && { settings: dto.settings }),
    });
    return this.tenantRepository.save(updated);
  }

  async softDelete(id: string): Promise<{ success: boolean }> {
    const tenant = await this.findById(id);
    tenant.deletedAt = new Date();
    await this.tenantRepository.save(tenant);
    return { success: true };
  }

  async getMembers(tenantId: string): Promise<TenantMemberEntity[]> {
    return this.memberRepository.find({
      where: { tenantId },
      order: { joinedAt: 'DESC' },
    });
  }

  async addMember(
    tenantId: string,
    dto: { userId: string; role: MemberRole },
  ): Promise<TenantMemberEntity> {
    const existing = await this.memberRepository.findOne({
      where: { tenantId, userId: dto.userId },
    });
    if (existing) throw new ConflictException('该用户已是租户成员');

    const member = this.memberRepository.create({
      tenantId,
      userId: dto.userId,
      role: dto.role,
    });
    return this.memberRepository.save(member);
  }

  async removeMember(tenantId: string, userId: string): Promise<{ success: boolean }> {
    const member = await this.memberRepository.findOne({ where: { tenantId, userId } });
    if (!member) throw new NotFoundException('成员不存在');
    await this.memberRepository.remove(member);
    return { success: true };
  }
}
