import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionInsights1710000007000 implements MigrationInterface {
  name = 'AddSessionInsights1710000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_insights" (
        "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" UUID        NOT NULL,
        "tenant_id"  UUID        NOT NULL,
        "layer"      INTEGER     NOT NULL,
        "content"    JSONB       NOT NULL DEFAULT '{}',
        "edited_by"  UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_insights_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_session_insights_session_id" FOREIGN KEY ("session_id")
          REFERENCES "interview_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_insights_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_insights_session_id"
        ON "session_insights" ("session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_insights_layer"
        ON "session_insights" ("session_id", "layer")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_insights_layer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_insights_session_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_insights"`);
  }
}
