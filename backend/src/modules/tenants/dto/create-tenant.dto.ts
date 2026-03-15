import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsObject,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiConfigDto {
  @ApiProperty({ example: 'moonshot', description: 'AI 服务提供商' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ example: 'kimi-k2.5', description: '模型名称' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 2, description: '生成温度' })
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature: number;

  @ApiPropertyOptional({ example: 0.9, minimum: 0, maximum: 1, description: 'Top-P 采样参数' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiPropertyOptional({ example: 2000, minimum: 1, description: '最大生成 token 数' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;
}

export class CreateTenantDto {
  @ApiProperty({ example: '中科琉光科技', description: '租户名称' })
  @IsString()
  @IsNotEmpty({ message: '租户名称不能为空' })
  name: string;

  @ApiProperty({
    example: 'zhongke-liuguang',
    description: '租户 slug（唯一标识，仅小写字母、数字和连字符）',
  })
  @IsString()
  @IsNotEmpty({ message: 'slug 不能为空' })
  @Matches(/^[a-z0-9-]+$/, { message: 'slug 只能包含小写字母、数字和连字符' })
  slug: string;

  @ApiPropertyOptional({
    type: () => AiConfigDto,
    description: 'AI 配置（provider, model, temperature 等）',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { theme: 'dark', locale: 'zh-CN' },
    description: '租户自定义设置（jsonb）',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
