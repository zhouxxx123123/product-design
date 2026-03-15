import { IsString, IsOptional, IsEmail, IsEnum, IsBoolean, MinLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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

  @ApiPropertyOptional({ example: '张三', description: '显示名称' })
  @IsOptional()
  @IsString()
  displayName?: string;

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