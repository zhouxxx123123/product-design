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
 * 洞察实体（全局洞察库，预留）
 *
 * ⚠️  当前状态：此实体对应 `insights` 表，已建表但**业务代码尚未使用**。
 *
 * 设计意图（未来）：跨会话的全局洞察库，支持按 category 聚合，供专家手动整理。
 * 与 SessionInsightEntity（session_insights）的区别：
 *   - InsightEntity      → 全局洞察，手动管理，含审核状态（pending/approved/rejected）
 *   - SessionInsightEntity → 会话专属，AI 自动生成，三层结构（layer 1/2/3）
 *
 * 当前所有 `/sessions/:id/insights` API 均操作 SessionInsightEntity，不涉及此表。
 * 如需启用全局洞察库功能，请另建独立 module（如 insight-library.module.ts）。
 */
@Entity('insights')
@Index(['sessionId', 'category'])
@Index(['category'])
@Index(['status'])
@Index(['tenantId', 'category'])
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
  metadata: Record<string, unknown>;

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
