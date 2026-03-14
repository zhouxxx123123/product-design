import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_features')
export class TenantFeatureEntity {
  @PrimaryColumn({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
