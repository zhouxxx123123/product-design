import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty({ example: '张三', description: '联系人姓名' })
  name: string;

  @ApiPropertyOptional({ example: '采购总监', description: '职位' })
  title?: string;

  @ApiPropertyOptional({ example: '138-0000-0000', description: '手机号' })
  phone?: string;

  @ApiPropertyOptional({ example: 'zhang@company.com', description: '邮箱' })
  email?: string;
}

interface ClientEntity {
  id: string;
  company?: string | null;
  name?: string | null;
  industry?: string | null;
  size?: string | null;
  status?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  lastInterviewAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  contacts?: Array<{
    name: string;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
    sortOrder?: number;
  }>;
}

export class ClientResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: '客户 ID' })
  id: string;

  @ApiProperty({ example: '中科琉光科技有限公司', description: '公司名称' })
  companyName: string;

  @ApiPropertyOptional({ example: '金融科技', description: '所属行业' })
  industry?: string;

  @ApiPropertyOptional({ example: '500-1000人', description: '公司规模' })
  size?: string;

  @ApiProperty({ type: [ContactResponseDto], description: '联系人列表' })
  contacts: ContactResponseDto[];

  @ApiPropertyOptional({ example: ['重点客户', '已签约'], description: '标签' })
  tags?: string[];

  @ApiProperty({ example: 'potential', description: '客户状态（potential / active / churned）' })
  status: string;

  @ApiPropertyOptional({ example: '首次接触于 Q1 展会', description: '备注' })
  notes?: string;

  @ApiPropertyOptional({ example: '2026-03-01T09:00:00.000Z', description: '最近一次交互时间' })
  lastInteraction?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', description: '创建时间' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-15T08:00:00.000Z', description: '更新时间' })
  updatedAt: string;

  static fromEntity(entity: ClientEntity): ClientResponseDto {
    const dto = new ClientResponseDto();
    dto.id = entity.id;
    dto.companyName = entity.company ?? entity.name ?? '';
    dto.industry = entity.industry ?? undefined;
    dto.size = entity.size ?? undefined;
    dto.status = entity.status ?? 'potential';
    dto.tags = entity.tags ?? undefined;
    dto.notes = entity.notes ?? undefined;
    dto.lastInteraction = entity.lastInterviewAt
      ? new Date(entity.lastInterviewAt).toISOString()
      : undefined;
    dto.createdAt = entity.createdAt
      ? new Date(entity.createdAt).toISOString()
      : new Date().toISOString();
    dto.updatedAt = entity.updatedAt
      ? new Date(entity.updatedAt).toISOString()
      : new Date().toISOString();

    // Build contacts array from contacts relationship or fallback to individual fields
    dto.contacts = [];
    if (entity.contacts && entity.contacts.length > 0) {
      // Use contacts relationship if available
      dto.contacts = entity.contacts
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((contact) => ({
          name: contact.name,
          title: contact.position ?? undefined,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
        }));
    } else {
      // Fallback to individual fields for backwards compatibility
      const hasContactInfo = Boolean(
        entity.name ?? entity.phone ?? entity.email ?? entity.position,
      );
      if (hasContactInfo) {
        dto.contacts.push({
          name: entity.name ?? '',
          title: entity.position ?? undefined,
          phone: entity.phone ?? undefined,
          email: entity.email ?? undefined,
        });
      }
    }

    return dto;
  }
}
