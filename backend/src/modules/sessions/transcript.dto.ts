import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: '我们主要做跨境支付', description: '转写文本内容' })
  @IsString()
  @IsNotEmpty({ message: 'text 字段不能为空' })
  text: string;

  @ApiPropertyOptional({ example: 0, description: '片段开始时间（毫秒）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startMs?: number;

  @ApiPropertyOptional({ example: 5000, description: '片段结束时间（毫秒）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endMs?: number;

  @ApiPropertyOptional({ example: 'interviewer', description: '说话人标识' })
  @IsOptional()
  @IsString()
  speaker?: string;
}

export class TranscriptSegmentItemDto {
  @ApiProperty({ example: '监管要求不断变化' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startMs?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endMs?: number;

  @ApiPropertyOptional({ example: 'interviewee' })
  @IsOptional()
  @IsString()
  speaker?: string;
}

export class BulkCreateTranscriptSegmentDto {
  @ApiProperty({ type: [TranscriptSegmentItemDto], description: '批量转写片段列表' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentItemDto)
  segments: TranscriptSegmentItemDto[];
}
