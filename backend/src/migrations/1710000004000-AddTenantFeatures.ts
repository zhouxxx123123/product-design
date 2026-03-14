import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantFeatures1710000004000 implements MigrationInterface {
  name = 'AddTenantFeatures1710000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_features" (
        "tenant_id"  UUID         NOT NULL,
        "key"        VARCHAR(100) NOT NULL,
        "enabled"    BOOLEAN      NOT NULL DEFAULT TRUE,
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_features" PRIMARY KEY ("tenant_id", "key"),
        CONSTRAINT "FK_tenant_features_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_features"`);
  }
}
