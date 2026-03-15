import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * 角色权限关联实体
 * 定义角色与权限的多对多关系
 */
@Entity('role_permissions')
@Index(['role', 'permissionCode'], { unique: true })
@Index(['role'])
export class RolePermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  role: string;

  @Column({ type: 'varchar', length: 100, name: 'permission_code' })
  permissionCode: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
