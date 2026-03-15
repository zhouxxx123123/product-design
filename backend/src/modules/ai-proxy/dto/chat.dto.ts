import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ description: '消息角色', enum: ['system', 'user', 'assistant'] })
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({ description: '消息内容', example: '请帮我分析这段访谈内容', maxLength: 32768 })
  @IsString()
  @MaxLength(32768)
  content: string;
}

export class ChatDto {
  @ApiProperty({ description: '对话消息列表', type: [ChatMessageDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({
    description: '使用的模型',
    enum: ['moonshot-v1-8k', 'kimi-k2.5', 'moonshot-v1-32k'],
    default: 'kimi-k2.5',
  })
  @IsOptional()
  @IsString()
  @IsIn(['moonshot-v1-8k', 'kimi-k2.5', 'moonshot-v1-32k'])
  model?: string;

  @ApiPropertyOptional({ description: '温度参数', minimum: 0, maximum: 2, default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: '最大生成 token 数',
    minimum: 1,
    maximum: 32768,
    default: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32768)
  maxTokens?: number;

  @ApiPropertyOptional({ description: '关联的调研会话 ID（可选，用于日志追踪）', example: '550e...' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
