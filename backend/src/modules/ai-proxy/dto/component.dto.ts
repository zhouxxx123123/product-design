import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';

export class GenerateComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
