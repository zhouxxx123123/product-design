import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  @IsNotEmpty({ message: 'text 字段不能为空' })
  text: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endMs?: number;

  @IsOptional()
  @IsString()
  speaker?: string;
}

export class TranscriptSegmentItemDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endMs?: number;

  @IsOptional()
  @IsString()
  speaker?: string;
}

export class BulkCreateTranscriptSegmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentItemDto)
  segments: TranscriptSegmentItemDto[];
}
