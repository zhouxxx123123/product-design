import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 本地重新声明，避免 Swagger plugin 生成 entity 绝对路径
export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export class AddMemberDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: MemberRole, example: MemberRole.MEMBER })
  @IsEnum(MemberRole)
  role: MemberRole;
}
