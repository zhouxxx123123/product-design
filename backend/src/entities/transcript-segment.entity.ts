import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity('transcript_segments')
@Index(['sessionId'])
export class TranscriptSegmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'integer', name: 'start_ms', nullable: true })
  startMs: number | null;

  @Column({ type: 'integer', name: 'end_ms', nullable: true })
  endMs: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  speaker: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}
