import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@company.com', description: '用户邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword123', minLength: 8, description: '密码（至少 8 位）' })
  @IsString()
  @MinLength(8, { message: '密码至少需要 8 个字符' })
  @MaxLength(100)
  password: string;

  @ApiProperty({
    example: '中科琉光科技',
    maxLength: 100,
    description: '公司名称（将作为租户名称）',
  })
  @IsString()
  @IsNotEmpty({ message: '公司名称不能为空' })
  @MaxLength(100)
  companyName: string;

  @ApiPropertyOptional({ example: '张三', maxLength: 100, description: '显示名称（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
