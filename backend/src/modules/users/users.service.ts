import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import { CreateUserDto, UpdateUserDto, UserListQueryDto, UserRole } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findAll(tenantId: string, query: UserListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('u.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere('(u.displayName ILIKE :search OR u.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await qb
      .orderBy('u.createdAt', 'DESC')
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

  async create(tenantId: string, dto: CreateUserDto): Promise<UserEntity> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      tenantId,
      role: dto.role ?? UserRole.SALES,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (dto.password) {
      dto = { ...dto, password: await bcrypt.hash(dto.password, 10) };
    }

    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async softDelete(id: string, tenantId: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    user.deletedAt = new Date();
    await this.userRepository.save(user);
    return { success: true };
  }
}
