export class ContactResponseDto {
  name: string;
  title?: string;
  phone?: string;
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
}

export class ClientResponseDto {
  id: string;
  companyName: string;
  industry?: string;
  size?: string;
  contacts: ContactResponseDto[];
  tags?: string[];
  status: string;
  notes?: string;
  lastInteraction?: string;
  createdAt: string;
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
    // Build contacts array from individual fields
    dto.contacts = [];
    const hasContactInfo = Boolean(entity.name ?? entity.phone ?? entity.email ?? entity.position);
    if (hasContactInfo) {
      dto.contacts.push({
        name: entity.name ?? '',
        title: entity.position ?? undefined,
        phone: entity.phone ?? undefined,
        email: entity.email ?? undefined,
      });
    }
    return dto;
  }
}
