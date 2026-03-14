import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

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
