import { IsEnum, IsString, IsBoolean, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsUUID()
  id: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(FeatureFlagCategory)
  category: FeatureFlagCategory;

  @IsString()
  iconName: string;

  @IsNumber()
  sortOrder: number;

  @IsBoolean()
  enabled: boolean; // Tenant-specific state from tenant_features table
}
