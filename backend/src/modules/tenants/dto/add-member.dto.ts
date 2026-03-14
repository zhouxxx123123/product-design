import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { MemberRole } from '../../../entities/tenant-member.entity';

export class AddMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(MemberRole)
  role: MemberRole;
}
