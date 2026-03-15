import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiConfigDto } from './create-tenant.dto';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: '中科琉光科技', description: '租户名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: () => AiConfigDto, description: 'AI 配置（可部分更新）' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { theme: 'dark' },
    description: '租户自定义设置',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
