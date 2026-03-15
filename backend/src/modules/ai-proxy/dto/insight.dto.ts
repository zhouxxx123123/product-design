import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InsightProxyDto {
  @ApiProperty({
    example: '访谈者：请问您目前最大的痛点是什么？\n受访者：流程太繁琐...',
    minLength: 1,
    maxLength: 32_000,
    description: '访谈转录文本（最长 32000 字符）',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32_000)
  transcript: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: '关联的访谈会话 ID（可选，用于追踪）',
  })
  @IsOptional()
  @IsString()
  interviewId?: string;

  @ApiProperty({ example: true, default: true, description: '是否提取主题归纳（Layer 2）' })
  @IsOptional()
  @IsBoolean()
  extractThemes?: boolean = true;

  @ApiProperty({ example: true, default: true, description: '是否提取关键引用（Layer 1）' })
  @IsOptional()
  @IsBoolean()
  extractQuotes?: boolean = true;

  @ApiProperty({ example: true, default: true, description: '是否进行情感分析（Layer 3）' })
  @IsOptional()
  @IsBoolean()
  extractSentiment?: boolean = true;
}
