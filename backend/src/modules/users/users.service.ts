import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
  UserRole,
  UserResponseDto,
} from './dto/user.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../entities/audit-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return UserResponseDto.fromEntity(user);
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
      data: data.map(UserResponseDto.fromEntity),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      tenantId,
      role: dto.role ?? UserRole.SALES,
    });
    const saved = await this.userRepository.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateUserDto,
    callerRole: UserRole,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    // Only admins can change user roles
    if (dto.role !== undefined && callerRole !== UserRole.ADMIN) {
      throw new ForbiddenException('只有管理员可以修改用户角色');
    }

    if (dto.password) {
      dto = { ...dto, password: await bcrypt.hash(dto.password, 10) };
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);
    return UserResponseDto.fromEntity(saved);
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

  async changeRole(
    id: string,
    tenantId: string,
    newRole: UserRole,
    callerId: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const fromRole = user.role;
    const updatedUser = Object.assign({}, user, { role: newRole });

    // Save the updated user and get the result
    const saveResult = await this.userRepository.save(updatedUser);
    const saved = Array.isArray(saveResult) ? saveResult[0] : saveResult;

    // Create audit log entry
    await this.auditLogsService.create({
      action: AuditAction.UPDATE,
      entityType: 'user',
      entityId: id,
      tenantId,
      userId: callerId,
      newValues: { roleChange: { from: fromRole, to: newRole } },
      notes: 'USER_ROLE_CHANGED',
    });

    return UserResponseDto.fromEntity(saved);
  }
}
