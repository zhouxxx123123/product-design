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

export enum InsightCategory {
  PAIN_POINT = 'pain_point',
  NEED = 'need',
  OPPORTUNITY = 'opportunity',
  RISK = 'risk',
  SUGGESTION = 'suggestion',
  INSIGHT = 'insight',
}

export enum InsightStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/**
 * 洞察实体
 * AI生成的访谈洞察
 */
@Entity('insights')
@Index(['session_id', 'category'])
@Index(['category'])
@Index(['status'])
@Index(['tenant_id', 'category'])
export class InsightEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({
    type: 'enum',
    enum: InsightCategory,
    default: InsightCategory.INSIGHT,
  })
  category: InsightCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Array<{
    transcriptSegment: string;
    timestamp: string;
    confidence: number;
  }> | null;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'confidence_score', nullable: true })
  confidenceScore: number | null;

  @Column({
    type: 'enum',
    enum: InsightStatus,
    default: InsightStatus.PENDING,
  })
  status: InsightStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

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
