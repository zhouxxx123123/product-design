import { IsString, IsOptional, IsInt, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDictionaryNodeDto {
  @ApiProperty({ example: '金融科技', description: '节点名称' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'fintech', description: '节点编码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent', description: '父节点ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: '金融科技行业', description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1, description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateDictionaryNodeDto {
  @ApiPropertyOptional({ example: '金融科技', description: '节点名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'fintech', description: '节点编码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '金融科技行业', description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1, description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
