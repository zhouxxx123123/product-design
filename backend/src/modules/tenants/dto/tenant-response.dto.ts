import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiConfigResponseDto {
  @ApiProperty({ example: 'moonshot', description: 'AI 服务提供商' })
  provider: string;

  @ApiProperty({ example: 'kimi-k2.5', description: '模型名称' })
  model: string;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 2, description: '生成温度' })
  temperature: number;

  @ApiPropertyOptional({ example: 0.9, minimum: 0, maximum: 1, description: 'Top-P 采样参数' })
  topP?: number;

  @ApiPropertyOptional({ example: 2000, minimum: 1, description: '最大生成 token 数' })
  maxTokens?: number;
}

export class TenantResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: '租户 ID' })
  id: string;

  @ApiProperty({ example: '中科琉光科技', description: '租户名称' })
  name: string;

  @ApiProperty({ example: 'zhongke-liuguang', description: '租户 slug（唯一标识）' })
  slug: string;

  @ApiProperty({ type: () => AiConfigResponseDto, description: 'AI 服务配置' })
  aiConfig: AiConfigResponseDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { theme: 'dark', locale: 'zh-CN' },
    description: '租户自定义设置（jsonb）',
  })
  settings: Record<string, unknown>;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', description: '创建时间' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-15T12:00:00.000Z', description: '最后更新时间' })
  updatedAt: string;
}
