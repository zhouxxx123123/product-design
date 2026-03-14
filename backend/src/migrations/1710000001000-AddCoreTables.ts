import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds core business tables:
 *   - client_profiles
 *   - templates
 *   - interview_sessions
 *   - cases
 *
 * Idempotent — uses IF NOT EXISTS and DO $$ EXCEPTION blocks throughout.
 * Matches entity definitions in:
 *   - ClientProfileEntity  (@Entity('client_profiles'))
 *   - TemplateEntity       (@Entity('templates'))
 *   - InterviewSessionEntity (@Entity('interview_sessions'))
 *   - CaseEntity           (@Entity('cases'))
 *
 * Enum types created:
 *   - template_type_enum    : interview | questionnaire | outline | report
 *   - template_scope_enum   : global | tenant | personal
 *   - interview_status_enum : scheduled | in_progress | paused | completed | cancelled | archived
 *   - case_type_enum        : project | research | insight | template
 *   - case_status_enum      : draft | published | archived
 */
export class AddCoreTables1710000001000 implements MigrationInterface {
  name = 'AddCoreTables1710000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "template_type_enum" AS ENUM (
          'interview', 'questionnaire', 'outline', 'report'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "template_scope_enum" AS ENUM (
          'global', 'tenant', 'personal'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "interview_status_enum" AS ENUM (
          'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case_type_enum" AS ENUM (
          'project', 'research', 'insight', 'template'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "case_status_enum" AS ENUM (
          'draft', 'published', 'archived'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    // -------------------------------------------------------- client_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_profiles" (
        "id"                UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"         UUID         NOT NULL,
        "name"              VARCHAR(100) NOT NULL,
        "email"             VARCHAR(255),
        "phone"             VARCHAR(20),
        "position"          VARCHAR(100),
        "company"           VARCHAR(100),
        "industry"          VARCHAR(50),
        "tags"              JSONB,
        "notes"             TEXT,
        "last_interview_at" TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "PK_client_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_client_profiles_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_profiles_tenant_email"
        ON "client_profiles" ("tenant_id", "email")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_profiles_tenant_company"
        ON "client_profiles" ("tenant_id", "company")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_client_profiles_deleted_at"
        ON "client_profiles" ("deleted_at")
        WHERE deleted_at IS NULL
    `);

    // -------------------------------------------------------------- templates
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id"            UUID                   NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"     UUID,
        "created_by"    UUID,
        "name"          VARCHAR(100)           NOT NULL,
        "code"          VARCHAR(50),
        "template_type" "template_type_enum"   NOT NULL DEFAULT 'interview',
        "description"   TEXT,
        "content"       JSONB                  NOT NULL DEFAULT '{}',
        "scope"         "template_scope_enum"  NOT NULL DEFAULT 'tenant',
        "tags"          JSONB                  NOT NULL DEFAULT '[]',
        "variables"     JSONB                  NOT NULL DEFAULT '{}',
        "usage_count"   INTEGER                NOT NULL DEFAULT 0,
        "is_active"     BOOLEAN                NOT NULL DEFAULT TRUE,
        "metadata"      JSONB                  NOT NULL DEFAULT '{}',
        "created_at"    TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_templates_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_templates_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_templates_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_tenant_type"
        ON "templates" ("tenant_id", "template_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_scope"
        ON "templates" ("scope")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_is_active"
        ON "templates" ("is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_templates_deleted_at"
        ON "templates" ("deleted_at")
        WHERE deleted_at IS NULL
    `);

    // ---------------------------------------------------- interview_sessions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interview_sessions" (
        "id"                       UUID                    NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"                UUID                    NOT NULL,
        "client_id"                UUID,
        "interviewer_id"           UUID,
        "title"                    VARCHAR(200)            NOT NULL,
        "description"              TEXT,
        "status"                   "interview_status_enum" NOT NULL DEFAULT 'scheduled',
        "interview_date"           TIMESTAMPTZ             NOT NULL,
        "planned_duration_minutes" INTEGER,
        "raw_transcript"           TEXT,
        "structured_summary"       JSONB,
        "executive_summary"        JSONB,
        "language"                 VARCHAR(50),
        "started_at"               TIMESTAMPTZ,
        "completed_at"             TIMESTAMPTZ,
        "created_at"               TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "updated_at"               TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "deleted_at"               TIMESTAMPTZ,
        CONSTRAINT "PK_interview_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_interview_sessions_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_interview_sessions_client_id" FOREIGN KEY ("client_id")
          REFERENCES "client_profiles" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_interview_sessions_interviewer_id" FOREIGN KEY ("interviewer_id")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_tenant_date"
        ON "interview_sessions" ("tenant_id", "interview_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_client_id"
        ON "interview_sessions" ("client_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_interviewer_id"
        ON "interview_sessions" ("interviewer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_status"
        ON "interview_sessions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_tenant_status_date"
        ON "interview_sessions" ("tenant_id", "status", "interview_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interview_sessions_deleted_at"
        ON "interview_sessions" ("deleted_at")
        WHERE deleted_at IS NULL
    `);

    // ------------------------------------------------------------------ cases
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cases" (
        "id"         UUID               NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"  UUID               NOT NULL,
        "created_by" UUID,
        "title"      VARCHAR(200)       NOT NULL,
        "industry"   VARCHAR(50),
        "case_type"  "case_type_enum"   NOT NULL DEFAULT 'research',
        "content"    TEXT               NOT NULL,
        "summary"    VARCHAR(500),
        "tags"       JSONB              NOT NULL DEFAULT '[]',
        "metadata"   JSONB              NOT NULL DEFAULT '{}',
        "is_public"  BOOLEAN            NOT NULL DEFAULT FALSE,
        "status"     "case_status_enum" NOT NULL DEFAULT 'draft',
        "embedding"  TEXT,
        "created_at" TIMESTAMPTZ        NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ        NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_cases_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cases_tenant_id" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cases_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_tenant_industry"
        ON "cases" ("tenant_id", "industry")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_tenant_case_type"
        ON "cases" ("tenant_id", "case_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_is_public"
        ON "cases" ("is_public")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_status"
        ON "cases" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_tenant_created_at"
        ON "cases" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_deleted_at"
        ON "cases" ("deleted_at")
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and tables in reverse dependency order

    // cases
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_tenant_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_is_public"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_tenant_case_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cases_tenant_industry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cases"`);

    // interview_sessions
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_tenant_status_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_interviewer_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_client_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_sessions_tenant_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "interview_sessions"`);

    // templates
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_scope"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_templates_tenant_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "templates"`);

    // client_profiles
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_profiles_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_profiles_tenant_company"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_profiles_tenant_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_profiles"`);

    // enums (drop in reverse creation order)
    await queryRunner.query(`DROP TYPE IF EXISTS "case_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "case_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "interview_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "template_scope_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "template_type_enum"`);
  }
}
