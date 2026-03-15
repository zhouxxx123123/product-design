import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateComponentDto {
  @ApiProperty({
    description: '组件描述',
    example: '生成一个展示客户痛点的饼图组件',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({
    description: '附加上下文（如历史数据、当前会话信息）',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
