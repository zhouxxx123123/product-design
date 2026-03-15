import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OutlineSectionDto {
  @ApiProperty({ example: 'sec-001', maxLength: 50, description: '章节 ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id: string;

  @ApiProperty({ example: '市场与竞争环境', maxLength: 200, description: '章节标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: ['您目前用哪些工具管理客户？', '最大的痛点是什么？'],
    description: '问题列表（最多 30 条）',
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(500, { each: true })
  questions: string[];

  @ApiPropertyOptional({ example: '重点关注竞品对比', maxLength: 1000, description: '访谈备注' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class GenerateOutlineDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: '调研会话 ID（UUID）',
  })
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional({
    example: '某金融科技公司，主营 B2B 支付',
    maxLength: 2000,
    description: '客户背景描述',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientBackground?: string;

  @ApiPropertyOptional({
    example: ['了解支付流程痛点', '评估对新产品的接受度'],
    description: '研究目标列表（最多 20 条）',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  researchGoals?: string[];
}

export class OptimizeOutlineDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: '调研会话 ID（UUID）',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ type: [OutlineSectionDto], description: '现有提纲章节列表（最多 50 个）' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OutlineSectionDto)
  existingOutline: OutlineSectionDto[];

  @ApiPropertyOptional({
    example: '第三章问题太宽泛，请细化',
    maxLength: 2000,
    description: '优化建议或反馈',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
