import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionCollaboration1710000006000 implements MigrationInterface {
  name = 'AddSessionCollaboration1710000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_comments" (
        "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "session_id"  UUID         NOT NULL,
        "author_id"   UUID         NOT NULL,
        "tenant_id"   UUID         NOT NULL,
        "content"     TEXT         NOT NULL,
        "target_type" VARCHAR(50),
        "target_id"   VARCHAR(100),
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_session_comments_session_id" FOREIGN KEY ("session_id")
          REFERENCES "interview_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_comments_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_comments_session_id"
        ON "session_comments" ("session_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "session_case_links" (
        "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" UUID        NOT NULL,
        "case_id"    UUID        NOT NULL,
        "tenant_id"  UUID        NOT NULL,
        "reason"     TEXT,
        "added_by"   UUID        NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_case_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_session_case_links" UNIQUE ("session_id", "case_id"),
        CONSTRAINT "FK_session_case_links_session_id" FOREIGN KEY ("session_id")
          REFERENCES "interview_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_case_links_case_id" FOREIGN KEY ("case_id")
          REFERENCES "cases" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_session_case_links_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_case_links_session_id"
        ON "session_case_links" ("session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_case_links_session_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_case_links"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_comments_session_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session_comments"`);
  }
}
