import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

export enum RecordingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RecordingSource {
  WEB = 'web',
  MOBILE = 'mobile',
  IMPORT = 'import',
  API = 'api',
}

/**
 * 录音实体
 */
@Entity('recordings')
@Index(['session_id', 'created_at'])
@Index(['status'])
export class RecordingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', length: 500, name: 'storage_path' })
  storagePath: string;

  @Column({ type: 'varchar', length: 50 })
  format: string;

  @Column({ type: 'integer', name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'bigint', name: 'file_size_bytes' })
  fileSizeBytes: number;

  @Column({
    type: 'enum',
    enum: RecordingStatus,
    default: RecordingStatus.PENDING,
  })
  status: RecordingStatus;

  @Column({
    type: 'enum',
    enum: RecordingSource,
    default: RecordingSource.WEB,
  })
  source: RecordingSource;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'recorded_by' })
  recordedBy: string | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}
