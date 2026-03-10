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

export enum TranscriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TranscriptionEngine {
  TENCENT = 'tencent',
  WHISPER = 'whisper',
  CUSTOM = 'custom',
}

/**
 * 转录实体
 * ASR语音识别结果存储
 */
@Entity('transcriptions')
@Index(['session_id'])
@Index(['status'])
@Index(['session_id', 'status'])
export class TranscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'recording_id', nullable: true })
  recordingId: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  segments: Array<{
    startTime: number;
    endTime: number;
    text: string;
    confidence?: number;
  }> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'speaker_labels' })
  speakerLabels: Array<{
    speaker: string;
    segments: number[];
  }> | null;

  @Column({
    type: 'enum',
    enum: TranscriptionStatus,
    default: TranscriptionStatus.PENDING,
  })
  status: TranscriptionStatus;

  @Column({
    type: 'enum',
    enum: TranscriptionEngine,
    default: TranscriptionEngine.TENCENT,
  })
  engine: TranscriptionEngine;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'confidence_score', nullable: true })
  confidenceScore: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  @Column({ type: 'text', nullable: true, name: 'raw_response' })
  rawResponse: string | null;

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
