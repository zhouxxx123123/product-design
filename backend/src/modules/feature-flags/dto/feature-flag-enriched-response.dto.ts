import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeatureFlagCategory } from './feature-flag-response.dto';

export class FeatureFlagEnrichedResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: '功能开关 ID' })
  id: string;

  @ApiProperty({ example: 'crm_module', description: '功能开关 key' })
  key: string;

  @ApiProperty({ example: 'CRM 模块', description: '显示名称' })
  name: string;

  @ApiPropertyOptional({ example: '客户关系管理模块', description: '功能说明' })
  description: string | null;

  @ApiProperty({
    enum: FeatureFlagCategory,
    example: FeatureFlagCategory.SALES,
    description: '所属分类',
  })
  category: FeatureFlagCategory;

  @ApiProperty({ example: 'UsersIcon', description: '图标名称' })
  iconName: string;

  @ApiProperty({ example: 1, description: '展示排序' })
  sortOrder: number;

  @ApiProperty({ example: true, description: '是否已开启' })
  enabled: boolean;
}
