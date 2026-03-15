import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '../../../entities/tenant-member.entity';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: MemberRole,
    example: MemberRole.ADMIN,
    description: '新的成员角色',
  })
  @IsEnum(MemberRole)
  @IsNotEmpty()
  role: MemberRole;
}
