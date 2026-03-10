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

export enum TemplateType {
  INTERVIEW = 'interview',
  QUESTIONNAIRE = 'questionnaire',
  OUTLINE = 'outline',
  REPORT = 'report',
}

export enum TemplateScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  PERSONAL = 'personal',
}

/**
 * 模板实体
 * 访谈模板、问卷模板、报告模板等
 */
@Entity('templates')
@Index(['tenant_id', 'template_type'])
@Index(['scope'])
@Index(['is_active'])
export class TemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({
    type: 'enum',
    enum: TemplateType,
    default: TemplateType.INTERVIEW,
  })
  templateType: TemplateType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  content: {
    departments?: Array<{
      name: string;
      code?: string;
      description?: string;
      questions?: Array<{
        content: string;
        type: string;
        options?: any[];
        hint?: string;
        isRequired?: boolean;
      }>;
    }>;
    settings?: Record<string, any>;
    styles?: Record<string, any>;
  };

  @Column({
    type: 'enum',
    enum: TemplateScope,
    default: TemplateScope.TENANT,
  })
  scope: TemplateScope;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', default: {} })
  variables: Record<string, {
    type: string;
    required: boolean;
    default?: any;
    description?: string;
  }>;

  @Column({ type: 'integer', name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

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
