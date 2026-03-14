import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity('report_jobs')
@Index(['sessionId'])
@Index(['tenantId'])
export class ReportJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId: string;
  @Column({ type: 'uuid', name: 'session_id' }) sessionId: string;

  @Column({
    type: 'enum',
    enum: ReportJobStatus,
    enumName: 'report_job_status',
    default: ReportJobStatus.PENDING,
  })
  status: ReportJobStatus;

  @Column({ type: 'varchar', length: 20 }) format: string;

  @Column({ type: 'text', nullable: true, name: 'file_path' })
  filePath: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt: Date;
}
