import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity('session_case_links')
@Index(['sessionId'])
export class SessionCaseLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', name: 'added_by' })
  addedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}
