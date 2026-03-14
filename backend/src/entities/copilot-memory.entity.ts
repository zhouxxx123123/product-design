import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

export enum MemoryType {
  PREFERENCE = 'preference',
  LEARNING = 'learning',
  CONVERSATION = 'conversation',
  SETTING = 'setting',
}

@Entity('copilot_memories')
@Index(['userId', 'tenantId'])
export class CopilotMemoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MemoryType,
    default: MemoryType.CONVERSATION,
  })
  type: MemoryType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  source: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}
