import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  SHARE = 'share',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
}

/**
 * 审计日志实体
 * append-only表，不包含updated_at和deleted_at
 */
@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['action'])
@Index(['entityType', 'entityId'])
@Index(['userId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true, name: 'old_values' })
  oldValues: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'request_id' })
  requestId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
