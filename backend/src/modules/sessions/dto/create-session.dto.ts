import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({
    example: 'Product Research Interview',
    description: 'Session title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Deep dive into user needs for mobile app features',
    description: 'Optional session description',
    required: false,
  })
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

  @ApiProperty({
    example: '2026-03-15T14:30:00Z',
    description: 'Scheduled interview date and time',
  })
  @IsDateString()
  interviewDate: string | Date;

  @ApiProperty({
    example: 60,
    description: 'Planned duration in minutes',
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDurationMinutes?: number;

  @ApiPropertyOptional({
    example: 'zh-CN',
    description: 'Interview language code',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Template ID to use for this session',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
