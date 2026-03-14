import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptSegments1710000008000 implements MigrationInterface {
  name = 'AddTranscriptSegments1710000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transcript_segments" (
        "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" UUID        NOT NULL,
        "tenant_id"  UUID        NOT NULL,
        "text"       TEXT        NOT NULL,
        "start_ms"   INTEGER,
        "end_ms"     INTEGER,
        "speaker"    VARCHAR(100),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transcript_segments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transcript_segments_session_id" FOREIGN KEY ("session_id")
          REFERENCES "interview_sessions" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transcript_segments_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transcript_segments_session_id"
        ON "transcript_segments" ("session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transcript_segments_session_time"
        ON "transcript_segments" ("session_id", "start_ms")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transcript_segments_session_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transcript_segments_session_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transcript_segments"`);
  }
}
