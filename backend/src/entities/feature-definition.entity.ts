import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FeatureFlagCategory {
  SALES = 'sales',
  EXPERT = 'expert',
  AI = 'ai',
  SYSTEM = 'system',
}

/**
 * Feature flag metadata definition entity
 * Stores the metadata (name, description, icon, category) for each feature flag
 */
@Index('IDX_feature_definitions_category', ['category'])
@Index('IDX_feature_definitions_active_sort', ['isActive', 'sortOrder'])
@Entity('feature_definitions')
export class FeatureDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key', type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'category',
    type: 'enum',
    enum: FeatureFlagCategory,
  })
  category: FeatureFlagCategory;

  @Column({ name: 'icon_name', type: 'varchar', length: 100 })
  iconName: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
