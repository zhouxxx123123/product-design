import { IsString, IsOptional, IsDateString, IsInt, Min, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSessionDto {
  @ApiPropertyOptional({ example: '用户调研访谈', description: '会话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '深入了解移动端用户需求', description: '会话描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: '客户 ID（UUID）',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: '访谈者 ID（UUID）',
  })
  @IsOptional()
  @IsUUID()
  interviewerId?: string;

  @ApiPropertyOptional({ example: '2026-03-15T14:30:00Z', description: '访谈日期时间' })
  @IsOptional()
  @IsDateString()
  interviewDate?: string | Date;

  @ApiPropertyOptional({ example: 60, description: '计划时长（分钟）', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDurationMinutes?: number;

  @ApiPropertyOptional({ example: 'zh-CN', description: '访谈语言代码' })
  @IsOptional()
  @IsString()
  language?: string;
}
