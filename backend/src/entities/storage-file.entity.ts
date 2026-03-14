import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('storage_files')
@Index(['tenantId'])
export class StorageFileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'file_id', unique: true })
  fileId: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 500 })
  originalname: string;

  @Column({ type: 'varchar', length: 127 })
  mimetype: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'uuid', name: 'uploader_id', nullable: true })
  uploaderId: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', name: 'is_expired', default: false })
  isExpired: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
