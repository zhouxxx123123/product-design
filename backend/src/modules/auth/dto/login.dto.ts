import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin@openclaw.io',
    description: 'User email address'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'OpenClaw2026!',
    minLength: 6,
    description: 'User password (minimum 6 characters)'
  })
  @IsString()
  @MinLength(6)
  password: string;
}
