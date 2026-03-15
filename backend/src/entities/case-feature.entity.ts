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

export enum FeatureCategory {
  PAIN_POINT = 'pain_point',
  NEED = 'need',
  SOLUTION = 'solution',
  RESULT = 'result',
  LESSON = 'lesson',
  QUOTE = 'quote',
  DATA = 'data',
}

/**
 * 案例要素实体
 * 案例的关键要素提取，支持要素级向量搜索
 */
@Entity('case_features')
@Index(['caseId', 'category'])
@Index(['category'])
export class CaseFeatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @Column({
    type: 'enum',
    enum: FeatureCategory,
    default: FeatureCategory.PAIN_POINT,
  })
  category: FeatureCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Array<{
    type: 'quote' | 'data' | 'reference';
    content: string;
    source?: string;
  }> | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, name: 'importance_score', nullable: true })
  importanceScore: number | null;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  /**
   * 向量字段
   */
  @Column({ type: 'text', name: 'embedding', nullable: true })
  embedding: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

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
