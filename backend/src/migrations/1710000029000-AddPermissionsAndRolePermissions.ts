import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionsAndRolePermissions1710000029000 implements MigrationInterface {
  name = 'AddPermissionsAndRolePermissions1710000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "code"        VARCHAR(100) NOT NULL UNIQUE,
        "name"        VARCHAR(100) NOT NULL,
        "description" TEXT,
        "category"    VARCHAR(50)  NOT NULL,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_code" UNIQUE ("code")
      )
    `);

    // Create role_permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
        "role"            VARCHAR(20)  NOT NULL,
        "permission_code" VARCHAR(100) NOT NULL,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_permissions_role_permission" UNIQUE ("role", "permission_code"),
        CONSTRAINT "FK_role_permissions_permission_code"
          FOREIGN KEY ("permission_code") REFERENCES "permissions" ("code") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_permissions_category"
        ON "permissions" ("category")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_permissions_role"
        ON "role_permissions" ("role")
    `);

    // Insert 30 permission seed data
    await queryRunner.query(`
      INSERT INTO "permissions" ("code", "name", "description", "category") VALUES
        -- users category
        ('users.read', '查看用户', '查看用户列表和详细信息', 'users'),
        ('users.create', '创建用户', '创建新用户账号', 'users'),
        ('users.update', '更新用户', '更新用户信息', 'users'),
        ('users.delete', '删除用户', '删除用户账号', 'users'),
        ('users.change_role', '修改用户角色', '变更用户的系统角色', 'users'),

        -- clients category
        ('clients.read', '查看客户', '查看客户列表和详细信息', 'clients'),
        ('clients.create', '创建客户', '添加新客户档案', 'clients'),
        ('clients.update', '更新客户', '更新客户信息', 'clients'),
        ('clients.delete', '删除客户', '删除客户档案', 'clients'),
        ('clients.export', '导出客户', '导出客户数据', 'clients'),

        -- sessions category
        ('sessions.read', '查看访谈', '查看访谈会话列表和详情', 'sessions'),
        ('sessions.create', '创建访谈', '发起新的访谈会话', 'sessions'),
        ('sessions.update', '更新访谈', '更新访谈会话信息', 'sessions'),
        ('sessions.delete', '删除访谈', '删除访谈会话', 'sessions'),

        -- templates category
        ('templates.read', '查看模板', '查看访谈模板', 'templates'),
        ('templates.create', '创建模板', '创建新的访谈模板', 'templates'),
        ('templates.update', '更新模板', '更新访谈模板', 'templates'),
        ('templates.delete', '删除模板', '删除访谈模板', 'templates'),

        -- cases category
        ('cases.read', '查看案例', '查看案例库内容', 'cases'),
        ('cases.create', '创建案例', '添加新案例', 'cases'),
        ('cases.update', '更新案例', '更新案例信息', 'cases'),
        ('cases.delete', '删除案例', '删除案例', 'cases'),

        -- admin category
        ('admin.users', '用户管理', '管理系统用户', 'admin'),
        ('admin.dictionary', '字典管理', '管理系统字典数据', 'admin'),
        ('admin.feature_flags', '功能开关管理', '管理系统功能开关', 'admin'),
        ('admin.tenants', '租户管理', '管理系统租户', 'admin'),
        ('admin.audit_logs', '审计日志管理', '查看系统审计日志', 'admin')
    `);

    // Insert role-permission mappings

    // Admin: ALL 30 permissions
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "permission_code") VALUES
        ('admin', 'users.read'),
        ('admin', 'users.create'),
        ('admin', 'users.update'),
        ('admin', 'users.delete'),
        ('admin', 'users.change_role'),
        ('admin', 'clients.read'),
        ('admin', 'clients.create'),
        ('admin', 'clients.update'),
        ('admin', 'clients.delete'),
        ('admin', 'clients.export'),
        ('admin', 'sessions.read'),
        ('admin', 'sessions.create'),
        ('admin', 'sessions.update'),
        ('admin', 'sessions.delete'),
        ('admin', 'templates.read'),
        ('admin', 'templates.create'),
        ('admin', 'templates.update'),
        ('admin', 'templates.delete'),
        ('admin', 'cases.read'),
        ('admin', 'cases.create'),
        ('admin', 'cases.update'),
        ('admin', 'cases.delete'),
        ('admin', 'admin.users'),
        ('admin', 'admin.dictionary'),
        ('admin', 'admin.feature_flags'),
        ('admin', 'admin.tenants'),
        ('admin', 'admin.audit_logs')
    `);

    // Expert: users.read + clients.read + sessions.* + templates.read + cases.* + some admin
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "permission_code") VALUES
        ('expert', 'users.read'),
        ('expert', 'clients.read'),
        ('expert', 'sessions.read'),
        ('expert', 'sessions.create'),
        ('expert', 'sessions.update'),
        ('expert', 'templates.read'),
        ('expert', 'cases.read'),
        ('expert', 'cases.create'),
        ('expert', 'cases.update'),
        ('expert', 'admin.users'),
        ('expert', 'admin.dictionary')
    `);

    // Sales: clients.* + sessions.* + templates.read + cases.read
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "permission_code") VALUES
        ('sales', 'clients.read'),
        ('sales', 'clients.create'),
        ('sales', 'clients.update'),
        ('sales', 'clients.delete'),
        ('sales', 'clients.export'),
        ('sales', 'sessions.read'),
        ('sales', 'sessions.create'),
        ('sales', 'sessions.update'),
        ('sales', 'templates.read'),
        ('sales', 'cases.read')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_permissions_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_category"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
