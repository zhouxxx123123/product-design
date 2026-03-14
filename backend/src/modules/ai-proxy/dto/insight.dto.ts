import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InsightProxyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32_000)
  transcript: string;

  @IsOptional()
  @IsString()
  interview_id?: string;

  @IsOptional()
  @IsBoolean()
  extract_themes?: boolean;

  @IsOptional()
  @IsBoolean()
  extract_quotes?: boolean;

  @IsOptional()
  @IsBoolean()
  extract_sentiment?: boolean;
}
