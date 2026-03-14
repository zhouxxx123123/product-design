import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogs1710000019000 implements MigrationInterface {
  name = 'AddAuditLogs1710000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_action_enum" AS ENUM (
          'create', 'read', 'update', 'delete',
          'login', 'logout', 'export', 'import',
          'share', 'archive', 'restore'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"    UUID         NOT NULL,
        "user_id"      UUID,
        "action"       "audit_action_enum" NOT NULL,
        "entity_type"  VARCHAR(50)  NOT NULL,
        "entity_id"    UUID         NOT NULL,
        "old_values"   JSONB,
        "new_values"   JSONB,
        "ip_address"   INET,
        "user_agent"   VARCHAR(500),
        "request_id"   VARCHAR(50),
        "notes"        TEXT,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_created"
        ON "audit_logs" ("tenant_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action"
        ON "audit_logs" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity"
        ON "audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id"
        ON "audit_logs" ("user_id")
    `);

    // RLS: 每个租户只能看到自己的审计日志，INSERT 允许（服务账号写入）
    await queryRunner.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY audit_logs_insert_policy ON audit_logs
        FOR INSERT WITH CHECK (true)
    `);
    await queryRunner.query(`
      CREATE POLICY audit_logs_select_policy ON audit_logs
        FOR SELECT USING (
          tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs`);
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_action_enum"`);
  }
}
