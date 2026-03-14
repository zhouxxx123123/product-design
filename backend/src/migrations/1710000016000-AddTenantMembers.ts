import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the tenant_members table.
 *
 * Stores the many-to-many relationship between tenants and users, including
 * the member's role within the tenant.
 *
 * Idempotent — uses IF NOT EXISTS and DO-EXCEPTION blocks throughout.
 * Matches TenantMemberEntity (MemberRole enum: owner | admin | member | viewer).
 */
export class AddTenantMembers1710000016000 implements MigrationInterface {
  name = 'AddTenantMembers1710000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. Enum type
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tenant_member_role" AS ENUM ('owner', 'admin', 'member', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    // -------------------------------------------------------------------------
    // 2. Table
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_members" (
        "id"        UUID                  NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" UUID                  NOT NULL,
        "user_id"   UUID                  NOT NULL,
        "role"      "tenant_member_role"  NOT NULL DEFAULT 'member',
        "joined_at" TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_tenant_members_id"        PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_members_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_members_user_id"   FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // -------------------------------------------------------------------------
    // 3. Indexes
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_members_tenant_user"
        ON "tenant_members" ("tenant_id", "user_id")
    `);

    // -------------------------------------------------------------------------
    // 4. Row Level Security
    // -------------------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE tenant_members FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_members_policy ON tenant_members`);
    await queryRunner.query(`
      CREATE POLICY tenant_members_policy ON tenant_members
        FOR ALL
        USING (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
          OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        )
        WITH CHECK (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order: policy → table → enum
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_members_policy ON tenant_members`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tenant_members_tenant_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_members"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tenant_member_role"`);
  }
}
