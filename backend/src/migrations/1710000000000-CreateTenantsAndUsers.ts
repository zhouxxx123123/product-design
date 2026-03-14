import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates tenants and users tables.
 * Idempotent — uses IF NOT EXISTS throughout.
 * Matches TenantEntity and UserEntity definitions.
 *
 * Role enum values: admin | consultant | viewer
 */
export class CreateTenantsAndUsers1710000000000 implements MigrationInterface {
  name = 'CreateTenantsAndUsers1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enum only if it doesn't exist yet
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('admin', 'consultant', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id"         UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "name"       VARCHAR(100) NOT NULL,
        "slug"       VARCHAR(50)  NOT NULL,
        "ai_config"  JSONB        NOT NULL DEFAULT '{"provider":"moonshot","model":"kimi-k2.5","temperature":0.7}',
        "settings"   JSONB        NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_tenants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenants_slug" ON "tenants" ("slug")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            UUID            NOT NULL DEFAULT uuid_generate_v4(),
        "email"         VARCHAR(255)    NOT NULL,
        "display_name"  VARCHAR(100),
        "password"      VARCHAR(255),
        "role"          "user_role_enum" NOT NULL DEFAULT 'consultant',
        "avatar_url"    VARCHAR(255),
        "tenant_id"     UUID,
        "refresh_token" TEXT,
        "is_active"     BOOLEAN         NOT NULL DEFAULT TRUE,
        "created_at"    TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_users_id"        PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email"      ON "users" ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id"  ON "users" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_deleted_at" ON "users" ("deleted_at")
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tenants_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
