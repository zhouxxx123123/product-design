import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// 本地重新声明 enum，避免 Swagger plugin 把 entity 绝对路径写入编译产物
export enum TemplateType {
  INTERVIEW = 'interview',
  QUESTIONNAIRE = 'questionnaire',
  OUTLINE = 'outline',
  REPORT = 'report',
}

export enum TemplateScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  PERSONAL = 'personal',
}

export class CreateTemplateDto {
  @ApiProperty({
    example: '销售拜访模板',
    description: 'Template title (mapped to name in entity)',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'TMPL001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ enum: TemplateType, example: TemplateType.INTERVIEW })
  @IsOptional()
  @IsEnum(TemplateType)
  templateType?: TemplateType;

  @ApiPropertyOptional({ example: 'Interview template for user research' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'sales', description: '模板分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 60, description: '计划访谈时长（分钟）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiProperty({
    example: { sections: [] },
    description: 'Template content structure (required; use {} for empty template)',
  })
  @IsNotEmpty({ message: 'content 不能为空，请传入 {} 或有效内容结构' })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  content: Record<string, unknown>;

  @ApiPropertyOptional({ enum: TemplateScope, example: TemplateScope.TENANT })
  @IsOptional()
  @IsEnum(TemplateScope)
  scope?: TemplateScope;

  @ApiPropertyOptional({ example: ['interview', 'sales'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ example: { category: 'sales' } })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, unknown>;

  // 向后兼容：同时接受 name（entity 字段名）
  @ApiPropertyOptional({ description: 'Legacy: use title instead' })
  @IsOptional()
  @IsString()
  name?: string;
}
