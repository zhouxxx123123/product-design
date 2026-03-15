import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsBoolean,
  MinLength,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserEntity } from '../../../entities/user.entity';

// 本地重新声明，避免 Swagger plugin 生成 entity 绝对路径
export enum UserRole {
  ADMIN = 'admin',
  SALES = 'sales',
  EXPERT = 'expert',
}

export class CreateUserDto {
  @ApiProperty({ example: 'user@company.com', description: '用户邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '张三', maxLength: 100, description: '显示名称（必填）' })
  @IsNotEmpty({ message: '显示名称不能为空' })
  @IsString()
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ example: 'P@ssword123', description: '密码（至少8位）' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.SALES, description: '角色' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '李四', description: '显示名称' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'NewP@ss123', description: '新密码（至少8位）' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.SALES, description: '角色' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: true, description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UserListQueryDto {
  @ApiPropertyOptional({ example: 1, description: '页码', minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: '每页数量', minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: '张三', description: '搜索关键词（显示名称或邮箱）' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 用户响应DTO - 仅包含安全的公开字段
 */
export class UserResponseDto {
  @ApiProperty({ example: 'uuid-12345', description: '用户ID' })
  id: string;

  @ApiProperty({ example: 'user@company.com', description: '用户邮箱' })
  email: string;

  @ApiProperty({ example: '张三', description: '显示名称', nullable: true })
  displayName: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.SALES, description: '角色' })
  role: UserRole;

  @ApiProperty({ example: 'uuid-67890', description: '租户ID', nullable: true })
  tenantId: string | null;

  @ApiProperty({ example: true, description: '是否激活' })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: '创建时间' })
  createdAt: Date;

  /**
   * 从 UserEntity 创建 UserResponseDto
   */
  static fromEntity(entity: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.displayName = entity.displayName ?? null;
    dto.role = entity.role;
    dto.tenantId = entity.tenantId ?? null;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.SALES, description: '新角色' })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
