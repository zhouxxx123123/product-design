import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 本地重新声明，避免 Swagger plugin 生成 entity 绝对路径
export enum FeatureFlagCategory {
  SALES = 'sales',
  EXPERT = 'expert',
  AI = 'ai',
  SYSTEM = 'system',
}

/**
 * Response DTO for feature flag definition combined with tenant state
 * What the frontend receives when querying feature flags
 */
export class FeatureFlagDefinitionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: '功能开关 ID' })
  id: string;

  @ApiProperty({ example: 'crm_module', description: '功能开关 key（唯一标识）' })
  key: string;

  @ApiProperty({ example: 'CRM 模块', description: '功能开关显示名称' })
  name: string;

  @ApiPropertyOptional({ example: '客户关系管理模块', description: '功能说明' })
  description: string | null;

  @ApiProperty({
    enum: FeatureFlagCategory,
    example: FeatureFlagCategory.SALES,
    description: '所属分类',
  })
  category: FeatureFlagCategory;

  @ApiProperty({ example: 'UsersIcon', description: '图标名称（前端映射 lucide-react 图标）' })
  iconName: string;

  @ApiProperty({ example: 1, description: '展示排序（升序）' })
  sortOrder: number;

  @ApiProperty({ example: true, description: '该租户是否已开启此功能（来自 tenant_features 表）' })
  enabled: boolean;
}
