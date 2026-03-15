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

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

/**
 * 访谈会话实体
 * 核心业务表，包含三层信息模型
 */
@Entity('interview_sessions')
@Index(['tenantId', 'interviewDate'])
@Index(['clientId'])
@Index(['interviewerId'])
@Index(['status'])
@Index(['tenantId', 'status', 'interviewDate'])
export class InterviewSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'client_id', nullable: true })
  clientId: string | null;

  @Column({ type: 'uuid', name: 'interviewer_id', nullable: true })
  interviewerId: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: InterviewStatus, default: InterviewStatus.SCHEDULED })
  status: InterviewStatus;

  @Column({ type: 'timestamptz', name: 'interview_date' })
  interviewDate: Date;

  @Column({ type: 'integer', name: 'planned_duration_minutes', nullable: true })
  plannedDurationMinutes: number | null;

  @Column({ type: 'text', name: 'raw_transcript', nullable: true })
  rawTranscript: string | null;

  @Column({ type: 'jsonb', name: 'structured_summary', nullable: true })
  structuredSummary: {
    sections?: Array<{
      title: string;
      content: string;
      timestamp?: string;
    }>;
    keyPoints?: string[];
    topics?: string[];
  } | null;

  @Column({ type: 'jsonb', name: 'executive_summary', nullable: true })
  executiveSummary: {
    overview?: string;
    keyFindings?: Array<{
      finding: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    recommendations?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  } | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string | null;

  @Column({ type: 'uuid', name: 'template_id', nullable: true })
  templateId: string | null;

  @Column({ type: 'uuid', name: 'recording_file_id', nullable: true })
  recordingFileId: string | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

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
