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

export enum CaseType {
  PROJECT = 'project',
  RESEARCH = 'research',
  INSIGHT = 'insight',
  TEMPLATE = 'template',
}

export enum CaseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * 案例实体
 * 支持向量搜索
 */
@Entity('cases')
@Index(['tenantId', 'industry'])
@Index(['tenantId', 'caseType'])
@Index(['isPublic'])
@Index(['status'])
@Index(['tenantId', 'createdAt'])
export class CaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null;

  @Column({
    type: 'enum',
    enum: CaseType,
    default: CaseType.RESEARCH,
    name: 'case_type',
  })
  caseType: CaseType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_public', default: false })
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.DRAFT,
  })
  status: CaseStatus;

  /**
   * 向量字段 - 存储为JSON字符串格式
   * 实际使用原始查询进行向量操作
   */
  @Column({ type: 'text', name: 'embedding', nullable: true })
  embedding: string | null;

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
