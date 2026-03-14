import { IsString, IsNotEmpty, IsOptional, Matches, IsObject } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: '租户名称不能为空' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'slug 不能为空' })
  @Matches(/^[a-z0-9-]+$/, { message: 'slug 只能包含小写字母、数字和连字符' })
  slug: string;

  @IsOptional()
  @IsObject()
  aiConfig?: {
    provider: string;
    model: string;
    temperature: number;
    topP?: number;
    maxTokens?: number;
  };

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
