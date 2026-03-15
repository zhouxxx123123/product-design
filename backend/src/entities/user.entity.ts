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

export enum UserRole {
  ADMIN = 'admin',
  SALES = 'sales',
  EXPERT = 'expert',
}

/**
 * 用户实体
 */
@Entity('users')
@Index(['email'], { unique: true })
@Index(['tenantId'])
@Index(['wechatOpenId'], { unique: true, where: '"wechat_open_id" IS NOT NULL' })
@Index(['deletedAt'], { where: '"deleted_at" IS NULL' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'display_name' })
  displayName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.SALES,
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @Column({ type: 'text', nullable: true, name: 'refresh_token', select: false })
  refreshToken: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'wechat_open_id' })
  wechatOpenId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'wechat_union_id' })
  wechatUnionId: string | null;

  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'email_verification_token',
    select: false,
  })
  emailVerificationToken: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

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
