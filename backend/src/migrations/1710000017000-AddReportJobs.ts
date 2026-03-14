import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the report_jobs table.
 *
 * Persists async export job state so it survives server restarts.
 * Replaces the in-memory Map<string, ReportJob> in ReportService.
 *
 * Idempotent — uses IF NOT EXISTS and DROP … IF EXISTS throughout.
 * Enum: report_job_status ('pending' | 'processing' | 'done' | 'failed')
 */
export class AddReportJobs1710000017000 implements MigrationInterface {
  name = 'AddReportJobs1710000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // 1. Enum type
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_job_status" AS ENUM ('pending', 'processing', 'done', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    // -------------------------------------------------------------------------
    // 2. Table
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_jobs" (
        "id"         UUID                  NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"  UUID                  NOT NULL,
        "session_id" UUID                  NOT NULL,
        "status"     "report_job_status"   NOT NULL DEFAULT 'pending',
        "format"     VARCHAR(20)           NOT NULL,
        "file_path"  TEXT,
        "error"      TEXT,
        "created_at" TIMESTAMPTZ           NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_jobs_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_report_jobs_session_id" FOREIGN KEY ("session_id")
          REFERENCES "interview_sessions" ("id") ON DELETE CASCADE
      )
    `);

    // -------------------------------------------------------------------------
    // 3. Index
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_report_jobs_session_id"
        ON "report_jobs" ("session_id")
    `);

    // -------------------------------------------------------------------------
    // 4. Row Level Security
    // -------------------------------------------------------------------------
    await queryRunner.query(`ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE report_jobs FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `DROP POLICY IF EXISTS report_jobs_tenant_isolation_policy ON report_jobs`,
    );
    await queryRunner.query(`
      CREATE POLICY report_jobs_tenant_isolation_policy ON report_jobs
        FOR ALL
        USING (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
        WITH CHECK (
          tenant_id = current_tenant_id()
          OR is_super_tenant()
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order: policy → index → table → enum
    await queryRunner.query(
      `DROP POLICY IF EXISTS report_jobs_tenant_isolation_policy ON report_jobs`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_jobs_session_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_job_status"`);
  }
}
