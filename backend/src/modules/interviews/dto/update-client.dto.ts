import { IsString, IsOptional, IsArray, ValidateNested, IsIn, ArrayMaxSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ContactDto } from './create-client.dto';

export class UpdateClientDto {
  @ApiPropertyOptional({ description: '公司名称', example: '某金融科技有限公司' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: '行业', example: '金融科技' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: '公司规模', example: '100-500人' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ description: '联系人列表', type: [ContactDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: '每个客户最多只能有2个联系人' })
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @ApiPropertyOptional({ description: '标签', type: [String], example: ['重点客户', 'AI意向'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '备注', example: '客户对 AI 辅助调研非常感兴趣' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: '状态',
    enum: ['active', 'potential', 'churned'],
    default: 'potential',
  })
  @IsOptional()
  @IsIn(['active', 'potential', 'churned'])
  status?: string;
}
