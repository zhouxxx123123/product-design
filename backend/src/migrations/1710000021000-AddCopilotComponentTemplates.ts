import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCopilotComponentTemplates1710000021000 implements MigrationInterface {
  name = 'AddCopilotComponentTemplates1710000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copilot_component_templates" (
        "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"   UUID          NOT NULL,
        "name"        VARCHAR(255)  NOT NULL,
        "description" TEXT          NOT NULL,
        "schema"      JSONB         NOT NULL,
        "intent"      VARCHAR(100),
        "use_count"   INTEGER       NOT NULL DEFAULT 0,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_copilot_component_templates_id"
          PRIMARY KEY ("id"),
        CONSTRAINT "FK_copilot_component_templates_tenant_id"
          FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copilot_component_templates_tenant_intent"
        ON "copilot_component_templates" ("tenant_id", "intent")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copilot_component_templates_tenant_created_at"
        ON "copilot_component_templates" ("tenant_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_copilot_component_templates_tenant_created_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_copilot_component_templates_tenant_intent"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "copilot_component_templates"`);
  }
}
