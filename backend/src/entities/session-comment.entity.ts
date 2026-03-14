import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity('session_comments')
@Index(['sessionId'])
export class SessionCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, name: 'target_type', nullable: true })
  targetType: string | null;

  @Column({ type: 'varchar', length: 100, name: 'target_id', nullable: true })
  targetId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}
